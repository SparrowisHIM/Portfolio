import { FLOOR_HEIGHT, SLAB_THICKNESS, type Floor, type Site, type Vec3 } from "./site-generator";

/**
 * The construction timeline.
 *
 * Page scroll gives a section value `f` (0 = ground level, 1..N = floors,
 * N + 1 = roof). The ground floor is finished before you arrive; every floor
 * above it is built while you scroll up to it. Each floor's progress `t` runs
 * 0..1 through these stages:
 *
 *   columns rise        0.00 - 0.30
 *   frame lifted        0.12 - 0.32
 *   frame swung over    0.28 - 0.52
 *   frame lowered       0.52 - 0.62  (hovers just above its plate)
 *   frame released      0.66        (PLACED_AT: the structure takes it)
 *   hook rises, returns 0.66 - 0.96
 *   glazing rises       0.70 - 0.90
 *   diagonals arrive    0.70 - 0.80
 *   lamp on             0.90 -
 *
 * The top level (index N) has columns only. They rise on the same schedule
 * while the last floor is being read, and the crane holds its frame overhead.
 */

export const PLACED_AT = 0.66;

/** The frame hovers this far above its plate before it is released. */
export const HOVER = 0.2;

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

/** Which level the crane is working on, and how far along it is. */
export function craneJob(site: Site, f: number) {
  const count = site.floors.length;
  for (let i = 1; i <= count; i++) {
    const t = floorProgress(i, f);
    if (t > 0 && t < 1) return { index: i, t };
  }
  // Nothing mid-build. Either waiting on the next frame, or holding the last
  // one over the roof for whoever builds the next floor.
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
  /** Yaw of the slab on the hook, matching its floor plate. */
  rotation?: number;
};

const HOOK_ABOVE_SLAB = 1.25;
/** Clearance over the columns already standing on the level being built. */
const HOIST_CLEAR = FLOOR_HEIGHT * 0.55;

/** Centre of a floor plate in world x/z, cantilevers and setbacks included. */
export function plateCentre(floor: Floor): [number, number] {
  const dx = (floor.extend[0] - floor.extend[1]) / 2;
  const dz = (floor.extend[2] - floor.extend[3]) / 2;
  const c = Math.cos(floor.rotation);
  const s = Math.sin(floor.rotation);
  return [floor.offset[0] + dx * c - dz * s, floor.offset[1] + dx * s + dz * c];
}

/** Outer size of a floor plate, cantilevers and setbacks included. */
export function plateSize(floor: Floor) {
  return {
    width: floor.width + floor.extend[0] + floor.extend[1],
    depth: floor.depth + floor.extend[2] + floor.extend[3],
  };
}

export function yardPosition(site: Site): Vec3 {
  const { crane } = site;
  const toTower = Math.atan2(-crane.position[0], -crane.position[2]);
  const angle = toTower + site.yardSide * 1.45;
  const r = Math.min(crane.jibLength - 1.5, 7.5);
  return [crane.position[0] + Math.sin(angle) * r, 0, crane.position[2] + Math.cos(angle) * r];
}

/**
 * Where the crane is for a section value. One lift reads as: pick the frame
 * up, swing it over the tower, lower it to a hover just above its columns,
 * dip, release, then rise and swing back for the next one.
 */
export function cranePose(site: Site, f: number): CranePose {
  const { crane } = site;
  const job = craneJob(site, f);
  const floor = site.floors[Math.min(job.index, site.floors.length - 1)];
  const overRoof = job.index >= site.floors.length;
  const t = job.t;

  // The hook aims at the plate itself, not the tower axis: plates shift.
  const [px, pz] = overRoof ? floor.offset : plateCentre(floor);
  const toTower = Math.atan2(px - crane.position[0], pz - crane.position[2]);
  const rTower = Math.min(crane.jibLength - 0.6, Math.hypot(px - crane.position[0], pz - crane.position[2]));
  const yard = yardPosition(site);
  const toYard = Math.atan2(yard[0] - crane.position[0], yard[2] - crane.position[2]);
  const rYard = Math.hypot(yard[0] - crane.position[0], yard[2] - crane.position[2]);

  const floorY = overRoof ? site.totalHeight : floor.y;
  const restY = floorY + HOVER + HOOK_ABOVE_SLAB;
  const hoistY = floorY + HOIST_CLEAR + HOOK_ABOVE_SLAB;
  const yardHookY = 0.16 + SLAB_THICKNESS * (remainingSlabs(site, f) + 1) + HOOK_ABOVE_SLAB;

  let angle = toYard;
  let trolley = rYard;
  let y = yardHookY;
  let loaded = true;

  if (t < 0.12) {
    // Hook resting on the next frame in the yard.
  } else if (t < PLACED_AT) {
    // Lift, then swing while the last of the lift finishes, then lower onto
    // the hover. The dip at the end is the overshoot before the snap.
    const swing = smoothstep(0.28, 0.52, t);
    angle = lerp(toYard, toTower, swing);
    trolley = lerp(rYard, rTower, swing);
    const lift = smoothstep(0.12, 0.32, t);
    const lower = smoothstep(0.52, 0.62, t);
    const dip = Math.sin(Math.PI * smoothstep(0.6, PLACED_AT, t)) * 0.1;
    y = lerp(lerp(yardHookY, hoistY, lift), restY, lower) - dip;
  } else if (t < 0.78) {
    // Released. The empty hook rises clear.
    angle = toTower;
    trolley = rTower;
    y = lerp(restY, hoistY, smoothstep(PLACED_AT, 0.78, t));
    loaded = false;
  } else {
    const s = smoothstep(0.76, 0.96, t);
    angle = lerp(toTower, toYard, s);
    trolley = lerp(rTower, rYard, s);
    y = lerp(hoistY, yardHookY, smoothstep(0.86, 1, t));
    loaded = false;
  }

  if (overRoof) {
    // Holding the next frame above the unfinished top level.
    angle = lerp(toYard, toTower, 0.85);
    trolley = lerp(rYard, rTower, 0.85);
    y = hoistY;
    loaded = true;
  }

  const size = plateSize(floor);
  return {
    angle,
    trolley,
    hook: [crane.position[0] + Math.sin(angle) * trolley, y, crane.position[2] + Math.cos(angle) * trolley],
    loaded,
    slab: overRoof ? { width: floor.width * 0.92, depth: floor.depth * 0.92 } : size,
    rotation: overRoof ? 0 : floor.rotation,
  };
}

/** Frames still stacked in the yard. */
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

/** Height of the core, which runs a storey ahead of the frame. */
export function coreHeight(site: Site, f: number) {
  const count = site.floors.length;
  let top = FLOOR_HEIGHT;
  for (let i = 1; i <= count; i++) {
    const t = floorProgress(i, f);
    const y = i * FLOOR_HEIGHT;
    if (t >= 1) top = y + FLOOR_HEIGHT;
    else if (t > 0) top = y + FLOOR_HEIGHT * smoothstep(0, 0.5, t);
  }
  return Math.min(top, site.totalHeight + FLOOR_HEIGHT * 0.6);
}
