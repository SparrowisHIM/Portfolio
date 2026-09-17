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
  shift: 0.22,
} as const;

export type Side = "+x" | "-x" | "+z" | "-z";
export const SIDES: readonly Side[] = ["+x", "-x", "+z", "-z"] as const;

export const SIDE_ANGLE: Record<Side, number> = {
  "+z": 0,
  "+x": Math.PI / 2,
  "-z": Math.PI,
  "-x": -Math.PI / 2,
};

export type Floor = {
  index: number;
  /** Y of the floor plate's underside. */
  y: number;
  width: number;
  depth: number;
  /** Plate offset from the tower axis: floors do not stack dead square. */
  offset: [number, number];
  /** Extension per face (+x, -x, +z, -z): positive cantilevers, negative sets back. */
  extend: [number, number, number, number];
  /** A missing bay on one face, or null. */
  void: { face: 0 | 1 | 2 | 3; along: number; width: number } | null;
  /** Small twist of the whole plate, radians. */
  rotation: number;
  /** Column footprints, relative to the plate centre. */
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
};

export type Lamp = { name: string; color: string };

/** Each rebuild may switch the accent. */
export const LAMPS: Lamp[] = [
  { name: "amber", color: "#f5b043" },
  { name: "ember", color: "#ff8a3d" },
  { name: "arc", color: "#7fb4ff" },
];

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

export function generateSite(seed: number, floorFlags: { finished: boolean }[]): Site {
  const rnd = createRandom(seed);
  const baseWidth = rnd.range(7.5, 9);
  const baseDepth = rnd.range(5.5, 7);
  const count = floorFlags.length;

  // Controlled irregularity: a twisted floor, a floor with a void bay, and
  // cantilevers or setbacks on a few faces. Never more than one twist.
  const twisted = rnd.chance(0.7) ? rnd.int(1, count - 1) : -1;
  const voided = rnd.chance(0.75) ? rnd.int(1, count - 1) : -1;

  const floors: Floor[] = floorFlags.map((flag, index) => {
    const shrink = index * rnd.range(0.02, 0.18);
    const width = Math.max(5.5, baseWidth - shrink);
    const depth = Math.max(4.2, baseDepth - shrink * 0.6);
    const extend: Floor["extend"] = [0, 0, 0, 0];
    if (index > 0 && rnd.chance(0.45)) {
      const face = rnd.int(0, 3);
      extend[face] = rnd.chance(0.65) ? rnd.range(1.0, 2.0) : -rnd.range(0.8, 1.4);
    }
    const voidBay =
      index === voided
        ? {
            face: rnd.int(0, 3) as 0 | 1 | 2 | 3,
            along: rnd.range(-0.3, 0.3),
            width: rnd.range(1.6, 2.6),
          }
        : null;
    return {
      index,
      y: index * FLOOR_HEIGHT,
      width,
      depth,
      offset: index === 0 ? [0, 0] : [rnd.range(-0.55, 0.55), rnd.range(-0.4, 0.4)],
      extend,
      void: voidBay,
      rotation: index === twisted ? rnd.range(0.035, 0.07) * (rnd.chance(0.5) ? 1 : -1) : 0,
      columns: columnGrid(width, depth),
      finished: flag.finished,
    };
  });

  const topY = count * FLOOR_HEIGHT;
  const last = floors[count - 1];
  const topLevel = {
    y: topY,
    columns: columnGrid(last.width, last.depth).filter(() => rnd.chance(0.75)),
    width: last.width,
    depth: last.depth,
  };
  const totalHeight = topY + FLOOR_HEIGHT;

  // Scaffolding hugs one or two faces of the tower.
  const scaffoldSides = SIDES.filter(() => rnd.chance(0.45));
  if (scaffoldSides.length === 0) scaffoldSides.push(rnd.pick(SIDES));
  if (scaffoldSides.length > 2) scaffoldSides.length = 2;

  // Crane stands clear of the scaffolding.
  const free = SIDES.filter((s) => !scaffoldSides.includes(s));
  const craneSide = free.length ? rnd.pick(free) : rnd.pick(SIDES);
  const craneHorizontal = craneSide === "+z" || craneSide === "-z";
  const craneSign = craneSide.startsWith("+") ? 1 : -1;
  const craneDistance = (craneHorizontal ? baseDepth : baseWidth) / 2 + rnd.range(3.5, 5);
  const craneCorner = rnd.chance(0.5) ? 1 : -1;
  const craneAlong = craneCorner * ((craneHorizontal ? baseWidth : baseDepth) / 2 + rnd.range(0.5, 2));
  const cranePosition: Vec3 = craneHorizontal
    ? [craneAlong, 0, craneSign * craneDistance]
    : [craneSign * craneDistance, 0, craneAlong];
  const toTower = Math.atan2(-cranePosition[0], -cranePosition[2]);

  const crane: Crane = {
    position: cranePosition,
    mastHeight: totalHeight + rnd.range(6, 9),
    jibLength: craneDistance + rnd.range(7, 10),
    counterJibLength: rnd.range(4.5, 6),
    angle: toTower + rnd.range(-0.35, 0.35),
    trolley: craneDistance + rnd.range(-1, 1),
    hookDrop: rnd.range(3, 5),
  };

  // Look at the tower from an open face; the crane then sits to one side.
  const openSides = SIDES.filter((s) => !scaffoldSides.includes(s) && s !== craneSide);
  const viewSide = openSides.length ? rnd.pick(openSides) : craneSide;
  const craneAngle = Math.atan2(cranePosition[0], cranePosition[2]);
  let away = SIDE_ANGLE[viewSide] - craneAngle;
  away = Math.atan2(Math.sin(away), Math.cos(away));
  const viewAngle = SIDE_ANGLE[viewSide] + (away >= 0 ? 0.4 : -0.4);

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

  // The spine (lift core) rises inside the footprint, a storey ahead of the frame.
  const core: Core = {
    x: baseWidth * 0.2 * (rnd.chance(0.5) ? 1 : -1),
    z: -(baseDepth / 2 - 1.15) * (viewSide === "-z" ? -1 : 1),
    width: 2.0,
    depth: 1.8,
  };

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
  };
}
