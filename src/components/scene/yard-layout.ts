import { SCAFFOLD_GAP, type Site } from "@/lib/site-generator";
import { PLANK, yardPosition, yardTurn } from "@/lib/construction";
import { craneReach, type plinth } from "@/lib/building";
import { createRandom } from "@/lib/random";
import { INSET as HOARDING_INSET } from "./Hoarding";
import { ROW } from "./Scaffold";

type Plinth = ReturnType<typeof plinth>;
type Point = [number, number];
type Spot = { p: Point; a: number };
type Rect = { x: number; z: number; hx: number; hz: number };

/**
 * How far past the face of the building the scaffold reaches: the inner row
 * of standards stands `SCAFFOLD_GAP` off it and the outer row is a bay
 * beyond that. Nothing in the yard may stand inside this.
 */
const SCAFFOLD_OUT = SCAFFOLD_GAP + ROW;

/**
 * Where each piece of yard dressing stands on the plinth deck.
 *
 * Every piece is placed on a bearing off the open face, then made to fit:
 * slid in along its ray until it clears the fence, and walked round the face
 * if it lands on something already down. Placement order is priority order -
 * whoever arrives last gives way - so the big pieces keep their bearings and
 * the small ones fill what is left.
 *
 * `keep` is the radius, about the piece's own origin, of the circle that
 * contains it. Measure every child, including the ones bolted on the outside.
 */
export function layoutYard(site: Site, base: Plinth) {
  const rnd = createRandom(site.seed ^ 0x51de);

  // The building grown by its scaffold, and how far it reaches on a bearing.
  const hull = {
    hx: site.floors[0].width / 2 + SCAFFOLD_OUT,
    hz: site.floors[0].depth / 2 + SCAFFOLD_OUT,
  };
  const reachOn = (a: number) => {
    const sx = Math.abs(Math.sin(a));
    const sz = Math.abs(Math.cos(a));
    return Math.min(sx < 1e-6 ? Infinity : hull.hx / sx, sz < 1e-6 ? Infinity : hull.hz / sz);
  };

  // Which hand the laydown is on, so the lighting mast stands on the other.
  const pile = yardPosition(site);
  const pileBearing = Math.atan2(pile[0], pile[2]) - site.viewAngle;
  const clearOfPile = Math.atan2(Math.sin(pileBearing), Math.cos(pileBearing)) >= 0 ? -1 : 1;

  // What a new piece has to miss: the building, the laydown, the crane base,
  // then everything placed before it.
  const pileHalf =
    yardTurn(site) === 0
      ? { hx: PLANK.width / 2, hz: PLANK.depth / 2 }
      : { hx: PLANK.depth / 2, hz: PLANK.width / 2 };
  const reach = craneReach(site);
  const blockers: Rect[] = [
    { x: 0, z: 0, ...hull },
    { x: pile[0], z: pile[2], ...pileHalf },
    { x: site.crane.position[0], z: site.crane.position[2], hx: reach, hz: reach },
  ];
  const clears = (q: Point, keep: number) =>
    blockers.every((b) => {
      const dx = Math.max(Math.abs(q[0] - b.x) - b.hx, 0);
      const dz = Math.max(Math.abs(q[1] - b.z) - b.hz, 0);
      return dx * dx + dz * dz >= keep * keep;
    });

  /*
    How far a piece may travel along a bearing before it touches the fence,
    less its own radius and a hand's breadth for the posts. It is the radius
    that gives, never the bearing: a per-axis clamp pulls pieces sideways,
    and sideways from the fence is into the building.
  */
  const fenceRadius = (a: number, keep: number) => {
    const d = [Math.sin(a), Math.cos(a)];
    const centre = [base.offsetX, base.offsetZ];
    const halves = [
      base.width / 2 - HOARDING_INSET - 0.25 - keep,
      base.depth / 2 - HOARDING_INSET - 0.25 - keep,
    ];
    let exit = Infinity;
    for (let i = 0; i < 2; i++) {
      if (Math.abs(d[i]) < 1e-6) continue;
      exit = Math.min(exit, Math.max((centre[i] - halves[i]) / d[i], (centre[i] + halves[i]) / d[i]));
    }
    return exit;
  };

  /** `out` is the clear gap between the scaffold and the near face of the piece. */
  const at = (offset: number, out: number, keep = 0.6): Spot => {
    const put = (a: number): Point | null => {
      const want = reachOn(a) + out + keep;
      return fenceRadius(a, keep) < want ? null : [Math.sin(a) * want, Math.cos(a) * want];
    };
    const a0 = site.viewAngle + offset;
    // A tenth of a radian at a time, alternating hands, so a piece that has
    // to move ends up as near its own bearing as it can.
    const walk = (): Spot | null => {
      for (let step = 1; step <= 24; step++) {
        for (const dir of [1, -1]) {
          const a = a0 + dir * step * 0.13;
          const q = put(a);
          if (q && clears(q, keep)) return { p: q, a };
        }
      }
      return null;
    };
    // Nothing fits: as far out on its own bearing as the fence allows, but
    // never nearer the frame than the hull. Crowding the fence beats standing
    // inside the building.
    const crowd = (): Spot => {
      const r = Math.max(reachOn(a0) + keep, Math.min(reachOn(a0) + out + keep, fenceRadius(a0, keep)));
      return { p: [Math.sin(a0) * r, Math.cos(a0) * r], a: a0 };
    };
    const first = put(a0);
    const spot = first && clears(first, keep) ? { p: first, a: a0 } : (walk() ?? crowd());
    blockers.push({ x: spot.p[0], z: spot.p[1], hx: keep, hz: keep });
    return spot;
  };

  return {
    cabin: at(2.45, 0.8, 2.15),
    skip: at(-2.15, 1.2, 1.25),
    rebar: at(1.5, 1.0, 1.4),
    mast: at(clearOfPile * 1.35, 1.6, 0.5),
    tubes: at(2.0, 1.0, 1.56),
    panels: at(-2.7, 1.0, 1.3),
    genset: at(-1.2, 1.1, 0.94),
    drums: at(0.95, 0.9, 0.74),
    // The small stuff last, so it fills whatever the big pieces left.
    cones: [at(-0.6, 0.7, 0.3), at(0.55, 0.9, 0.3), at(1.05, 0.6, 0.3), at(-1.45, 0.8, 0.3), at(1.9, 0.7, 0.3)],
    pallets: [at(-1.75, 1.0, 0.94), at(2.95, 1.2, 0.94), at(0.35, 1.1, 0.94)],
    jitter: rnd.range(-0.15, 0.15),
  };
}
