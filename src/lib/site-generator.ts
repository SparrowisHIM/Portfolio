import { createRandom } from "./random";

export const FLOOR_HEIGHT = 3.2;
export const SLAB_THICKNESS = 0.32;
/** Scaffold lifts are half a storey. */
export const LIFT = FLOOR_HEIGHT / 2;

export type Vec3 = [number, number, number];

/** The ground-level shot: where the visitor stands when they arrive. */
export const HERO = {
  /** Orbit angle relative to the site's view angle. */
  angleOffset: -0.47,
  radius: 30,
  /** Fraction of the radius the camera slides left on wide screens. */
  shift: 0.17,
} as const;

export type Side = "+x" | "-x" | "+z" | "-z";
export const SIDES: readonly Side[] = ["+x", "-x", "+z", "-z"] as const;

export const SIDE_ANGLE: Record<Side, number> = {
  "+z": 0,
  "+x": Math.PI / 2,
  "-z": Math.PI,
  "-x": -Math.PI / 2,
};

const OPPOSITE: Record<Side, Side> = { "+x": "-x", "-x": "+x", "+z": "-z", "-z": "+z" };

/** Face index (+x, -x, +z, -z) for a side, as used by `extend` and `void`. */
export const SIDE_FACE: Record<Side, 0 | 1 | 2 | 3> = { "+x": 0, "-x": 1, "+z": 2, "-z": 3 };

export type Floor = {
  index: number;
  /** Y of the floor plate's underside. */
  y: number;
  width: number;
  depth: number;
  /** Plate offset from the tower axis: the masses do not stack dead square. */
  offset: [number, number];
  /** Extension per face (+x, -x, +z, -z): positive cantilevers, negative sets back. */
  extend: [number, number, number, number];
  /** A missing bay on one face, or null. */
  void: { face: 0 | 1 | 2 | 3; along: number; width: number } | null;
  /** Small twist of the whole plate, radians. */
  rotation: number;
  /** Column footprints in world x/z. Columns run straight up through the stack. */
  columns: [number, number][];
  finished: boolean;
};

export type ScaffoldRun = {
  side: Side;
  /** The run lies along x (it stands on a ±z face). */
  horizontal: boolean;
  sign: 1 | -1;
  /** Length along the face. */
  span: number;
  /** Distance from tower centre to the inner row of standards. */
  offset: number;
  bays: number;
  /** Top of the standards. */
  height: number;
  lifts: number;
  /** Debris netting hangs on the outer face. */
  netted: boolean;
};

export type Crane = {
  position: Vec3;
  mastHeight: number;
  jibLength: number;
  counterJibLength: number;
  /** Initial slew angle in radians. */
  angle: number;
  /** Trolley distance along the jib. */
  trolley: number;
  hookDrop: number;
};

export type Core = { x: number; z: number; width: number; depth: number };

export type Site = {
  seed: number;
  floors: Floor[];
  /** The unfinished top level: columns only, waiting for its frame. */
  topLevel: { y: number; columns: [number, number][]; width: number; depth: number };
  core: Core;
  scaffolds: ScaffoldRun[];
  crane: Crane;
  totalHeight: number;
  /** Orbit angle (radians) from which the tower face is clear of scaffolding. */
  viewAngle: number;
  viewSide: Side;
  /** Which side of the crane the yard sits on, as seen from the crane. */
  yardSide: 1 | -1;
  /** The accent light on this site. */
  lamp: Lamp;
  /** The one bay that carries a cross brace on every floor: face and range along it. */
  bracedBay: { face: 0 | 1 | 2 | 3; s0: number; s1: number };
};

export type Lamp = { name: string; color: string };

/** Each rebuild may switch the accent. */
export const LAMPS: Lamp[] = [
  { name: "amber", color: "#f5b043" },
  { name: "ember", color: "#ff8a3d" },
  { name: "arc", color: "#7fb4ff" },
];

/** The column grid of the whole building: four corners and a mid column on the long faces. */
function columnGrid(width: number, depth: number): [number, number][] {
  const hx = width / 2 - 0.35;
  const hz = depth / 2 - 0.35;
  return [
    [-hx, -hz],
    [hx, -hz],
    [-hx, hz],
    [hx, hz],
    [0, -hz],
    [0, hz],
  ];
}

/** World position on a given side of the tower, `along` the face and `out` from it. */
export function onSide(side: Side, along: number, out: number, y = 0): Vec3 {
  switch (side) {
    case "+z":
      return [along, y, out];
    case "-z":
      return [-along, y, -out];
    case "+x":
      return [out, y, -along];
    case "-x":
      return [-out, y, along];
  }
}

/** The grid columns that fall inside a plate, plus the plate's own corners where the grid does not reach. */
function columnsFor(grid: [number, number][], offset: [number, number], rotation: number, width: number, depth: number): [number, number][] {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  const inside: [number, number][] = grid.filter(([x, z]) => {
    const dx = x - offset[0];
    const dz = z - offset[1];
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    return Math.abs(lx) <= width / 2 - 0.1 && Math.abs(lz) <= depth / 2 - 0.1;
  });
  const hx = width / 2 - 0.35;
  const hz = depth / 2 - 0.35;
  for (const [lx, lz] of [
    [-hx, -hz],
    [hx, -hz],
    [-hx, hz],
    [hx, hz],
  ]) {
    const wx = offset[0] + lx * c - lz * s;
    const wz = offset[1] + lx * s + lz * c;
    if (inside.every(([x, z]) => Math.hypot(x - wx, z - wz) > 0.9)) inside.push([wx, wz]);
  }
  return inside;
}

export function generateSite(seed: number, floorFlags: { finished: boolean }[]): Site {
  const rnd = createRandom(seed);
  const baseWidth = rnd.range(7.5, 9);
  const baseDepth = rnd.range(5.5, 7);
  const count = floorFlags.length;

  // The open face is the one the visitor looks at. The crane stands behind
  // the building, off one corner, so it is beside the silhouette and never
  // between the camera and the structure. Scaffolding takes the side faces.
  const viewSide = rnd.pick(SIDES);
  const craneSide = OPPOSITE[viewSide];
  const lateralSides = SIDES.filter((s) => s !== viewSide && s !== craneSide);
  const scaffoldSides = lateralSides.filter(() => rnd.chance(0.55));
  if (scaffoldSides.length === 0) scaffoldSides.push(rnd.pick(lateralSides));
  const craneHorizontal = craneSide === "+z" || craneSide === "-z";
  const craneSign = craneSide.startsWith("+") ? 1 : -1;
  const craneDistance = (craneHorizontal ? baseDepth : baseWidth) / 2 + rnd.range(3.5, 5);
  const craneCorner = rnd.chance(0.5) ? 1 : -1;
  const craneAlong = craneCorner * ((craneHorizontal ? baseWidth : baseDepth) / 2 + rnd.range(0.5, 2));
  const cranePosition: Vec3 = craneHorizontal
    ? [craneAlong, 0, craneSign * craneDistance]
    : [craneSign * craneDistance, 0, craneAlong];
  const toTower = Math.atan2(-cranePosition[0], -cranePosition[2]);

  // Stand a little to the side the crane is on, so its mast clears the
  // silhouette and reads beside the building rather than through it.
  const craneAngle = Math.atan2(cranePosition[0], cranePosition[2]);
  let away = SIDE_ANGLE[viewSide] - craneAngle;
  away = Math.atan2(Math.sin(away), Math.cos(away));
  const viewAngle = SIDE_ANGLE[viewSide] + (away >= 0 ? -0.4 : 0.4);

  // Massing: three moves that read as decisions, not per-floor noise.
  //   podium    floors 0..podiumTop         on axis, full footprint
  //   shifted   floors podiumTop+1..upperFrom-1  slide sideways as one block; the
  //             top of them cantilevers toward the camera; one loses a bay
  //   upper     floors upperFrom..count-1   a narrower mass set to one side, the
  //             topmost plate twisted
  // Two masses, not three. Five storeys cannot carry three zones — you get
  // one floor each and none of them reads. A wide lower mass and a clearly
  // narrower upper one set to a single edge is a silhouette you can name.
  const podiumTop = 0;
  const upperFrom = Math.max(2, count - 2);
  const viewHorizontal = viewSide === "+z" || viewSide === "-z";
  // The camera stands to one side of the open face; that side face is in shot.
  const camX = Math.sin(viewAngle);
  const camZ = Math.cos(viewAngle);
  const sideFace: Side = viewHorizontal ? (camX >= 0 ? "+x" : "-x") : camZ >= 0 ? "+z" : "-z";
  // Lateral is along the open face, so the shift reads as a slide across the shot.
  const lateral: [number, number] = viewHorizontal ? [1, 0] : [0, 1];
  const normal: [number, number] = viewHorizontal ? [0, 1] : [1, 0];
  const shiftSign = rnd.chance(0.5) ? 1 : -1;
  // A move only reads as a decision if it is big against the footprint. The
  // old slide was about a twelfth of the width, which looks like a mistake.
  // But it cannot be so big that the upper mass leaves the grid underneath
  // it: the columns would stop and restart somewhere else, and the building
  // reads as floating trays instead of one structure.
  const shiftAmount = rnd.range(1.4, 1.9) * shiftSign;
  const drift = rnd.range(-0.3, 0.3);
  const shift: [number, number] = [lateral[0] * shiftAmount + normal[0] * drift, lateral[1] * shiftAmount + normal[1] * drift];
  const lateralBase = viewHorizontal ? baseWidth : baseDepth;
  const upperScale = rnd.range(0.48, 0.58);
  const upperLateral = lateralBase * upperScale;
  // The upper mass goes flush with the edge the block already slid toward,
  // so the slide and the setback are one gesture rather than two.
  const flush = shiftSign * ((lateralBase - upperLateral) / 2);
  const upperOffset: [number, number] = [shift[0] + lateral[0] * flush, shift[1] + lateral[1] * flush];
  const cantileverFloor = upperFrom - 1;
  const cantilever = rnd.range(3.2, 4.4);
  // The void runs through two storeys so it reads as a slot cut through the
  // building rather than a gap in one line.
  const voidFloor = Math.max(1, cantileverFloor - 1);
  // Compounding, so a gentle angle per plate still spirals by the top.
  const twist = rnd.range(0.05, 0.08) * (rnd.chance(0.5) ? 1 : -1);

  // One slot, same place on both storeys, so it lines up into a hole.
  const voidAlong = rnd.range(-0.22, 0.22);
  const voidWidth = rnd.range(3.0, 4.2);

  const grid = columnGrid(baseWidth, baseDepth);

  const floors: Floor[] = floorFlags.map((flag, index) => {
    const upper = index >= upperFrom;
    const mid = !upper && index > podiumTop;
    const width = upper && viewHorizontal ? upperLateral : baseWidth;
    const depth = upper && !viewHorizontal ? upperLateral : baseDepth;
    const offset: [number, number] = upper ? upperOffset : mid ? shift : [0, 0];
    const extend: Floor["extend"] = [0, 0, 0, 0];
    if (index === cantileverFloor) extend[SIDE_FACE[viewSide]] = cantilever;
    // The upper mass turns a little more with every plate, so the corners
    // spiral instead of one storey sitting askew.
    const rotation = upper ? twist * (index - upperFrom + 1) : 0;
    return {
      index,
      y: index * FLOOR_HEIGHT,
      width,
      depth,
      offset,
      extend,
      void:
        index === voidFloor || index === voidFloor + 1
          ? { face: SIDE_FACE[sideFace], along: voidAlong, width: voidWidth }
          : null,
      rotation,
      // Columns are dead vertical and take the mass offset but not the
      // twist: the grid runs straight through the stack and the plates turn
      // around it. Rotating the columns too gave every floor its own corner
      // posts, standing on nothing, which is what made the building read as
      // a pile of floating trays.
      columns: columnsFor(grid, offset, 0, width, depth),
      finished: flag.finished,
    };
  });

  const topY = count * FLOOR_HEIGHT;
  const last = floors[count - 1];
  const topLevel = {
    y: topY,
    columns: last.columns.filter(() => rnd.chance(0.75)),
    width: last.width,
    depth: last.depth,
  };
  const totalHeight = topY + FLOOR_HEIGHT;

  const crane: Crane = {
    position: cranePosition,
    mastHeight: totalHeight + rnd.range(6, 9),
    jibLength: craneDistance + rnd.range(7, 10),
    counterJibLength: rnd.range(4.5, 6),
    angle: toTower + rnd.range(-0.35, 0.35),
    trolley: craneDistance + rnd.range(-1, 1),
    hookDrop: rnd.range(3, 5),
  };

  const gap = 0.9;
  const scaffolds: ScaffoldRun[] = scaffoldSides.map((side) => {
    const horizontal = side === "+z" || side === "-z";
    const span = (horizontal ? baseWidth : baseDepth) + 2.2;
    const offset = (horizontal ? baseDepth : baseWidth) / 2 + gap;
    const sign = side.startsWith("+") ? 1 : -1;
    const bays = Math.max(3, Math.round(span / 2.1));
    const lifts = Math.max(3, Math.round((topY + rnd.range(-FLOOR_HEIGHT, FLOOR_HEIGHT * 0.5)) / LIFT));
    return {
      side,
      horizontal,
      sign,
      span,
      offset,
      bays,
      height: lifts * LIFT + 0.6,
      lifts,
      netted: rnd.chance(0.7),
    };
  });

  // The spine (lift core) rises through every plate, so it sits inside the
  // footprint they all share, pushed to the back away from the open face.
  let xMin = -Infinity;
  let xMax = Infinity;
  let zMin = -Infinity;
  let zMax = Infinity;
  for (const f of floors) {
    xMin = Math.max(xMin, f.offset[0] - f.width / 2);
    xMax = Math.min(xMax, f.offset[0] + f.width / 2);
    zMin = Math.max(zMin, f.offset[1] - f.depth / 2);
    zMax = Math.min(zMax, f.offset[1] + f.depth / 2);
  }
  const coreSize = { width: 2.0, depth: 1.8 };
  const back = { x: -camX, z: -camZ };
  const wantX = (xMin + xMax) / 2 + back.x * (xMax - xMin) * 0.3;
  const wantZ = (zMin + zMax) / 2 + back.z * (zMax - zMin) * 0.3;
  const clampIn = (v: number, lo: number, hi: number, half: number) => Math.min(Math.max(v, lo + half + 0.45), hi - half - 0.45);
  const core: Core = {
    x: clampIn(wantX, xMin, xMax, coreSize.width / 2),
    z: clampIn(wantZ, zMin, zMax, coreSize.depth / 2),
    ...coreSize,
  };

  // The braced bay sits on the side face, off centre, on every floor.
  const bracedBay = { face: SIDE_FACE[sideFace], s0: rnd.range(0.18, 0.46), s1: 0 };
  bracedBay.s1 = bracedBay.s0 + rnd.range(0.14, 0.19);

  return {
    seed,
    floors,
    topLevel,
    core,
    scaffolds,
    crane,
    totalHeight,
    viewAngle,
    viewSide,
    yardSide: craneCorner === 1 ? -1 : 1,
    lamp: rnd.chance(0.6) ? LAMPS[0] : rnd.pick(LAMPS),
    bracedBay,
  };
}
