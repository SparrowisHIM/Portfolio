import { createRandom } from "./random";

export const FLOOR_HEIGHT = 3.2;
export const SLAB_THICKNESS = 0.32;

export type Vec3 = [number, number, number];

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

export type Pole = { position: Vec3; height: number };
export type Ledger = { position: Vec3; length: number; axis: "x" | "z" };
export type Plank = { position: Vec3; length: number; axis: "x" | "z" };

export type Crane = {
  position: Vec3;
  mastHeight: number;
  jibLength: number;
  counterJibLength: number;
  /** Initial slew angle in radians. */
  angle: number;
  /** Trolley distance along the jib. */
  trolley: number;
  /** How far the hanging slab is below the jib. */
  hookDrop: number;
};

export type Site = {
  seed: number;
  floors: Floor[];
  /** The unfinished top level: columns only, waiting for its slab. */
  topLevel: { y: number; columns: [number, number][]; width: number; depth: number };
  poles: Pole[];
  ledgers: Ledger[];
  planks: Plank[];
  lamps: Vec3[];
  crane: Crane;
  totalHeight: number;
  /** Orbit angle (radians) from which the tower face is clear of scaffolding. */
  viewAngle: number;
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

const SIDE_ANGLE: Record<(typeof SIDES)[number], number> = {
  "+z": 0,
  "+x": Math.PI / 2,
  "-z": Math.PI,
  "-x": -Math.PI / 2,
};

const SIDES = ["+x", "-x", "+z", "-z"] as const;

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

export function generateSite(
  seed: number,
  floorFlags: { finished: boolean }[],
): Site {
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
  const poles: Pole[] = [];
  const ledgers: Ledger[] = [];
  const planks: Plank[] = [];
  const scaffoldSides = SIDES.filter(() => rnd.chance(0.55));
  if (scaffoldSides.length === 0) scaffoldSides.push(rnd.pick(SIDES));

  const gap = 0.9;
  for (const side of scaffoldSides) {
    const horizontal = side === "+z" || side === "-z";
    const span = (horizontal ? baseWidth : baseDepth) + 1.2;
    const offset = (horizontal ? baseDepth : baseWidth) / 2 + gap;
    const sign = side.startsWith("+") ? 1 : -1;
    const bays = Math.max(3, Math.round(span / 1.7));
    const step = span / bays;
    const scaffoldHeight =
      topY + rnd.range(-FLOOR_HEIGHT * 1.2, FLOOR_HEIGHT * 0.6);
    const levels = Math.floor(scaffoldHeight / (FLOOR_HEIGHT / 2));

    for (let i = 0; i <= bays; i++) {
      const along = -span / 2 + i * step;
      const height = scaffoldHeight - rnd.range(0, 1.2);
      for (const inner of [0, 0.9]) {
        const across = sign * (offset + inner);
        poles.push({
          position: horizontal ? [along, 0, across] : [across, 0, along],
          height,
        });
      }
    }
    for (let l = 1; l <= levels; l++) {
      const y = l * (FLOOR_HEIGHT / 2);
      for (const inner of [0, 0.9]) {
        const across = sign * (offset + inner);
        ledgers.push({
          position: horizontal ? [0, y, across] : [across, y, 0],
          length: span,
          axis: horizontal ? "x" : "z",
        });
      }
      if (l % 2 === 0 && rnd.chance(0.7)) {
        const across = sign * (offset + 0.45);
        const plankSpan = span * rnd.range(0.45, 1);
        const along = rnd.range(-(span - plankSpan) / 2, (span - plankSpan) / 2);
        planks.push({
          position: horizontal ? [along, y + 0.05, across] : [across, y + 0.05, along],
          length: plankSpan,
          axis: horizontal ? "x" : "z",
        });
      }
    }
  }

  // Work lamps: a few on the scaffold, one on the ground.
  const lamps: Vec3[] = [];
  const lampCount = 3;
  for (let i = 0; i < lampCount; i++) {
    const pole = rnd.pick(poles);
    if (!pole) break;
    const level = rnd.int(1, Math.max(1, Math.floor(pole.height / FLOOR_HEIGHT)));
    lamps.push([pole.position[0], level * FLOOR_HEIGHT - 0.6, pole.position[2]]);
  }
  lamps.push([rnd.range(-6, 6), 0.5, rnd.range(baseDepth / 2 + 4, baseDepth / 2 + 8)]);

  // Crane stands clear of the scaffolding.
  const free = SIDES.filter((s) => !scaffoldSides.includes(s));
  const craneSide = free.length ? rnd.pick(free) : rnd.pick(SIDES);
  const craneHorizontal = craneSide === "+z" || craneSide === "-z";
  const craneSign = craneSide.startsWith("+") ? 1 : -1;
  const craneDistance = (craneHorizontal ? baseDepth : baseWidth) / 2 + rnd.range(3.5, 5);
  // Cranes stand at a corner of the site, not in front of the building.
  const craneCorner = rnd.chance(0.5) ? 1 : -1;
  const craneAlong = craneCorner * ((craneHorizontal ? baseWidth : baseDepth) / 2 + rnd.range(0.5, 2));
  const cranePosition: Vec3 = craneHorizontal
    ? [craneAlong, 0, craneSign * craneDistance]
    : [craneSign * craneDistance, 0, craneAlong];
  const toTower = Math.atan2(-cranePosition[0], -cranePosition[2]);

  const crane: Crane = {
    position: cranePosition,
    mastHeight: totalHeight + rnd.range(5, 8),
    jibLength: craneDistance + rnd.range(6, 9),
    counterJibLength: rnd.range(4, 5.5),
    angle: toTower + rnd.range(-0.35, 0.35),
    trolley: craneDistance + rnd.range(-1, 1),
    hookDrop: rnd.range(3, 5),
  };

  // Look at the tower from an open face; the crane then sits to one side.
  const openSides = SIDES.filter((s) => !scaffoldSides.includes(s) && s !== craneSide);
  const viewSide = openSides.length ? rnd.pick(openSides) : craneSide;
  // Nudge the view towards the corner away from the crane so the mast never
  // splits the frame.
  const craneAngle = Math.atan2(cranePosition[0], cranePosition[2]);
  let away = SIDE_ANGLE[viewSide] - craneAngle;
  away = Math.atan2(Math.sin(away), Math.cos(away));
  const viewAngle = SIDE_ANGLE[viewSide] + (away >= 0 ? 0.4 : -0.4);

  return {
    seed,
    floors,
    topLevel,
    poles,
    ledgers,
    planks,
    lamps,
    crane,
    totalHeight,
    viewAngle,
    yardSide: craneCorner === 1 ? -1 : 1,
    lamp: rnd.chance(0.55) ? LAMPS[0] : rnd.pick(LAMPS),
  };
}
