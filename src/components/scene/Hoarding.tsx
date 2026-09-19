"use client";

import { useMemo } from "react";
import type { Site } from "@/lib/site-generator";
import { plinth } from "@/lib/building";
import { yardAxis } from "@/lib/construction";
import { box, type Instance, type Vec3 } from "@/lib/geometry";
import { createRandom } from "@/lib/random";
import { Instances } from "./Instances";
import { materials } from "./materials";

/** Hoarding stands 2.1m: a hair over head height on the figures. */
const HEIGHT = 2.1;
const PANEL = 0.06;
const POST = 0.14;
/** Panels come in sheets. Bays are sized to land near this. */
const BAY = 2.4;
/** How far in from the edge of the deck the line runs. */
export const INSET = 0.38;

/**
 * Pull a point inside the hoarding, allowing for the footprint of whatever
 * is being placed.
 *
 * The site dressing is laid out on bearings off the open face at radii that
 * know nothing about the shape of the deck, which was harmless while the
 * deck simply stopped at its edge. With a fence on that edge, anything that
 * overran it now stands half in and half out — the cabin was doing exactly
 * that at the corner.
 */
export function insideHoarding(
  base: { width: number; depth: number; offsetX: number; offsetZ: number },
  p: readonly [number, number],
  radius: number,
): [number, number] {
  const hw = Math.max(0, base.width / 2 - INSET - 0.25 - radius);
  const hd = Math.max(0, base.depth / 2 - INSET - 0.25 - radius);
  const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
  return [
    clamp(p[0], base.offsetX - hw, base.offsetX + hw),
    clamp(p[1], base.offsetZ - hd, base.offsetZ + hd),
  ];
}
/** Clear opening for the gate, on the side the laydown is served from. */
const GATE = 5.2;

type Edge = {
  /** True when the run travels along x — i.e. it stands on a ±z face. */
  alongX: boolean;
  /** Position of the line on the other axis. */
  fixed: number;
  /** Extent of the run, as a signed range. */
  from: number;
  to: number;
  /** Which way is out of the site, on the fixed axis. */
  out: 1 | -1;
  /** This run carries the gate. */
  gated: boolean;
};

/**
 * The site boundary.
 *
 * A construction site is a place you are not allowed into, and nothing said
 * so: the deck simply stopped at the edge of the plinth. Hoarding is the
 * cheapest line in the whole scene — painted ply on posts, a capping rail,
 * a gate on the side the deliveries come to — and it is most of the reason
 * the reference reads as a real site rather than a model of one.
 *
 * It stands on the plinth with everything else, set in from the edge, and it
 * is up from the first frame: you hoard a site before you start, not after.
 */
export function Hoarding({ site }: { site: Site }) {
  const m = materials();

  const parts = useMemo(() => {
    const base = plinth(site);
    const rnd = createRandom(site.seed ^ 0x40a2);
    const hw = base.width / 2 - INSET;
    const hd = base.depth / 2 - INSET;

    // The gate goes where the lorries go: the face the laydown is served
    // across. yardAxis is already snapped to one, so it names the face.
    const axis = yardAxis(site);
    const gateOnX = axis.nx !== 0;
    const gateSign = gateOnX ? axis.nx : axis.nz;

    const edges: Edge[] = [
      { alongX: true, fixed: hd, from: -hw, to: hw, out: 1, gated: !gateOnX && gateSign > 0 },
      { alongX: true, fixed: -hd, from: -hw, to: hw, out: -1, gated: !gateOnX && gateSign < 0 },
      { alongX: false, fixed: hw, from: -hd + POST, to: hd - POST, out: 1, gated: gateOnX && gateSign > 0 },
      { alongX: false, fixed: -hw, from: -hd + POST, to: hd - POST, out: -1, gated: gateOnX && gateSign < 0 },
    ];

    const panels: Instance[] = [];
    const posts: Instance[] = [];
    const rails: Instance[] = [];
    const signs: Instance[] = [];

    /** Place a member on an edge: `u` along the run, `v` off the line. */
    const put = (e: Edge, u: number, v: number, y: number): Vec3 =>
      e.alongX ? [u, y, e.fixed + v] : [e.fixed + v, y, u];
    /** Scale a member that spans `len` along the run and `t` across it. */
    const span = (e: Edge, len: number, h: number, t: number): Vec3 =>
      e.alongX ? [len, h, t] : [t, h, len];

    for (const e of edges) {
      // The gate eats the middle of its run; the rest is divided into
      // whole bays that land as close to BAY as the length allows.
      const openFrom = e.gated ? -GATE / 2 : 0;
      const openTo = e.gated ? GATE / 2 : 0;

      const runs: [number, number][] = e.gated
        ? [
            [e.from, openFrom],
            [openTo, e.to],
          ]
        : [[e.from, e.to]];

      for (const [a, b] of runs) {
        const len = b - a;
        if (len < 0.4) continue;
        const bays = Math.max(1, Math.round(len / BAY));
        const step = len / bays;
        for (let i = 0; i < bays; i++) {
          const c = a + step * (i + 0.5);
          panels.push(box(put(e, c, 0, HEIGHT / 2 + 0.06), span(e, step - 0.03, HEIGHT, PANEL)));
          // A warning plate every few bays, hung on the outside.
          if (rnd.chance(0.22)) {
            signs.push(
              box(
                put(e, c, e.out * (PANEL / 2 + 0.02), HEIGHT * 0.62),
                span(e, 0.46, 0.34, 0.02),
              ),
            );
          }
        }
        for (let i = 0; i <= bays; i++) {
          posts.push(box(put(e, a + step * i, 0, HEIGHT / 2 + 0.1), span(e, POST, HEIGHT + 0.2, POST + 0.05)));
        }
        rails.push(box(put(e, (a + b) / 2, 0, HEIGHT + 0.14), span(e, len + POST, 0.1, PANEL + 0.14)));
      }

      /*
        The gate: a clear opening between two heavy posts, under a header
        beam. No leaves.

        Leaves were the first idea and they cannot work here. There is only
        380mm of deck outside the line, so a two and a half metre leaf swung
        open hangs off the plinth into the black — which is the exact fault
        that had just been fixed on the crane base. Swung inward instead it
        lands in the laydown pile, because the gate belongs on the side the
        pile is served across. An opening with a header over it reads as a
        gate on its own, and nothing floats.
      */
      if (e.gated) {
        for (const hinge of [-1, 1] as const) {
          posts.push(
            box(put(e, hinge * (GATE / 2), 0, HEIGHT / 2 + 0.3), span(e, POST * 1.8, HEIGHT + 0.6, POST * 1.8)),
          );
        }
        rails.push(box(put(e, 0, 0, HEIGHT + 0.46), span(e, GATE + POST * 1.8, 0.28, PANEL + 0.16)));
      }
    }

    return { panels, posts, rails, signs };
  }, [site]);

  const base = useMemo(() => plinth(site), [site]);

  return (
    <group position={[base.offsetX, base.top, base.offsetZ]}>
      <Instances items={parts.panels} material={m.hoarding} />
      <Instances items={parts.posts} material={m.hoardingPost} />
      <Instances items={parts.rails} material={m.hoardingPost} />
      <Instances items={parts.signs} material={m.hoardingSign} />
    </group>
  );
}
