import { FLOOR_HEIGHT, type Floor, type Site, type Vec3 } from "./site-generator";

/**
 * The construction timeline.
 *
 * Page scroll gives a section value `f` (0 = ground level, 1..N = floors,
 * N + 1 = roof). The ground floor is finished before you arrive; every floor
 * above it is built while you scroll up to it. Each floor's progress `t` runs
 * 0..1 through these stages:
 *
 *   columns rise        0.00 - 0.30
 *   hook down on pile   0.00 - 0.06  (empty; the plate is still stacked)
 *   slings on           0.06 - 0.12  (HITCH_AT: the hook takes the weight)
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

/**
 * Thickness of one precast plate, and of the slabs it becomes.
 *
 * `building.ts` re-exports this as `SLAB`. They were two literals that
 * happened to agree until they didn't: the yard stacked 0.34 plates while
 * the crane worked out where to put its hook from 0.32, which is most of why
 * the plate appeared on the hook instead of leaving the pile.
 */
export const PLATE_T = 0.34;

/**
 * Top of the plinth, in building coordinates — a reveal below the ground
 * slab soffit, so the two do not share a plane and stripe.
 *
 * It lives here rather than in `plinth()` because the crane needs it to
 * find the laydown and cannot import from `building.ts` without closing a
 * cycle. `plinth().top` returns this.
 */
export const DECK_Y = -(PLATE_T + 0.07);

/** Timber bearers the pile stands on. */
export const BEARER_H = 0.12;
/** Timber between each pair of plates, so the pile is not a solid block. */
export const DUNNAGE_H = 0.07;
export const STACK_PITCH = PLATE_T + DUNNAGE_H;

/**
 * Plates left in the laydown when every floor has been lifted.
 *
 * The pile used to run down to nothing, which reads as a site that has
 * finished rather than one that is working. It draws down as the building
 * goes up and then holds: there is always more ready to go.
 *
 * The floor sets the height of the whole pile, because the drawdown is
 * fixed at one plate per lift — four of them — so the pile always starts
 * four taller than it ends. At a floor of four it started at eight, which
 * is over three metres on a seven by three footprint and reads as a
 * monolith rather than a stack of floor plates.
 */
export const STACK_MIN = 2;

/** Plates in the laydown right now. */
export function stackCount(site: Site, f: number) {
  return STACK_MIN + remainingSlabs(site, f);
}

/** Centre height of plate `i` in the pile, counting from the bottom. */
export function stackPlateY(i: number) {
  return DECK_Y + BEARER_H + PLATE_T / 2 + i * STACK_PITCH;
}

export const PLACED_AT = 0.66;

/** When the hook takes the weight and the plate leaves the pile. */
export const HITCH_AT = 0.12;
/** When the slings go on. Between here and HITCH_AT the crane is hitching. */
export const SLINGS_AT = 0.06;

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

/**
 * Which level the crane is working on, and how far along it is.
 *
 * `idle` is the difference between working the top level and having nothing
 * left to work. Both used to come back as `index === floors.length`, and the
 * pose could not tell them apart — so the last lift was read as "stand by
 * holding a plate overhead" and the roof slab simply appeared on the frame
 * with no crane involved. The top floor is a lift like any other.
 */
export function craneJob(site: Site, f: number) {
  const count = site.floors.length;
  for (let i = 1; i <= count; i++) {
    const t = floorProgress(i, f);
    if (t > 0 && t < 1) return { index: i, t, idle: false };
  }
  /*
    Nothing mid-build. Either waiting on the next frame, or holding the last
    one over the roof for whoever builds the next floor.

    The lifts are numbered 1..count and there are `count` of them, but
    `floors` is indexed 0..count-1 — so a `findIndex` over the array can
    never return the last lift. Every floor is followed by a tenth of a
    section where none is mid-build, and after floor four that gap found
    nothing waiting and fell through to standing by: the crane teleported
    nineteen metres up holding a plate, then dropped straight back to the
    yard when the last lift began.
  */
  for (let i = 1; i <= count; i++) {
    if (floorProgress(i, f) === 0) return { index: i, t: 0, idle: false };
  }
  return { index: count, t: 0.42, idle: true };
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
  /**
   * Whether the slings are on the plate. True through the hitch as well as
   * the lift, so the rigging is connected before the weight moves rather
   * than appearing with it.
   *
   * Optional so the night shift can keep building its pose literal exactly
   * as it was — that block is not to be touched.
   */
  hitched?: boolean;
  /** Footprint of the slab on the hook. */
  slab: { width: number; depth: number };
  /**
   * Yaw of the plate and of the gear that is holding it.
   *
   * It is not constant across a lift. Plates lie tangentially in the
   * laydown — `yardTurn` — and land square on the frame, so the load turns
   * on the way over, with the slew.
   */
  rotation?: number;
};

/**
 * Drop from the hook block to the middle of the plate: the rigging.
 *
 * Shared with `Crane.tsx`, which draws the hook, the bridle, the spreader
 * and the slings inside it. It was a literal in both files.
 */
export const HOOK_ABOVE_SLAB = 1.25;
/** Trolley height above the slew base, so the hook knows where its rope ends. */
export const TROLLEY_Y = 0.66;
/** The shortest length of rope that still reads as rope. */
const MIN_ROPE = 0.9;
/**
 * Clearance the plate travels at over the level being built.
 *
 * Down from 0.55 of a storey. The rigging is a metre and a quarter deep now
 * and the hook has to fit under its own trolley with rope to spare, and the
 * plate was riding two metres over a landing it clears by a metre anyway.
 */
const HOIST_CLEAR = FLOOR_HEIGHT * 0.36;

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
  // Standing by with a plate overhead, rather than placing one.
  const overRoof = job.idle;
  const t = job.t;

  // The hook aims at the plate itself, not the tower axis: plates shift.
  const [px, pz] = overRoof ? floor.offset : plateCentre(floor);
  const toTower = Math.atan2(px - crane.position[0], pz - crane.position[2]);
  const rTower = Math.min(crane.jibLength - 0.6, Math.hypot(px - crane.position[0], pz - crane.position[2]));
  const yard = yardPosition(site);
  const toYard = Math.atan2(yard[0] - crane.position[0], yard[2] - crane.position[2]);
  const rYard = Math.hypot(yard[0] - crane.position[0], yard[2] - crane.position[2]);

  /*
    Where this lift lands. The levels are the storeys, but there is one more
    slab than there are storeys — the cap — and it sits at `topLevel.y`. The
    old line read `floor.y` off a clamped index, which for the last lift is
    the storey below the one being capped: a whole floor out.
  */
  const landing = job.index < site.floors.length ? site.floors[job.index].y : site.topLevel.y;
  const floorY = overRoof ? site.totalHeight : landing;
  const restY = floorY + HOVER + HOOK_ABOVE_SLAB;
  const hoistY = floorY + HOIST_CLEAR + HOOK_ABOVE_SLAB;

  // Where the hook sits over the laydown: on the plate it is about to take.
  //
  // `remainingSlabs` drops the moment the hook takes the weight, so while
  // this lift is in the air the count is one short of the pile it came off
  // and has to be put back — otherwise the plate leaves the pile and drops
  // a whole pitch in the same frame. Once it has been placed and the hook
  // is coming home empty, the shorter pile is the right one to land on.
  const carrying = t >= HITCH_AT && t < 0.78;
  const onPile = stackCount(site, f) + (carrying ? 1 : 0);
  const yardHookY = stackPlateY(onPile - 1) + HOOK_ABOVE_SLAB;

  let angle = toYard;
  let trolley = rYard;
  let y = yardHookY;
  let loaded = t >= HITCH_AT;

  if (t < HITCH_AT) {
    // Hook down on the pile, slings going on. The plate is still stacked.
  } else if (t < PLACED_AT) {
    // Lift, then swing while the last of the lift finishes, then lower onto
    // the hover. The dip at the end is the overshoot before the snap.
    const swing = smoothstep(0.28, 0.52, t);
    angle = lerp(toYard, toTower, swing);
    trolley = lerp(rYard, rTower, swing);
    const lift = smoothstep(HITCH_AT, 0.32, t);
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

  // A hook cannot rise past its own trolley. On a short mast over the top
  // level the hoist height worked out above the rope's own anchor, which
  // inverted the falls — visible as two hairlines crossing the jib.
  const ropeTop = DECK_Y + crane.mastHeight + TROLLEY_Y;
  y = Math.min(y, ropeTop - MIN_ROPE);

  return {
    angle,
    trolley,
    hook: [crane.position[0] + Math.sin(angle) * trolley, y, crane.position[2] + Math.cos(angle) * trolley],
    loaded,
    // On through the hitch and the carry, off the moment the structure
    // takes the plate. Without the upper bound the spreader stayed on the
    // hook for the rest of the cycle and was left lying across the roof and
    // poking out through the slab edges on the way back to the yard.
    hitched: loaded || (t >= SLINGS_AT && t < HITCH_AT),
    slab: PLANK,
    rotation: overRoof
      ? 0
      : lerp(yardTurn(site), floor.rotation, smoothstep(0.28, 0.56, t)),
  };
}

/** Lifts still to come: plates in the pile that are spoken for. */
export function remainingSlabs(site: Site, f: number) {
  let n = 0;
  for (let i = 1; i < site.floors.length; i++) {
    if (floorProgress(i, f) < HITCH_AT) n++;
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
