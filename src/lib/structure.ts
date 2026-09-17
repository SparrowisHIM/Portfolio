import * as THREE from "three";
import type { Floor, Site } from "./site-generator";
import { FLOOR_HEIGHT } from "./site-generator";
import { HOVER, PLACED_AT } from "./construction";
import { createRandom } from "./random";
import { strut, box, type Instance, type Vec3 } from "./geometry";

/**
 * The skeleton. Every column, beam, outline segment, diagonal and node of the
 * building, with the moment in its floor's construction window when it
 * arrives, where it arrives from, and a seed for its personality. Packed into
 * typed arrays for the instanced shaders, so the whole building is three
 * draw calls whatever its size.
 */

export const MAX_FLOORS = 10;

/** Accent hue index, matching HUE_TABLE in the shaders. */
export const HUE = { amber: 0, blue: 1, white: 2, red: 3 } as const;

export type Member = {
  instance: Instance;
  floor: number;
  /** Start and duration within the floor window, 0..1. */
  start: number;
  dur: number;
  /** Offset it flies in from. */
  origin: Vec3;
  seed: number;
  hue: number;
  /** Loud connections burst and flash; quiet ones barely blink. */
  loud: boolean;
};

export type Node = { position: Vec3; floor: number; start: number; seed: number; hue: number; size: number; origin?: Vec3 };

export type Panel = {
  position: Vec3;
  rotationY: number;
  width: number;
  height: number;
  floor: number;
  /** Perimeter parameter range, 0..1 around the floor; -1 for plates. */
  p0: number;
  p1: number;
  /** How far the skin can go on this floor (unfinished floors stay open). */
  maxSkin: number;
  /** Plates lie flat: normal up. */
  plate: boolean;
};

export type Packed = {
  count: number;
  matrix: Float32Array;
  floor: Float32Array;
  start: Float32Array;
  dur: Float32Array;
  origin: Float32Array;
  seed: Float32Array;
  hue: Float32Array;
  loud: Uint8Array;
  /** Visual weight 0..1 from the member section: columns 1, hairlines near 0. */
  weight: Float32Array;
  /** World centre of each instance, for the CPU connection pass. */
  centre: Float32Array;
};

export type Structure = {
  members: Packed;
  nodes: Packed & { size: Float32Array };
  panels: {
    count: number;
    matrix: Float32Array;
    floor: Float32Array;
    perimeter: Float32Array;
    maxSkin: Float32Array;
    plate: Float32Array;
  };
};

const COLUMN = 0.075;
/** The plate edge: the strongest horizontal line, so a floor reads as a plate. */
const OUTLINE = 0.065;
const BEAM = 0.042;
const DIAG = 0.026;

type Face = { key: 0 | 1 | 2 | 3; nx: number; nz: number; rotationY: number };
const FACES: Face[] = [
  { key: 0, nx: 1, nz: 0, rotationY: Math.PI / 2 },
  { key: 1, nx: -1, nz: 0, rotationY: -Math.PI / 2 },
  { key: 2, nx: 0, nz: 1, rotationY: 0 },
  { key: 3, nx: 0, nz: -1, rotationY: Math.PI },
];

/** Edge index (corner f to f+1) that lies on each face key. */
const FACE_TO_EDGE = [1, 3, 2, 0] as const;

/** Half extents of a floor plate after its extensions. */
function extents(floor: Floor) {
  return {
    xp: floor.width / 2 + floor.extend[0],
    xn: floor.width / 2 + floor.extend[1],
    zp: floor.depth / 2 + floor.extend[2],
    zn: floor.depth / 2 + floor.extend[3],
  };
}

/** Rotate and offset a plate-local point into world space (x, z). */
function place(floor: Floor, x: number, z: number): [number, number] {
  const c = Math.cos(floor.rotation);
  const s = Math.sin(floor.rotation);
  return [floor.offset[0] + x * c - z * s, floor.offset[1] + x * s + z * c];
}

export function buildStructure(site: Site): Structure {
  const rnd = createRandom(site.seed ^ 0x5eed);
  const members: Member[] = [];
  const nodes: Node[] = [];
  const panels: Panel[] = [];

  const push = (m: Member) => members.push(m);
  const flyFrom = (bias: Vec3, spread: number): Vec3 => [
    bias[0] + rnd.range(-spread, spread),
    bias[1] + rnd.range(-spread, spread),
    bias[2] + rnd.range(-spread, spread),
  ];
  const pickHue = () => (rnd.chance(0.72) ? HUE.amber : rnd.chance(0.6) ? HUE.blue : HUE.white);

  const levels: { floor: Floor; index: number; columnsOnly: boolean }[] = site.floors.map((floor) => ({
    floor,
    index: floor.index,
    columnsOnly: false,
  }));
  const last = site.floors[site.floors.length - 1];
  levels.push({
    floor: { ...last, index: site.floors.length, y: site.topLevel.y, columns: site.topLevel.columns, offset: last.offset, rotation: 0, extend: [0, 0, 0, 0], void: null },
    index: site.floors.length,
    columnsOnly: true,
  });

  const wall = FLOOR_HEIGHT;

  for (const { floor, index, columnsOnly } of levels) {
    const y0 = floor.y;

    // Columns rise from the plate below to this plate, dead vertical: the
    // grid runs straight through the stack and the plates move around it.
    if (index > 0) {
      for (const [bx, bz] of floor.columns) {
        const start = rnd.range(0, 0.1);
        push({
          instance: strut([bx, y0 - wall, bz], [bx, y0, bz], COLUMN),
          floor: index,
          start,
          dur: 0.2,
          origin: flyFrom([0, -1.6, 0], 0.6),
          seed: rnd.next(),
          hue: pickHue(),
          loud: rnd.chance(0.5),
        });
        nodes.push({ position: [bx, y0, bz], floor: index, start: start + 0.2, seed: rnd.next(), hue: pickHue(), size: 0.17 });
      }
    }
    if (columnsOnly) continue;

    const e = extents(floor);
    const corners: [number, number][] = [
      [-e.xn, -e.zn],
      [e.xp, -e.zn],
      [e.xp, e.zp],
      [-e.xn, e.zp],
    ];
    const world = (x: number, z: number, y: number): Vec3 => {
      const [wx, wz] = place(floor, x, z);
      return [wx, y, wz];
    };

    // The frame arrives on the crane, hovers, and snaps down as one piece the
    // moment the hook releases it.
    const frameStart = index === 0 ? 0 : PLACED_AT;
    const frameDur = 0.03;
    const frameOrigin = (): Vec3 => flyFrom([0, HOVER, 0], 0.03);

    // Outline: the perimeter of the plate, split at corners and around the void.
    const perimeter = 2 * (e.xp + e.xn) + 2 * (e.zp + e.zn);
    let along = 0;
    for (let f = 0; f < 4; f++) {
      const a = corners[f];
      const b = corners[(f + 1) % 4];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const faceKey = ([3, 0, 2, 1] as const)[f];
      const voidHere = floor.void && floor.void.face === faceKey ? floor.void : null;
      const segments: [number, number][] = voidHere
        ? [
            [0, 0.5 + voidHere.along - voidHere.width / (2 * len)],
            [0.5 + voidHere.along + voidHere.width / (2 * len), 1],
          ]
        : [[0, 1]];
      for (const [s0, s1] of segments) {
        const p: Vec3 = world(a[0] + (b[0] - a[0]) * s0, a[1] + (b[1] - a[1]) * s0, y0);
        const q: Vec3 = world(a[0] + (b[0] - a[0]) * s1, a[1] + (b[1] - a[1]) * s1, y0);
        push({
          instance: strut(p, q, OUTLINE),
          floor: index,
          start: frameStart + rnd.range(0, 0.02),
          dur: frameDur,
          origin: frameOrigin(),
          seed: rnd.next(),
          hue: pickHue(),
          loud: rnd.chance(0.3),
        });
      }
      // Skin panels on this face, one per bay, skipping the void.
      const bays = Math.max(2, Math.round(len / 1.5));
      const face = FACES[faceKey];
      for (let k = 0; k < bays; k++) {
        const s0 = k / bays;
        const s1 = (k + 1) / bays;
        const mid = (s0 + s1) / 2;
        if (voidHere && Math.abs(mid - (0.5 + voidHere.along)) * len < voidHere.width / 2) continue;
        const cx = a[0] + (b[0] - a[0]) * mid;
        const cz = a[1] + (b[1] - a[1]) * mid;
        const centre = world(cx, cz, y0 + wall / 2);
        panels.push({
          position: centre,
          rotationY: face.rotationY + floor.rotation,
          width: len / bays,
          height: wall,
          floor: index,
          p0: (along + s0 * len) / perimeter,
          p1: (along + s1 * len) / perimeter,
          maxSkin: floor.finished ? 1 : 0.45,
          plate: false,
        });
      }
      along += len;
      nodes.push({ position: world(a[0], a[1], y0), floor: index, start: frameStart + frameDur, seed: rnd.next(), hue: pickHue(), size: 0.13 });
    }

    // A cantilever hangs off the column line: two brackets from the column
    // feet on the floor below out to the tip, arriving with the diagonals.
    if (index > 0) {
      const hx = floor.width / 2 - 0.35;
      const hz = floor.depth / 2 - 0.35;
      const tips: [number, [number, number], [number, number]][] = [
        [floor.extend[0], [hx, -hz], [e.xp, -e.zn]],
        [floor.extend[0], [hx, hz], [e.xp, e.zp]],
        [floor.extend[1], [-hx, -hz], [-e.xn, -e.zn]],
        [floor.extend[1], [-hx, hz], [-e.xn, e.zp]],
        [floor.extend[2], [-hx, hz], [-e.xn, e.zp]],
        [floor.extend[2], [hx, hz], [e.xp, e.zp]],
        [floor.extend[3], [-hx, -hz], [-e.xn, -e.zn]],
        [floor.extend[3], [hx, -hz], [e.xp, -e.zn]],
      ];
      for (const [ext, foot, tip] of tips) {
        if (ext < 0.3) continue;
        push({ instance: strut(world(foot[0], foot[1], y0 - wall), world(tip[0], tip[1], y0), DIAG * 1.3), floor: index, start: 0.7 + rnd.range(0, 0.04), dur: 0.12, origin: flyFrom([0, -0.8, 0], 0.4), seed: rnd.next(), hue: pickHue(), loud: rnd.chance(0.5) });
      }
    }
    // Wall mullions: hairlines every other bay that arrive with the glazing,
    // so the walls read as walls without competing with the columns.
    for (let f = 0; f < 4; f++) {
      const a = corners[f];
      const b = corners[(f + 1) % 4];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const bays = Math.max(2, Math.round(len / 1.5));
      for (let k = 1; k < bays; k += 2) {
        const s = k / bays;
        const p = world(a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, y0);
        const q = world(a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, y0 + wall);
        push({ instance: strut(p, q, DIAG * 0.5), floor: index, start: 0.8 + rnd.range(0, 0.08), dur: 0.1, origin: flyFrom([0, 0.5, 0], 0.3), seed: rnd.next(), hue: pickHue(), loud: false });
      }
    }
    // The core as a glass box, lit warm, on every floor.
    {
      const { core } = site;
      const coreFaces: [number, number, number, number, number][] = [
        [core.x + core.width / 2, core.z, Math.PI / 2, core.depth, 0],
        [core.x - core.width / 2, core.z, -Math.PI / 2, core.depth, 0],
        [core.x, core.z + core.depth / 2, 0, core.width, 0],
        [core.x, core.z - core.depth / 2, Math.PI, core.width, 0],
      ];
      for (const [px, pz, ry, w] of coreFaces) {
        panels.push({ position: [px, y0 + wall / 2, pz], rotationY: ry, width: w, height: wall, floor: index, p0: -1, p1: -1, maxSkin: 1, plate: false });
      }
    }

    // Beams across the plate between column lines, and secondaries.
    const zLines = [-e.zn, e.zp];
    const xLines = [-e.xn, 0, e.xp];
    for (const x of xLines) {
      push({ instance: strut(world(x, -e.zn, y0), world(x, e.zp, y0), BEAM), floor: index, start: frameStart, dur: frameDur, origin: frameOrigin(), seed: rnd.next(), hue: pickHue(), loud: false });
    }
    const secondaries = Math.max(2, Math.round((e.xp + e.xn) / 1.6));
    for (let k = 1; k < secondaries; k++) {
      const x = -e.xn + (k * (e.xp + e.xn)) / secondaries;
      if (Math.abs(x) < 0.4) continue;
      push({ instance: strut(world(x, zLines[0], y0 + 0.02), world(x, zLines[1], y0 + 0.02), BEAM * 0.7), floor: index, start: frameStart + 0.01, dur: frameDur, origin: frameOrigin(), seed: rnd.next(), hue: pickHue(), loud: false });
    }

    // The plate: a dark translucent floor that reads as a slab.
    {
      const [wx, wz] = place(floor, (e.xp - e.xn) / 2, (e.zp - e.zn) / 2);
      panels.push({
        position: [wx, y0 + 0.01, wz],
        rotationY: floor.rotation,
        width: e.xp + e.xn,
        height: e.zp + e.zn,
        floor: index,
        p0: -1,
        p1: -1,
        maxSkin: 1,
        plate: true,
      });
    }

    // Diagonals: a cross brace in the same bay on every floor, so the bracing
    // reads as one line up the building, an odd extra brace, and the spine.
    if (index > 0) {
      const brace = (f: number, s0: number, s1: number, cross: boolean) => {
        const a = corners[f];
        const b = corners[(f + 1) % 4];
        const at = (s: number, y: number) => world(a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, y);
        push({ instance: strut(at(s0, y0 - wall), at(s1, y0), DIAG), floor: index, start: rnd.range(0.7, 0.76), dur: 0.12, origin: flyFrom([0, -0.6, 0], 0.6), seed: rnd.next(), hue: pickHue(), loud: rnd.chance(0.4) });
        if (cross) push({ instance: strut(at(s1, y0 - wall), at(s0, y0), DIAG), floor: index, start: rnd.range(0.74, 0.8), dur: 0.12, origin: flyFrom([0, -0.6, 0], 0.6), seed: rnd.next(), hue: pickHue(), loud: rnd.chance(0.4) });
      };
      const { bracedBay } = site;
      brace(FACE_TO_EDGE[bracedBay.face], bracedBay.s0, bracedBay.s1, true);
      if (rnd.chance(0.4)) {
        const s0 = rnd.range(0.1, 0.5);
        brace(rnd.int(0, 3), s0, Math.min(0.95, s0 + rnd.range(0.25, 0.4)), false);
      }
      const { core } = site;
      for (const [dx, dz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        push({
          instance: strut([core.x + (dx * core.width) / 2, y0 - wall, core.z + (dz * core.depth) / 2], [core.x + (dx * core.width) / 2, y0 + wall * 0.5, core.z + (dz * core.depth) / 2], DIAG * 1.4),
          floor: index,
          start: 0.72,
          dur: 0.18,
          origin: [0, -1.2, 0],
          seed: rnd.next(),
          hue: HUE.blue,
          loud: false,
        });
      }
      // One warning node per floor, on the spine.
      nodes.push({ position: [core.x, y0 + wall * 0.5, core.z + core.depth / 2], floor: index, start: 0.9, seed: rnd.next(), hue: HUE.red, size: 0.12 });
    }
  }

  // Dotted setting-out lines: survey marks at each corner of the footprint,
  // set out one storey ahead of the build and no further.
  const base = site.floors[0];
  const eb = extents(base);
  for (const [cx, cz] of [
    [-eb.xn - 0.8, -eb.zn - 0.8],
    [eb.xp + 0.8, -eb.zn - 0.8],
    [eb.xp + 0.8, eb.zp + 0.8],
    [-eb.xn - 0.8, eb.zp + 0.8],
  ]) {
    for (let y = 0; y < site.totalHeight + 1.6; y += 0.8) {
      const floor = Math.min(site.floors.length, Math.max(0, Math.ceil((y - 0.4) / FLOOR_HEIGHT)));
      nodes.push({ position: [cx, y, cz], floor, start: 0, seed: rnd.next(), hue: HUE.white, size: 0.04, origin: [0, 0, 0] });
    }
  }

  return { members: pack(members), nodes: packNodes(nodes), panels: packPanels(panels) };
}

const dummy = new THREE.Object3D();

function pack(list: Member[], fullWeight = COLUMN): Packed {
  const n = list.length;
  const out: Packed = {
    count: n,
    matrix: new Float32Array(n * 16),
    floor: new Float32Array(n),
    start: new Float32Array(n),
    dur: new Float32Array(n),
    origin: new Float32Array(n * 3),
    seed: new Float32Array(n),
    hue: new Float32Array(n),
    loud: new Uint8Array(n),
    weight: new Float32Array(n),
    centre: new Float32Array(n * 3),
  };
  list.forEach((m, i) => {
    const it = m.instance;
    dummy.position.set(it.position[0], it.position[1], it.position[2]);
    if (it.quaternion) dummy.quaternion.set(it.quaternion[0], it.quaternion[1], it.quaternion[2], it.quaternion[3]);
    else dummy.quaternion.identity();
    dummy.scale.set(it.scale[0], it.scale[1], it.scale[2]);
    dummy.updateMatrix();
    dummy.matrix.toArray(out.matrix, i * 16);
    out.floor[i] = m.floor;
    out.start[i] = m.start;
    out.dur[i] = m.dur;
    out.origin.set(m.origin, i * 3);
    out.seed[i] = m.seed;
    out.hue[i] = m.hue;
    out.loud[i] = m.loud ? 1 : 0;
    out.weight[i] = Math.min(1, it.scale[0] / fullWeight);
    out.centre.set(it.position, i * 3);
  });
  return out;
}

function packNodes(list: Node[]): Packed & { size: Float32Array } {
  const members: Member[] = list.map((n) => ({
    instance: box(n.position, [n.size, n.size, n.size]),
    floor: n.floor,
    start: n.start,
    dur: 0.05,
    origin: n.origin ?? [0, 0.6, 0],
    seed: n.seed,
    hue: n.hue,
    loud: false,
  }));
  return { ...pack(members, 0.17), size: Float32Array.from(list.map((n) => n.size)) };
}

function packPanels(list: Panel[]): Structure["panels"] {
  const n = list.length;
  const out = {
    count: n,
    matrix: new Float32Array(n * 16),
    floor: new Float32Array(n),
    perimeter: new Float32Array(n * 2),
    maxSkin: new Float32Array(n),
    plate: new Float32Array(n),
  };
  list.forEach((p, i) => {
    dummy.position.set(p.position[0], p.position[1], p.position[2]);
    if (p.plate) dummy.rotation.set(-Math.PI / 2, 0, p.rotationY);
    else dummy.rotation.set(0, p.rotationY, 0);
    dummy.scale.set(p.width, p.height, 1);
    dummy.updateMatrix();
    dummy.matrix.toArray(out.matrix, i * 16);
    out.floor[i] = p.floor;
    out.perimeter[i * 2] = p.p0;
    out.perimeter[i * 2 + 1] = p.p1;
    out.maxSkin[i] = p.maxSkin;
    out.plate[i] = p.plate ? 1 : 0;
  });
  return out;
}
