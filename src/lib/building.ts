import { FLOOR_HEIGHT, SLAB_OVERHANG, type Core, type Site } from "./site-generator";
import { createRandom, type Random } from "./random";

/**
 * The building, as a flat list of placed boxes.
 *
 * This is a concrete frame: square columns on a regular grid running dead
 * straight from the base to the top, flat slabs that oversail them, and a
 * lift core standing in the hole the grid leaves for it. Nothing slides,
 * cantilevers or twists. The load path is legible on purpose — a frame only
 * looks right when you can see where the weight goes, and the floating
 * plates of the previous generator read as wrong long before you could say
 * why.
 *
 * What carries the interest is not the silhouette, it is the state change
 * running up the tower: glazed and inhabited below, bare frame above, and the
 * work happening at the line between them. The top two storeys never glaze,
 * so the building is always visibly unfinished.
 *
 * Every part names the floor whose progress owns it and the point in that
 * progress when it arrives, so the renderer can place the whole building
 * from one scalar per floor.
 */

/** Concrete column, square. */
export const COLUMN = 0.44;
/** Slab thickness. The strongest horizontal in the building. */
export const SLAB = 0.34;
/** Core wall. */
export const CORE_WALL = 0.3;
/** Edge protection: top rail height above the slab. */
export const RAIL_H = 1.1;
export const RAIL = 0.05;
/** Starter bars left standing out of the topmost columns. */
export const STARTER = 0.036;
export const STARTER_LEN = 0.78;
/** Curtain wall. */
export const MULLION = 0.075;
export const GLASS = 0.04;
/** Panes per structural bay. */
export const PANES_PER_BAY = 3;

/**
 * How many levels the frame has to climb above a storey before that storey
 * is glazed. Two is what the reference shows, and it is also what keeps the
 * top of the building permanently raw.
 */
export const CLAD_LAG = 2;

export type Vec3 = [number, number, number];

export type PartKind =
  /** Concrete frame. */
  | "column"
  | "slab"
  | "core"
  /** Curtain wall. */
  | "glass"
  | "mullion"
  /** Inside a finished storey. */
  | "ceiling"
  | "fitout"
  /** Dressing on storeys that are still being worked. */
  | "rail"
  | "starter"
  | "stack";

export type Part = {
  kind: PartKind;
  /** Whose progress places this part. */
  floor: number;
  /** Floor-local progress at which it arrives, 0..1. */
  at: number;
  /**
   * Optionally taken away again: edge protection comes off a storey when the
   * glazing goes into it, which is both true and what makes the glazed line
   * read as finished.
   */
  offFloor?: number;
  offAt?: number;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  /**
   * How far above its home the part starts before settling in. A slab comes
   * down off the hook, so it falls; a starter bar is cast in and does not.
   */
  drop: number;
};

/** Top of the slab that caps storey `index`. */
export function slabTop(index: number) {
  return index * FLOOR_HEIGHT;
}

/** The clear storey sitting on slab `index`. */
export function storey(index: number) {
  return { bottom: slabTop(index), top: slabTop(index + 1) - SLAB };
}

function coreFaces(core: Core): { position: Vec3; scale: Vec3 }[] {
  const hw = core.width / 2;
  const hd = core.depth / 2;
  return [
    { position: [core.x, 0, core.z - hd], scale: [core.width, 1, CORE_WALL] },
    { position: [core.x, 0, core.z + hd], scale: [core.width, 1, CORE_WALL] },
    { position: [core.x - hw, 0, core.z], scale: [CORE_WALL, 1, core.depth - CORE_WALL * 2] },
    { position: [core.x + hw, 0, core.z], scale: [CORE_WALL, 1, core.depth - CORE_WALL * 2] },
  ];
}

/** The four curtain wall lines, set back to the column grid so the slab oversails. */
function facades(width: number, depth: number) {
  const hx = width / 2 - SLAB_OVERHANG;
  const hz = depth / 2 - SLAB_OVERHANG;
  return [
    { axis: "x" as const, half: hx, at: -hz, rotationY: 0 },
    { axis: "x" as const, half: hx, at: hz, rotationY: 0 },
    { axis: "z" as const, half: hz, at: -hx, rotationY: Math.PI / 2 },
    { axis: "z" as const, half: hz, at: hx, rotationY: Math.PI / 2 },
  ];
}

export function buildParts(site: Site): Part[] {
  const parts: Part[] = [];
  const rnd = createRandom(site.seed ^ 0x5eed);
  const push = (p: Part) => parts.push(p);

  const levels = site.floors.length;

  for (let index = 0; index <= levels; index++) {
    const floor = site.floors[Math.min(index, levels - 1)];
    const top = slabTop(index);
    const isCap = index === levels;
    const columns = isCap ? site.topLevel.columns : floor.columns;

    // --- columns: the storey below this slab -----------------------------
    // Cast before the slab lands on them, which is also the order you would
    // watch it happen.
    if (index > 0) {
      const base = slabTop(index - 1);
      const height = top - SLAB - base;
      for (const [cx, cz] of columns) {
        push({
          kind: "column",
          floor: index,
          at: 0.06,
          position: [cx, base + height / 2, cz],
          scale: [COLUMN, height, COLUMN],
          rotationY: 0,
          drop: 0,
        });
      }
    }

    // --- the slab --------------------------------------------------------
    // The one part that genuinely arrives on the hook, so it is the one that
    // falls into place. PLACED_AT in construction.ts is when the crane lets
    // go, so that is when this has to land.
    push({
      kind: "slab",
      floor: index,
      at: index === 0 ? 0 : 0.66,
      position: [0, top - SLAB / 2, 0],
      scale: [floor.width, SLAB, floor.depth],
      rotationY: 0,
      drop: index === 0 ? 0 : 0.9,
    });

    // --- the core --------------------------------------------------------
    // It climbs a storey ahead of the frame, the way a slip-formed core does.
    if (index < levels) {
      const { bottom } = storey(index);
      for (const face of coreFaces(site.core)) {
        push({
          kind: "core",
          floor: index,
          at: 0.02,
          position: [face.position[0], bottom + FLOOR_HEIGHT / 2, face.position[2]],
          scale: [face.scale[0], FLOOR_HEIGHT, face.scale[2]],
          rotationY: 0,
          drop: 0,
        });
      }
    }

    // --- the storey standing on this slab --------------------------------
    if (index < levels) {
      const cladBy = index + CLAD_LAG;
      const glazed = cladBy <= levels;
      addStorey(push, rnd, site, index, glazed ? cladBy : null);
    }

    // --- starter bars ----------------------------------------------------
    // Rebar left standing out of the top of the last pour. It is the detail
    // that says the building is not finished: another storey is coming.
    if (isCap) {
      for (const [cx, cz] of columns) {
        const n = 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + 0.4;
          const r = COLUMN * 0.3;
          push({
            kind: "starter",
            floor: index,
            at: 0.1,
            position: [cx + Math.cos(a) * r, top + STARTER_LEN / 2, cz + Math.sin(a) * r],
            scale: [STARTER, STARTER_LEN, STARTER],
            rotationY: 0,
            drop: 0,
          });
        }
      }
    }
  }

  return parts;
}

/**
 * Everything that happens on top of slab `index`: edge protection first,
 * then — if the frame ever climbs far enough above it — the curtain wall,
 * the lit ceiling and the fit-out, with the edge protection coming off as
 * the glass goes in.
 */
function addStorey(
  push: (p: Part) => void,
  rnd: Random,
  site: Site,
  index: number,
  cladBy: number | null,
) {
  const floor = site.floors[index];
  const top = slabTop(index);
  const { bottom, top: head } = storey(index);
  const clear = head - bottom;

  // --- edge protection ---------------------------------------------------
  // Orange rail round the slab as soon as it is down, off again when the
  // glazing arrives.
  if (index > 0) {
    const hw = floor.width / 2 - 0.12;
    const hd = floor.depth / 2 - 0.12;
    const runs: { from: [number, number]; to: [number, number] }[] = [
      { from: [-hw, -hd], to: [hw, -hd] },
      { from: [-hw, hd], to: [hw, hd] },
      { from: [-hw, -hd], to: [-hw, hd] },
      { from: [hw, -hd], to: [hw, hd] },
    ];
    for (const run of runs) {
      const dx = run.to[0] - run.from[0];
      const dz = run.to[1] - run.from[1];
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      const off = cladBy === null ? {} : { offFloor: cladBy, offAt: 0.28 };
      for (const h of [RAIL_H, RAIL_H * 0.55]) {
        push({
          kind: "rail",
          floor: index,
          at: 0.74,
          ...off,
          position: [(run.from[0] + run.to[0]) / 2, top + h, (run.from[1] + run.to[1]) / 2],
          scale: [RAIL, RAIL, len],
          rotationY: angle,
          drop: 0,
        });
      }
      const posts = Math.max(2, Math.round(len / 2.1));
      for (let i = 0; i <= posts; i++) {
        const t = i / posts;
        push({
          kind: "rail",
          floor: index,
          at: 0.72,
          ...off,
          position: [run.from[0] + dx * t, top + RAIL_H / 2, run.from[1] + dz * t],
          scale: [RAIL, RAIL_H, RAIL],
          rotationY: angle,
          drop: 0,
        });
      }
    }
  }

  // --- material stacked on the open floor --------------------------------
  // Pallets waiting to be placed: evidence that someone works here. They go
  // when the floor is handed over.
  if (index > 0) {
    const piles = 1 + (rnd.next() > 0.55 ? 1 : 0);
    for (let i = 0; i < piles; i++) {
      const side = rnd.next() > 0.5 ? 1 : -1;
      const h = rnd.range(0.22, 0.42);
      push({
        kind: "stack",
        floor: index,
        at: 0.8,
        ...(cladBy === null ? {} : { offFloor: cladBy, offAt: 0.2 }),
        position: [
          side * rnd.range(floor.width * 0.18, floor.width * 0.32),
          top + h / 2,
          rnd.range(-floor.depth * 0.3, floor.depth * 0.3),
        ],
        scale: [rnd.range(1.5, 2.2), h, rnd.range(0.9, 1.3)],
        rotationY: rnd.range(-0.2, 0.2),
        drop: 0,
      });
    }
  }

  if (cladBy === null) return;

  // --- curtain wall ------------------------------------------------------
  // Floor to ceiling, in panes, with a slim mullion on every joint. The
  // glass sits back on the column line so the slab reads as a band running
  // right round the building — that band is the building's strongest line.
  for (const face of facades(floor.width, floor.depth)) {
    const span = face.half * 2;
    const panes = Math.max(3, Math.round((span / (span / 3)) * PANES_PER_BAY));
    const paneWidth = span / panes;
    const midY = bottom + clear / 2;

    for (let i = 0; i < panes; i++) {
      const along = -face.half + paneWidth * (i + 0.5);
      const pos: Vec3 =
        face.axis === "x" ? [along, midY, face.at] : [face.at, midY, along];
      push({
        kind: "glass",
        floor: cladBy,
        at: 0.3 + (i / panes) * 0.16,
        position: pos,
        scale:
          face.axis === "x"
            ? [paneWidth - MULLION, clear - 0.04, GLASS]
            : [GLASS, clear - 0.04, paneWidth - MULLION],
        rotationY: 0,
        drop: 0,
      });
    }
    // Mullions on every joint including the two ends.
    for (let i = 0; i <= panes; i++) {
      const along = -face.half + paneWidth * i;
      const pos: Vec3 =
        face.axis === "x" ? [along, midY, face.at] : [face.at, midY, along];
      push({
        kind: "mullion",
        floor: cladBy,
        at: 0.28,
        position: pos,
        scale:
          face.axis === "x"
            ? [MULLION, clear, MULLION * 1.4]
            : [MULLION * 1.4, clear, MULLION],
        rotationY: 0,
        drop: 0,
      });
    }
    // Head and sill, so the wall is a framed system rather than loose sheets.
    for (const y of [bottom + 0.05, head - 0.05]) {
      push({
        kind: "mullion",
        floor: cladBy,
        at: 0.26,
        position: face.axis === "x" ? [0, y, face.at] : [face.at, y, 0],
        scale: face.axis === "x" ? [span, MULLION, MULLION * 1.4] : [MULLION * 1.4, MULLION, span],
        rotationY: 0,
        drop: 0,
      });
    }
  }

  // --- the light inside --------------------------------------------------
  // The warm glow through the glass is the whole reason a finished floor
  // reads as alive. It comes from emissive ceiling runs rather than lights,
  // because a light per storey would cost a lighting pass per storey for a
  // look that is really just a bright surface seen through dark glass.
  const hx = floor.width / 2 - SLAB_OVERHANG - 0.5;
  const hz = floor.depth / 2 - SLAB_OVERHANG - 0.5;
  const runs = 3;
  for (let i = 0; i < runs; i++) {
    const z = -hz + ((2 * hz) / (runs - 1)) * i;
    // Skip where the core would cut the run.
    if (Math.abs(z - site.core.z) < site.core.depth / 2 + 0.3) continue;
    push({
      kind: "ceiling",
      floor: cladBy,
      at: 0.36,
      position: [0, head - 0.12, z],
      scale: [hx * 1.85, 0.07, 0.18],
      rotationY: 0,
      drop: 0,
    });
  }

  // --- fit-out -----------------------------------------------------------
  // Desk-and-table scale objects. At the distance the building is seen these
  // are blocks, and blocks are enough: what they buy is the sense that the
  // floors are occupied, which is the difference between a model of a
  // building and a building.
  const pieces = 5 + rnd.int(0, 3);
  for (let i = 0; i < pieces; i++) {
    const x = rnd.range(-hx, hx);
    const z = rnd.range(-hz, hz);
    // Keep out of the core.
    if (
      Math.abs(x - site.core.x) < site.core.width / 2 + 0.6 &&
      Math.abs(z - site.core.z) < site.core.depth / 2 + 0.6
    ) {
      continue;
    }
    const tall = rnd.chance(0.25);
    const h = tall ? rnd.range(1.1, 1.6) : rnd.range(0.42, 0.78);
    push({
      kind: "fitout",
      floor: cladBy,
      at: 0.5 + rnd.range(0, 0.2),
      position: [x, bottom + h / 2, z],
      scale: tall
        ? [rnd.range(0.4, 0.7), h, rnd.range(0.4, 0.7)]
        : [rnd.range(0.9, 1.8), h, rnd.range(0.6, 1.0)],
      rotationY: rnd.chance(0.5) ? 0 : Math.PI / 2,
      drop: 0,
    });
  }
}

/** The plinth the whole thing stands on, sized off the base plate. */
export function plinth(site: Site) {
  const w = site.floors[0].width + SLAB_OVERHANG * 2 + 2.8;
  const d = site.floors[0].depth + SLAB_OVERHANG * 2 + 2.8;
  return { width: w, depth: d, height: 0.62, lip: 0.5 };
}
