import { createRandom } from "./random";

/**
 * Storey height. Five floors on a 8.5m plate read as a low box next to the
 * reference, which is unmistakably a tower. Taller storeys and a narrower
 * plate take the proportion from roughly 2.3:1 to 3:1, and give the curtain
 * wall grid room to be a grid.
 */
export const FLOOR_HEIGHT = 3.55;
export const SLAB_THICKNESS = 0.32;
/** Scaffold lifts are half a storey. */
export const LIFT = FLOOR_HEIGHT / 2;

export type Vec3 = [number, number, number];

/**
 * The face the building is read from, and the corner the crane works off.
 *
 * Deliberately constants. See `generateSite`.
 */
const VIEW_SIDE: Side = "+z";
const CRANE_CORNER: 1 | -1 = -1;

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

/** Bays across the plan in each direction. Three reads as a frame; two reads as a shed. */
export const BAYS_X = 3;
export const BAYS_Z = 3;
/** How far the slab oversails the column centre line. */
export const SLAB_OVERHANG = 0.55;

/**
 * The column grid: a regular lattice on the plan, with the middle left out
 * where the core stands.
 *
 * A frame is only beautiful when the load path is legible, so the grid is
 * the same on every storey and the columns run dead straight from the base
 * to the top. The previous generator slid, cantilevered and twisted each
 * plate, which left columns landing on nothing — the eye reads that as
 * wrong long before it can say why.
 */
function columnGrid(width: number, depth: number): [number, number][] {
  const out: [number, number][] = [];
  const hx = width / 2 - SLAB_OVERHANG;
  const hz = depth / 2 - SLAB_OVERHANG;
  for (let i = 0; i <= BAYS_X; i++) {
    for (let j = 0; j <= BAYS_Z; j++) {
      const x = -hx + (2 * hx * i) / BAYS_X;
      const z = -hz + (2 * hz * j) / BAYS_Z;
      // The two middle intersections in each direction belong to the core.
      const innerX = i > 0 && i < BAYS_X;
      const innerZ = j > 0 && j < BAYS_Z;
      if (innerX && innerZ) continue;
      out.push([x, z]);
    }
  }
  return out;
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
  // A chunkier plate than the old tower. The building is read as an object
  // on a plinth, not a spire: about two to one overall.
  const baseWidth = rnd.range(10.4, 11.4);
  const baseDepth = rnd.range(9.4, 10.2);
  const count = floorFlags.length;

  /*
    The open face is the one the visitor looks at. The crane stands behind
    the building, off one corner, so it is beside the silhouette and never
    between the camera and the structure. Scaffolding takes the side faces.

    Fixed, not seeded. Rebuild changes the site; it does not change where
    you stand to look at it. Every load has to open on the same composition,
    and a seeded view side meant every rebuild was a different photograph of
    a different building.
  */
  const viewSide: Side = VIEW_SIDE;
  const craneSide = OPPOSITE[viewSide];
  const lateralSides = SIDES.filter((s) => s !== viewSide && s !== craneSide);
  const scaffoldSides = lateralSides.filter(() => rnd.chance(0.55));
  if (scaffoldSides.length === 0) scaffoldSides.push(rnd.pick(lateralSides));
  const craneHorizontal = craneSide === "+z" || craneSide === "-z";
  const craneSign = craneSide.startsWith("+") ? 1 : -1;
  // On the plinth, close enough that the jib reaches right over the building
  // and both are in the same shot. Standing it four metres clear put it off
  // the base entirely, in the black beside the model, which is why it never
  // looked like it was working on anything.
  const craneDistance = (craneHorizontal ? baseDepth : baseWidth) / 2 + rnd.range(1.4, 2.0);
  // Which corner the crane stands off, and so which hand the laydown is on.
  // Fixed with the view, for the same reason.
  const craneCorner = CRANE_CORNER;
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

  // Massing: one consistent frame, repeated.
  //
  // Every storey has the same plate on the same grid, and the columns run
  // dead straight from the base to the top. That is a deliberate reversal of
  // the previous generator, which slid, cantilevered and twisted each plate
  // to "read as decisions". It read as an impossible building instead: plates
  // floating, columns landing on nothing. The eye knows where load goes.
  //
  // What makes this worth looking at is not an irregular silhouette, it is
  // the state change running up it — finished and glazed below, bare frame
  // above, the work happening at the boundary.
  const grid = columnGrid(baseWidth, baseDepth);

  const floors: Floor[] = floorFlags.map((flag, index) => ({
    index,
    y: index * FLOOR_HEIGHT,
    width: baseWidth,
    depth: baseDepth,
    // Kept at rest so the timeline, crane and pointer keep their contract
    // while the shape stays honest.
    offset: [0, 0] as [number, number],
    extend: [0, 0, 0, 0] as Floor["extend"],
    void: null,
    rotation: 0,
    columns: grid,
    finished: flag.finished,
  }));

  const topY = count * FLOOR_HEIGHT;
  const last = floors[count - 1];
  const topLevel = {
    y: topY,
    columns: last.columns,
    width: last.width,
    depth: last.depth,
  };
  const totalHeight = topY + FLOOR_HEIGHT;

  const crane: Crane = {
    position: cranePosition,
    // Just enough to hoist a plate over the top columns. Any taller and the
    // jib spends the whole scroll above the frame, which is most of why the
    // crane read as something happening somewhere else.
    // Half a metre taller than it was. The hook hangs a full rigging below
    // the trolley now, and on a short mast over the top level that worked
    // out above the rope's own anchor.
    mastHeight: totalHeight + rnd.range(3.5, 4.3),
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

  // The lift core stands dead centre, in the hole the column grid leaves for
  // it. Every plate is the same, so there is nothing to solve: it simply
  // rises through all of them.
  const core: Core = {
    x: 0,
    z: 0,
    width: baseWidth * 0.34,
    depth: baseDepth * 0.30,
  };

  // The braced bay sits on a side face, off centre, on every floor.
  const viewHorizontal = viewSide === "+z" || viewSide === "-z";
  const sideFace: Side = viewHorizontal ? (Math.sin(viewAngle) >= 0 ? "+x" : "-x") : Math.cos(viewAngle) >= 0 ? "+z" : "-z";
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
