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
  radius: 33,
  /** Fraction of the radius the camera slides left on wide screens. */
  shift: 0.25,
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
  /** Y of the slab's underside. */
  y: number;
  width: number;
  depth: number;
  /** Column footprints, relative to tower centre. */
  columns: [number, number][];
  /** Which faces are glazed: +x, -x, +z, -z. */
  glazed: [boolean, boolean, boolean, boolean];
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
  /** Bay that carries the ladders. */
  ladderBay: number;
  /** Lifts that are fully boarded. */
  boarded: number[];
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

export type Hoarding = {
  halfWidth: number;
  halfDepth: number;
  /** Panels are this wide. */
  panel: number;
  height: number;
  /** Side with the gate. */
  gateSide: Side;
  /** Side facing the visitor, carrying the banner. */
  bannerSide: Side;
  /** Where along that side the banner hangs. */
  bannerAlong: number;
};

export type Placed = { position: Vec3; rotationY: number };

export type Site = {
  seed: number;
  floors: Floor[];
  /** The unfinished top level: columns only, waiting for its slab. */
  topLevel: { y: number; columns: [number, number][]; width: number; depth: number };
  core: Core;
  scaffolds: ScaffoldRun[];
  lamps: Vec3[];
  crane: Crane;
  hoarding: Hoarding;
  cabin: Placed;
  generator: Placed;
  skip: Placed;
  rebar: Placed;
  pallets: Placed[];
  cones: Vec3[];
  puddles: { position: Vec3; radius: number }[];
  streetLights: Vec3[];
  totalHeight: number;
  /** Orbit angle (radians) from which the tower face is clear of scaffolding. */
  viewAngle: number;
  viewSide: Side;
  /** Which side of the crane the slab yard sits on, as seen from the crane. */
  yardSide: 1 | -1;
  /** The work lighting on this site. */
  lamp: Lamp;
};

export type Lamp = { name: string; color: string };

/** Each rebuild may switch the lighting rig. */
export const LAMPS: Lamp[] = [
  { name: "sodium", color: "#f5b043" },
  { name: "halogen", color: "#ffd2a1" },
  { name: "led", color: "#d7e6ff" },
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

  const floors: Floor[] = floorFlags.map((flag, index) => {
    const shrink = index * rnd.range(0.05, 0.25);
    const width = Math.max(5, baseWidth - shrink);
    const depth = Math.max(4, baseDepth - shrink * 0.6);
    const glazed = SIDES.map(() => flag.finished || rnd.chance(0.35)) as Floor["glazed"];
    return {
      index,
      y: index * FLOOR_HEIGHT,
      width,
      depth,
      columns: columnGrid(width, depth),
      glazed,
      finished: flag.finished,
    };
  });

  const topY = floors.length * FLOOR_HEIGHT;
  const last = floors[floors.length - 1];
  const topLevel = {
    y: topY,
    columns: columnGrid(last.width, last.depth).filter(() => rnd.chance(0.75)),
    width: last.width,
    depth: last.depth,
  };
  const totalHeight = topY + FLOOR_HEIGHT;

  // Scaffolding hugs one to three faces of the tower.
  const scaffoldSides = SIDES.filter(() => rnd.chance(0.55));
  if (scaffoldSides.length === 0) scaffoldSides.push(rnd.pick(SIDES));

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

  const gap = 0.75;
  const scaffolds: ScaffoldRun[] = scaffoldSides.map((side) => {
    const horizontal = side === "+z" || side === "-z";
    const span = (horizontal ? baseWidth : baseDepth) + 1.6;
    const offset = (horizontal ? baseDepth : baseWidth) / 2 + gap;
    const sign = side.startsWith("+") ? 1 : -1;
    const bays = Math.max(3, Math.round(span / 1.8));
    const lifts = Math.max(3, Math.round((topY + rnd.range(-FLOOR_HEIGHT, FLOOR_HEIGHT * 0.5)) / LIFT));
    const boarded: number[] = [];
    for (let l = 1; l <= lifts; l++) if (l % 2 === 0 || rnd.chance(0.3)) boarded.push(l);
    return {
      side,
      horizontal,
      sign,
      span,
      offset,
      bays,
      height: lifts * LIFT + 0.6,
      lifts,
      ladderBay: rnd.int(0, bays - 1),
      boarded,
      netted: rnd.chance(0.8),
    };
  });

  // Work lamps: a few clamped to the scaffold, one on a stand by the yard.
  const lamps: Vec3[] = [];
  for (let i = 0; i < 3; i++) {
    const run = rnd.pick(scaffolds);
    const lift = rnd.int(2, Math.max(2, run.lifts - 1));
    const along = -run.span / 2 + rnd.int(0, run.bays) * (run.span / run.bays);
    lamps.push(onSide(run.side, along, run.offset + 1.05, lift * LIFT - 0.3));
  }
  lamps.push([rnd.range(-6, 6), 2.6, rnd.range(baseDepth / 2 + 4, baseDepth / 2 + 8)]);

  // The lift and stair core rises inside the footprint, one storey ahead of the frame.
  const core: Core = {
    x: baseWidth * 0.2 * (rnd.chance(0.5) ? 1 : -1),
    z: -(baseDepth / 2 - 1.15) * (viewSide === "-z" ? -1 : 1),
    width: 2.1,
    depth: 1.9,
  };

  // Hoarding around the whole site, gate on the crane side, banner facing the visitor.
  const hoarding: Hoarding = {
    halfWidth: baseWidth / 2 + rnd.range(11, 13),
    halfDepth: baseDepth / 2 + rnd.range(10, 12),
    panel: 2.4,
    height: 2.1,
    gateSide: craneSide,
    bannerSide: viewSide,
    bannerAlong: 0,
  };

  // Site dressing lives away from the open viewing face so the tower stays clear.
  const backSides = SIDES.filter((s) => s !== viewSide);
  const cabinSide = rnd.pick(backSides.filter((s) => s !== craneSide));
  const cabin: Placed = {
    position: onSide(cabinSide, rnd.range(-3, 3), hoarding.halfDepth - 3.2),
    rotationY: SIDE_ANGLE[cabinSide] + Math.PI,
  };
  const generator: Placed = {
    position: [cranePosition[0] + rnd.range(-3, 3), 0, cranePosition[2] + rnd.range(2.5, 3.5) * craneSign],
    rotationY: rnd.range(0, Math.PI),
  };
  const skip: Placed = {
    position: onSide(viewSide, rnd.range(-7, -4) * (rnd.chance(0.5) ? 1 : -1), baseDepth / 2 + rnd.range(5, 7)),
    rotationY: SIDE_ANGLE[viewSide] + rnd.range(-0.3, 0.3),
  };
  const rebar: Placed = {
    position: onSide(viewSide, rnd.range(4, 7) * (skip.position[0] < 0 ? 1 : -1), baseDepth / 2 + rnd.range(3.5, 5.5)),
    rotationY: SIDE_ANGLE[viewSide] + rnd.range(-0.4, 0.4),
  };
  const pallets: Placed[] = Array.from({ length: rnd.int(2, 4) }, () => ({
    position: onSide(rnd.pick(backSides), rnd.range(-5, 5), baseDepth / 2 + rnd.range(3, 7)),
    rotationY: rnd.range(0, Math.PI),
  }));
  const cones: Vec3[] = Array.from({ length: rnd.int(4, 7) }, () =>
    onSide(rnd.pick(SIDES), rnd.range(-6, 6), baseDepth / 2 + rnd.range(2, 9)),
  );
  const puddles = Array.from({ length: rnd.int(2, 4) }, () => ({
    position: onSide(rnd.pick(SIDES), rnd.range(-7, 7), baseDepth / 2 + rnd.range(3, 9), 0.015) as Vec3,
    radius: rnd.range(1.4, 3),
  }));
  // Where the visitor's line of sight crosses the hoarding: the banner hangs
  // there, a little right of centre, and the street lights stay out of the shot.
  const viewHorizontal = viewSide === "+z" || viewSide === "-z";
  const halfOut = viewHorizontal ? hoarding.halfDepth : hoarding.halfWidth;
  const camAngle = viewAngle + HERO.angleOffset;
  const cam: [number, number] = [Math.sin(camAngle) * HERO.radius, Math.cos(camAngle) * HERO.radius];
  const right: [number, number] = [Math.cos(camAngle), -Math.sin(camAngle)];
  // Camera slides left by radius * shift; the frame centre crosses the fence at:
  const eye: [number, number] = [cam[0] - right[0] * HERO.radius * HERO.shift, cam[1] - right[1] * HERO.radius * HERO.shift];
  const outAxis: [number, number] = viewSide === "+z" ? [0, 1] : viewSide === "-z" ? [0, -1] : viewSide === "+x" ? [1, 0] : [-1, 0];
  const alongAxis: [number, number] = viewSide === "+z" ? [1, 0] : viewSide === "-z" ? [-1, 0] : viewSide === "+x" ? [0, -1] : [0, 1];
  const eyeOut = eye[0] * outAxis[0] + eye[1] * outAxis[1];
  const k = eyeOut > halfOut ? (eyeOut - halfOut) / eyeOut : 0;
  const cross: [number, number] = [eye[0] * (1 - k) - right[0] * 0.8, eye[1] * (1 - k) - right[1] * 0.8];
  const bannerAlong = cross[0] * alongAxis[0] + cross[1] * alongAxis[1];
  const rightAlong = right[0] * alongAxis[0] + right[1] * alongAxis[1];
  hoarding.bannerAlong = bannerAlong;
  const streetLights: Vec3[] = [
    onSide(viewSide, bannerAlong - Math.sign(rightAlong || 1) * 13, halfOut + 2.2),
    onSide(viewSide, bannerAlong + Math.sign(rightAlong || 1) * 11, halfOut + 2.2),
  ];

  return {
    seed,
    floors,
    topLevel,
    core,
    scaffolds,
    lamps,
    crane,
    hoarding,
    cabin,
    generator,
    skip,
    rebar,
    pallets,
    cones,
    puddles,
    streetLights,
    totalHeight,
    viewAngle,
    viewSide,
    yardSide: craneCorner === 1 ? -1 : 1,
    lamp: rnd.chance(0.55) ? LAMPS[0] : rnd.pick(LAMPS),
  };
}
