"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ScaffoldRun, Site } from "@/lib/site-generator";
import { LIFT, onSide } from "@/lib/site-generator";
import { DECK_Y, builtHeight } from "@/lib/construction";
import { box, post, strut, type Instance } from "@/lib/geometry";
import { Instances } from "./Instances";

/** Scaffold tube is 48mm. */
const TUBE = 0.048;
const BRACE = 0.044;
/**
 * Bay width: the gap between the inner and outer row of standards.
 *
 * Exported so the yard can work out where the scaffold actually stops.
 */
export const ROW = 0.9;
/** A scaffold board is 225mm wide and 38mm thick. */
const BOARD = 0.038;
/** Guard rail, mid rail and toe board, above the boards they protect. */
const GUARD = 0.95;
const MID = 0.48;
const TOE = 0.16;

/**
 * The highest boarded lift on a run that has actually been erected.
 *
 * The same expression the clip plane uses, so anyone standing on it is
 * standing on boards that exist rather than on the air above them.
 */
export function workingLift(site: Site, run: ScaffoldRun, f: number) {
  const top = builtHeight(site, f) + 0.9;
  return Math.max(1, Math.min(run.lifts, Math.floor((top - 0.35) / LIFT)));
}

/** Where someone stands on a run: the middle of a bay, on the boards. */
export function scaffoldStand(run: ScaffoldRun, bay: number, lift: number) {
  const step = run.span / run.bays;
  const along = -run.span / 2 + step * (bay + 0.5);
  return onSide(run.side, along, run.offset + ROW / 2, DECK_Y + lift * LIFT + BOARD + 0.04);
}

type ScaffoldProps = {
  site: Site;
  /** Construction time, which stops once the site tops out. */
  build: RefObject<number>;
};

type RunParts = {
  tube: Instance[];
  timber: Instance[];
  plate: Instance[];
  /** The netting sheet: size and placement, drawn as one mesh per run. */
  net: { position: [number, number, number]; scale: [number, number, number] } | null;
};

/**
 * One run of scaffold: two rows of standards, boarded at every lift, braced,
 * railed, and sheeted in debris netting.
 *
 * This used to draw a single run, with only the standards running the full
 * height and everything that makes a scaffold dense confined to a working
 * band near the top. That was the right call against the building of the
 * time — a frame drawn in 4cm steel line work, which any mesh in front of
 * simply erased. The building is solid concrete now and the calculus is the
 * other way round: a scaffold is *supposed* to read as a mesh in front of a
 * solid, and it is most of what makes a site look like a site.
 *
 * Sizes are the real ones — 48mm tube, 225mm boards, a guard rail at 950mm
 * with a mid rail and a toe board under it. It costs nothing to be right and
 * the proportions are half of why scaffolding reads at all.
 */
function buildRun(run: ScaffoldRun): RunParts {
  const { side, horizontal, span, offset, bays, lifts } = run;
  const tube: Instance[] = [];
  const timber: Instance[] = [];
  const plate: Instance[] = [];

  const at = (a: number, out: number, y: number) => onSide(side, a, out, y);
  const step = span / bays;
  const nodeAt = (i: number) => -span / 2 + i * step;
  const inner = offset;
  const outer = offset + ROW;
  const mid = (inner + outer) / 2;
  /** Standards carry on a lift above the top boards, as they always do. */
  const height = lifts * LIFT + 1.05;

  /*
    A member running the length of the run, and one running across the bay.
    Every run stands on a face, so both are axis aligned — which axis depends
    on whether the face is a ±z one, and `horizontal` is that answer.
  */
  const lengthwise = (out: number, y: number, len: number, w: number, h: number): Instance =>
    box(at(0, out, y), horizontal ? [len, h, w] : [w, h, len]);
  const crosswise = (i: number, y: number, w: number, h: number): Instance =>
    box(at(nodeAt(i), mid, y), horizontal ? [w, h, ROW] : [ROW, h, w]);

  // --- standards, on base plates, on sole boards -------------------------
  for (let i = 0; i <= bays; i++) {
    for (const out of [inner, outer]) {
      tube.push(post(at(nodeAt(i), out, 0.05), height, TUBE));
      plate.push(box(at(nodeAt(i), out, 0.035), [0.2, 0.07, 0.2]));
    }
  }
  for (const out of [inner, outer]) {
    timber.push(lengthwise(out, 0.02, span + 0.4, 0.3, 0.04));
  }

  for (let l = 1; l <= lifts; l++) {
    const y = l * LIFT;

    // --- ledgers along both rows, transoms across every node -------------
    for (const out of [inner, outer]) tube.push(lengthwise(out, y, span + 0.3, TUBE, TUBE));
    for (let i = 0; i <= bays; i++) tube.push(crosswise(i, y, TUBE, TUBE));

    // --- the boarded deck ------------------------------------------------
    for (let i = 0; i < bays; i++) {
      const c = nodeAt(i) + step / 2;
      timber.push(
        box(
          at(c, mid, y + BOARD / 2 + 0.02),
          horizontal ? [step - 0.05, BOARD, ROW - 0.06] : [ROW - 0.06, BOARD, step - 0.05],
        ),
      );
    }

    // --- guard rail, mid rail, toe board on the outer row ----------------
    tube.push(lengthwise(outer, y + GUARD, span + 0.3, TUBE, TUBE));
    tube.push(lengthwise(outer, y + MID, span + 0.3, TUBE, TUBE));
    timber.push(lengthwise(outer - 0.05, y + TOE / 2 + 0.05, span, 0.035, TOE));

    /*
      Facade bracing: one diagonal every third bay, flipping direction each
      lift so the run zigzags the way a braced facade does. Without it the
      scaffold is a grid and reads as a fence.
    */
    for (let i = l % 2; i < bays; i += 3) {
      const a = at(nodeAt(i), outer + 0.06, y - LIFT);
      const b = at(nodeAt(i + 1), outer + 0.06, y);
      tube.push(strut(a, b, BRACE));
    }
  }

  /*
    A ladder in the end bay, running the whole height. A scaffold nobody can
    get up is scenery; the ladder is the detail that says people use this.
  */
  const lx = nodeAt(bays) - step * 0.5;
  for (const o of [-0.16, 0.16]) {
    tube.push(post(at(lx + o, mid, 0.1), height - 0.4, 0.03));
  }
  for (let y = 0.4; y < height - 0.5; y += 0.28) {
    tube.push(strut(at(lx - 0.16, mid, y), at(lx + 0.16, mid, y), 0.02));
  }

  /*
    Debris netting on the outer face. Drawn as one thin sheet rather than
    per-bay panels: it is a translucent surface and overlapping panels double
    their own opacity at every seam.
  */
  const netH = lifts * LIFT + 0.6;
  const p = at(0, outer + 0.09, netH / 2);
  const net = run.netted
    ? {
        position: [p[0], p[1], p[2]] as [number, number, number],
        scale: (horizontal ? [span + 0.3, netH, 0.02] : [0.02, netH, span + 0.3]) as [number, number, number],
      }
    : null;

  return { tube, timber, plate, net };
}

/**
 * Scaffolding, climbing with the building.
 *
 * Everything above the built height is clipped away, so the run rises a lift
 * at a time behind the frame instead of standing there finished on the first
 * frame. The clip eases, which is what makes it read as being erected rather
 * than revealed.
 */
export function Scaffold({ site, build }: ScaffoldProps) {
  const clip = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 4));

  const mats = useMemo(() => {
    const planes = [clip.current];
    return {
      /*
        Galvanised tube. The old scaffold was #1e2635 with an emissive term,
        which is the glowing-line-work house style this site was rebuilt to
        get away from, and against pale concrete it would read as nothing but
        dark hairlines. Real tube is bright; this is knocked back so it sits
        under the sodium rather than competing with the slabs.
      */
      tube: new THREE.MeshStandardMaterial({
        color: "#7d8694",
        roughness: 0.42,
        metalness: 0.72,
        envMapIntensity: 1.0,
        clippingPlanes: planes,
      }),
      timber: new THREE.MeshStandardMaterial({
        color: "#8a7b64",
        roughness: 0.92,
        clippingPlanes: planes,
      }),
      plate: new THREE.MeshStandardMaterial({
        color: "#3b4149",
        roughness: 0.5,
        metalness: 0.6,
        clippingPlanes: planes,
      }),
      /*
        Debris netting: green, and open enough to see the frame through. Front
        faces only and no depth write, so the sheet never punches a hole in
        what is behind it and never doubles its own opacity against itself.
      */
      net: new THREE.MeshStandardMaterial({
        color: "#5f7a58",
        roughness: 0.95,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        side: THREE.FrontSide,
        clippingPlanes: planes,
      }),
    };
  }, []);

  useFrame((_, delta) => {
    // A lift above the highest slab that has landed: you scaffold ahead of
    // the work, not behind it.
    const top = builtHeight(site, build.current ?? 0) + 0.9;
    clip.current.constant = THREE.MathUtils.damp(clip.current.constant, top, 4, delta);
  });

  const runs = useMemo(() => site.scaffolds.map(buildRun), [site]);

  return (
    // The run stands on the deck with everything else, not on the origin.
    <group position={[0, DECK_Y, 0]}>
      {runs.map((run, i) => (
        <group key={i}>
          <Instances items={run.tube} material={mats.tube} />
          <Instances items={run.timber} material={mats.timber} />
          <Instances items={run.plate} material={mats.plate} />
          {run.net && (
            <mesh position={run.net.position} scale={run.net.scale} material={mats.net}>
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
