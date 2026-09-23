import * as THREE from "three";

export type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

/** One box (or any unit geometry) placed in the world. */
export type Instance = {
  position: Vec3;
  scale: Vec3;
  quaternion?: Quat;
  rotationY?: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/** A box member running from `a` to `b`, `size` across (square section unless `size2`). */
export function strut(a: Vec3, b: Vec3, size: number, size2 = size): Instance {
  tmpA.set(a[0], a[1], a[2]);
  tmpB.set(b[0], b[1], b[2]);
  const dir = tmpB.sub(tmpA);
  const length = Math.max(0.0001, dir.length());
  dir.divideScalar(length);
  tmpQ.setFromUnitVectors(UP, dir);
  return {
    position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    scale: [size, length, size2],
    quaternion: [tmpQ.x, tmpQ.y, tmpQ.z, tmpQ.w],
  };
}

/** An axis-aligned box centred at `position`. */
export function box(position: Vec3, scale: Vec3, rotationY = 0): Instance {
  return { position, scale, rotationY };
}

/** A box whose base sits at `base`, rising `height`. */
export function post(base: Vec3, height: number, size: number, size2 = size): Instance {
  return { position: [base[0], base[1] + height / 2, base[2]], scale: [size, height, size2] };
}

export type LatticeOptions = {
  /** Centre of the mast footprint. */
  x: number;
  z: number;
  y0: number;
  y1: number;
  /** Distance between chord centres. */
  width: number;
  /** Height of one braced panel. */
  panel: number;
  chord: number;
  brace: number;
  /** Diagonals on every face (true) or a lighter K-brace on two faces. */
  full?: boolean;
};

/**
 * A square lattice mast: four chords, a rung at every panel on every face and
 * one diagonal per panel per face that alternates direction, the way a tower
 * crane mast is braced.
 */
export function lattice(o: LatticeOptions): { chords: Instance[]; braces: Instance[] } {
  const h = o.width / 2;
  const corners: [number, number][] = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  const chords: Instance[] = corners.map(([dx, dz]) =>
    strut([o.x + dx, o.y0, o.z + dz], [o.x + dx, o.y1, o.z + dz], o.chord),
  );
  const braces: Instance[] = [];
  const panels = Math.max(1, Math.round((o.y1 - o.y0) / o.panel));
  const step = (o.y1 - o.y0) / panels;
  for (let p = 0; p <= panels; p++) {
    const y = o.y0 + p * step;
    for (let f = 0; f < 4; f++) {
      const a = corners[f];
      const b = corners[(f + 1) % 4];
      braces.push(strut([o.x + a[0], y, o.z + a[1]], [o.x + b[0], y, o.z + b[1]], o.brace));
      if (p < panels && (o.full !== false || f % 2 === 0)) {
        const flip = (p + f) % 2 === 0;
        const from: Vec3 = [o.x + (flip ? a[0] : b[0]), y, o.z + (flip ? a[1] : b[1])];
        const to: Vec3 = [o.x + (flip ? b[0] : a[0]), y + step, o.z + (flip ? b[1] : a[1])];
        braces.push(strut(from, to, o.brace));
      }
    }
  }
  return { chords, braces };
}

export type TrussOptions = {
  /** Start of the truss (bottom chord centre). */
  origin: Vec3;
  /** Unit direction the truss runs along (horizontal). */
  dir: Vec3;
  length: number;
  /** Distance between the two bottom chords. */
  width: number;
  /** Height of the top chord above the bottom ones. */
  height: number;
  panel: number;
  chord: number;
  brace: number;
  /** Top chord tapers to nothing at the far end (crane jibs do). */
  taper?: boolean;
};

/**
 * A triangular truss (two bottom chords, one top chord): a crane jib. The
 * bottom is laced with a zigzag and each side has diagonals up to the top chord.
 */
export function truss(o: TrussOptions): { chords: Instance[]; braces: Instance[] } {
  const [dx, , dz] = o.dir;
  // Perpendicular in the horizontal plane.
  const px = -dz;
  const pz = dx;
  const hw = o.width / 2;
  const at = (t: number, side: number, up: number): Vec3 => [
    o.origin[0] + dx * t + px * side * hw,
    o.origin[1] + up,
    o.origin[2] + dz * t + pz * side * hw,
  ];
  const topAt = (t: number): Vec3 => {
    const h = o.taper ? o.height * (1 - 0.65 * (t / o.length)) : o.height;
    return [o.origin[0] + dx * t, o.origin[1] + h, o.origin[2] + dz * t];
  };
  const chords: Instance[] = [
    strut(at(0, -1, 0), at(o.length, -1, 0), o.chord),
    strut(at(0, 1, 0), at(o.length, 1, 0), o.chord),
  ];
  const panels = Math.max(1, Math.round(o.length / o.panel));
  const step = o.length / panels;
  // Top chord in segments so a taper reads as a straight line.
  for (let p = 0; p < panels; p++) {
    chords.push(strut(topAt(p * step), topAt((p + 1) * step), o.chord * 0.9));
  }
  const braces: Instance[] = [];
  for (let p = 0; p <= panels; p++) {
    const t = p * step;
    // Bottom rung.
    braces.push(strut(at(t, -1, 0), at(t, 1, 0), o.brace));
    // Verticals up to the top chord on both sides.
    braces.push(strut(at(t, -1, 0), topAt(t), o.brace));
    braces.push(strut(at(t, 1, 0), topAt(t), o.brace));
    if (p < panels) {
      const flip = p % 2 === 0;
      // Bottom zigzag lacing.
      braces.push(strut(at(t, flip ? -1 : 1, 0), at(t + step, flip ? 1 : -1, 0), o.brace));
      // Side diagonals.
      braces.push(strut(at(t, -1, 0), topAt(t + step), o.brace * 0.9));
      braces.push(strut(at(t, 1, 0), topAt(t + step), o.brace * 0.9));
    }
  }
  return { chords, braces };
}
