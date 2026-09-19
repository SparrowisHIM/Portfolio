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

/**
 * The precast unit on the hook, and the units stacked in the laydown.
 *
 * Sized to read as a piece of the floor rather than as an anonymous plank:
 * about a quarter of the plate, so when it comes down over the frame you see
 * the floor arriving. A 3.4m plank was honest and said nothing — it was too
 * small against an eleven metre plate to look like it was building anything.
 *
 * Elongated rather than square: the same area reads more like a floor plate,
 * and lying tangentially in the laydown it needs far less of the base than a
 * squarer unit of the same size would.
 */
export const PLANK = { width: 7.4, depth: 3.2 };

export const PLACED_AT = 0.66;

/** The frame hovers this far above its plate before it is released. */
export const HOVER = 0.55;

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

/**
 * The section value at which the last level is complete and the site is
 * topped out. Past it there is nothing left to build.
 */
export function toppedOutAt(site: Site) {
  return window(site.floors.length).end;
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

/** Clear air between the building and the plate waiting to be lifted. */
export const YARD_GAP = 1.9;

/**
 * Which way the laydown lies, snapped to an axis.
 *
 * Snapped rather than free, because a rectangle reaches furthest at its
 * corners: a stack placed on a diagonal at a radius that clears the flat of
 * the building will still be inside its corner. Square to the base, the room
 * needed is simply the half width, and the plates stack straight.
 */
export function yardAxis(site: Site) {
  const a = Math.atan2(site.crane.position[0], site.crane.position[2]) + site.yardSide * 0.6;
  const nx = Math.sin(a);
  const nz = Math.cos(a);
  return Math.abs(nx) >= Math.abs(nz)
    ? { nx: Math.sign(nx) || 1, nz: 0 }
    : { nx: 0, nz: Math.sign(nz) || 1 };
}

/** How far out the middle of the stack sits. */
export function yardRadius(site: Site) {
  const { nx, nz } = yardAxis(site);
  const floor = site.floors[0];
  const reach = Math.abs(nx) * (floor.width / 2) + Math.abs(nz) * (floor.depth / 2);
  return reach + YARD_GAP + PLANK.depth / 2;
}

/**
 * The laydown: where the next plate waits to be lifted.
 *
 * Standing clear of the building on purpose. It used to sit at a fixed radius
 * and the plates ended up overlapping the slab, so a lift began already
 * inside the thing it was building and had nowhere to travel from. The gap is
 * what gives the crane a journey to make.
 */
export function yardPosition(site: Site): Vec3 {
  const { nx, nz } = yardAxis(site);
  const r = yardRadius(site);
  return [nx * r, 0, nz * r];
}

/** The plates lie across the direction they stand off in. */
export function yardTurn(site: Site) {
  return yardAxis(site).nx !== 0 ? Math.PI / 2 : 0;
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

  return {
    angle,
    trolley,
    hook: [crane.position[0] + Math.sin(angle) * trolley, y, crane.position[2] + Math.cos(angle) * trolley],
    loaded,
    slab: PLANK,
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
