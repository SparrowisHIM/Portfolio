import { FLOOR_HEIGHT, SLAB_THICKNESS, type Site, type Vec3 } from "./site-generator";

/**
 * The construction timeline.
 *
 * Page scroll gives a section value `f` (0 = ground level, 1..N = floors,
 * N + 1 = roof). The ground floor is finished before you arrive; every floor
 * above it is built while you scroll up to it. Each floor's progress `t` runs
 * 0..1 through these stages:
 *
 *   columns rise        0.00 - 0.30
 *   slab lifted in yard 0.12 - 0.24
 *   slab swung over     0.24 - 0.50
 *   slab lowered        0.50 - 0.66  (placed at 0.66)
 *   hook rises, returns 0.66 - 0.95
 *   glazing rises       0.70 - 0.90
 *   lamp on             0.90 -
 */

export const PLACED_AT = 0.66;

/** Floor `index` is under construction while f runs from start to end. */
function window(index: number) {
  return { start: index - 0.72, end: index + 0.18 };
}

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function smoothstep(a: number, b: number, v: number) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Build progress of one floor for a section value. The ground floor is always done. */
export function floorProgress(index: number, f: number) {
  if (index === 0) return 1;
  const { start, end } = window(index);
  return clamp01((f - start) / (end - start));
}

/** Which floor the crane is working on, and how far along it is. */
export function craneJob(site: Site, f: number) {
  const count = site.floors.length;
  for (let i = 1; i < count; i++) {
    const t = floorProgress(i, f);
    if (t > 0 && t < 1) return { index: i, t };
  }
  // Nothing mid-build. Either waiting on the next slab, or holding the last one
  // over the roof for whoever builds the next floor.
  const next = site.floors.findIndex((_, i) => i > 0 && floorProgress(i, f) === 0);
  if (next !== -1) return { index: next, t: 0 };
  return { index: count, t: 0.42 };
}

export type CranePose = {
  /** Slew angle in radians. */
  angle: number;
  /** Trolley distance along the jib. */
  trolley: number;
  /** World position of the hook. */
  hook: Vec3;
  /** Whether a slab hangs from the hook. */
  loaded: boolean;
  /** Footprint of the slab on the hook. */
  slab: { width: number; depth: number };
};

const HOOK_ABOVE_SLAB = 1.25;

export function yardPosition(site: Site): Vec3 {
  const { crane } = site;
  const toTower = Math.atan2(-crane.position[0], -crane.position[2]);
  const angle = toTower + site.yardSide * 1.45;
  const r = Math.min(crane.jibLength - 1.5, 7.5);
  return [
    crane.position[0] + Math.sin(angle) * r,
    0,
    crane.position[2] + Math.cos(angle) * r,
  ];
}

/** Where the crane is for a section value. */
export function cranePose(site: Site, f: number): CranePose {
  const { crane } = site;
  const job = craneJob(site, f);
  const floor = site.floors[Math.min(job.index, site.floors.length - 1)];
  const overRoof = job.index >= site.floors.length;
  const t = job.t;

  const toTower = Math.atan2(-crane.position[0], -crane.position[2]);
  const rTower = Math.hypot(crane.position[0], crane.position[2]);
  const yard = yardPosition(site);
  const toYard = Math.atan2(yard[0] - crane.position[0], yard[2] - crane.position[2]);
  const rYard = Math.hypot(yard[0] - crane.position[0], yard[2] - crane.position[2]);

  const floorY = overRoof ? site.totalHeight : floor.y;
  const restY = floorY + SLAB_THICKNESS + HOOK_ABOVE_SLAB;
  const hoistY = site.totalHeight + 4.5;
  const yardHookY = SLAB_THICKNESS * (remainingSlabs(site, f) + 1) + HOOK_ABOVE_SLAB;

  let angle = toYard;
  let trolley = rYard;
  let y = yardHookY;
  let loaded = true;

  if (t < 0.12) {
    // Hook resting on the next slab in the yard.
  } else if (t < 0.24) {
    y = lerp(yardHookY, hoistY, smoothstep(0.12, 0.24, t));
  } else if (t < 0.5) {
    const s = smoothstep(0.24, 0.5, t);
    angle = lerp(toYard, toTower, s);
    trolley = lerp(rYard, rTower, s);
    y = hoistY;
  } else if (t < PLACED_AT) {
    angle = toTower;
    trolley = rTower;
    y = lerp(hoistY, restY, smoothstep(0.5, PLACED_AT, t));
  } else if (t < 0.8) {
    angle = toTower;
    trolley = rTower;
    y = lerp(restY, hoistY, smoothstep(PLACED_AT, 0.8, t));
    loaded = false;
  } else {
    const s = smoothstep(0.8, 0.98, t);
    angle = lerp(toTower, toYard, s);
    trolley = lerp(rTower, rYard, s);
    y = lerp(hoistY, yardHookY, smoothstep(0.86, 1, t));
    loaded = false;
  }

  if (overRoof) {
    // Holding the next slab above the unfinished top level.
    angle = lerp(toYard, toTower, 0.85);
    trolley = lerp(rYard, rTower, 0.85);
    y = hoistY;
    loaded = true;
  }

  return {
    angle,
    trolley,
    hook: [
      crane.position[0] + Math.sin(angle) * trolley,
      y,
      crane.position[2] + Math.cos(angle) * trolley,
    ],
    loaded,
    slab: overRoof
      ? { width: floor.width * 0.92, depth: floor.depth * 0.92 }
      : { width: floor.width, depth: floor.depth },
  };
}

/** Slabs still stacked in the yard. */
export function remainingSlabs(site: Site, f: number) {
  let n = 0;
  for (let i = 1; i < site.floors.length; i++) {
    if (floorProgress(i, f) < 0.12) n++;
  }
  return n;
}

/** Height of the highest placed slab, used to clip the scaffolding. */
export function builtHeight(site: Site, f: number) {
  let top = FLOOR_HEIGHT;
  for (let i = 1; i < site.floors.length; i++) {
    if (floorProgress(i, f) >= PLACED_AT) top = site.floors[i].y + FLOOR_HEIGHT;
  }
  return top;
}
