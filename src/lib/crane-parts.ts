import { box, lattice, strut, truss, type Instance, type Vec3 } from "./geometry";
import type { Site } from "./site-generator";

export const MAST = 1.6;
export const PANEL = 1.9;
export const JIB_Y = 0.9;
export const APEX = 4.6;

/**
 * The static steelwork of a tower crane, as instanced boxes: square lattice
 * mast on a cruciform base, A-frame top, tapered truss jib, counter jib with
 * machinery and ballast, and the ladder people climb it by.
 *
 * `reach` is how far the base may run before it runs out of deck. The crane
 * stands close to the plinth edge on its working side, so the base and its
 * kentledge are sized to what is left rather than by eye.
 */
export function buildCraneParts(crane: Site["crane"], reach: number) {
  const mast = lattice({ x: 0, z: 0, y0: 0.4, y1: crane.mastHeight, width: MAST, panel: PANEL, chord: 0.11, brace: 0.05 });
  const h = MAST / 2;
  const foot = Math.min(0.8, reach * 0.7);
  const cross = (d: number): [number, number][] => [[d, 0], [-d, 0], [0, d], [0, -d]];

  // Pedestal, two cross girders, and the feet they bear on.
  const base: Instance[] = [
    box([0, 0.2, 0], [MAST + 0.9, 0.5, MAST + 0.9]),
    box([0, 0.14, 0], [reach * 2, 0.3, 0.34]),
    box([0, 0.14, 0], [0.34, 0.3, reach * 2]),
    ...cross(reach - foot / 2).map(([x, z]) => box([x, 0.09, z], [foot, 0.18, foot])),
  ];

  // Kentledge: a tower crane is held down by weight, not by the deck.
  const kd = Math.min(0.9, reach * 0.62);
  const kw = Math.min(2.2, reach * 1.5);
  const kentledge = cross(reach - kd / 2).flatMap(([x, z]) => {
    const [w, d] = x !== 0 ? [kd, kw] : [kw, kd];
    return [box([x, 0.42, z], [w, 0.48, d]), box([x, 0.88, z], [w * 0.94, 0.44, d * 0.94])];
  });

  // A-frame top with three rings of ties.
  const apex: Vec3 = [0, APEX, 0];
  const towerTop: Instance[] = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([dx, dz]) => strut([dx, 0.5, dz], apex, 0.085));
  for (let i = 0; i < 3; i++) {
    const y = 1.5 + i * 1.05;
    const s = h * (1 - y / APEX) * 0.95;
    towerTop.push(
      strut([-s, y, -s], [s, y, -s], 0.042),
      strut([s, y, -s], [s, y, s], 0.042),
      strut([s, y, s], [-s, y, s], 0.042),
      strut([-s, y, s], [-s, y, -s], 0.042),
    );
  }
  const jib = truss({ origin: [0, JIB_Y, 0.8], dir: [0, 0, 1], length: crane.jibLength, width: 0.95, height: 0.95, panel: 1.7, chord: 0.082, brace: 0.042, taper: true });
  const counter = truss({ origin: [0, JIB_Y, -0.8], dir: [0, 0, -1], length: crane.counterJibLength, width: 1.15, height: 0.5, panel: 1.4, chord: 0.082, brace: 0.042 });
  const tail = -0.8 - crane.counterJibLength;
  const pendants: Instance[] = [
    strut(apex, [0, JIB_Y + 0.3, 0.8 + crane.jibLength * 0.62], 0.032),
    strut(apex, [0, JIB_Y + 0.22, 0.8 + crane.jibLength * 0.3], 0.028),
    strut(apex, [0, JIB_Y + 0.34, tail + 0.5], 0.032),
  ];
  const ballast = [0, 1, 2].map((i) => box([0, JIB_Y - 0.5, tail + 0.9 + i * 0.4], [1.7, 1.25, 0.34]));

  // Node lights every few panels up the mast.
  const lights: Vec3[] = [];
  const panels = Math.floor((crane.mastHeight - 0.4) / PANEL);
  for (let p = 3; p < panels; p += 5) lights.push([h, 0.4 + p * PANEL, h]);

  // The ladder inside one face of the mast, and a rest platform every few lifts.
  const lx = h * 0.34;
  const lz = -h + 0.12;
  const access: Instance[] = [
    strut([-lx, 0.5, lz], [-lx, crane.mastHeight - 0.3, lz], 0.035),
    strut([lx, 0.5, lz], [lx, crane.mastHeight - 0.3, lz], 0.035),
  ];
  for (let y = 0.9; y < crane.mastHeight - 0.4; y += 0.34) access.push(strut([-lx, y, lz], [lx, y, lz], 0.022));
  const deckW = MAST + 0.34;
  for (let y = 3.2; y < crane.mastHeight - 1.2; y += PANEL * 3) {
    access.push(box([0, y, 0], [deckW, 0.06, deckW]));
    for (const gz of [deckW / 2, -deckW / 2]) access.push(box([0, y + 0.42, gz], [deckW, 0.04, 0.04]));
  }

  // Counter jib machinery: hoist drum, motor, walkway rails; a sheave case at the jib tip.
  const deckZ = -0.8 - crane.counterJibLength * 0.42;
  const machinery: Instance[] = [
    box([0, JIB_Y + 0.5, deckZ], [1.5, 0.66, 1.5]),
    box([0, JIB_Y + 0.42, deckZ + 1.15], [1.1, 0.5, 0.8]),
    box([0, JIB_Y + 0.12, 0.8 + crane.jibLength - 0.2], [0.34, 0.5, 0.6]),
  ];
  for (const side of [-1, 1]) {
    const x = side * 0.78;
    machinery.push(
      strut([x, JIB_Y + 0.28, -0.8], [x, JIB_Y + 0.28, tail], 0.05),
      strut([x, JIB_Y + 0.92, -0.8], [x, JIB_Y + 0.92, tail], 0.035),
    );
  }

  return {
    mast: [...mast.chords, ...mast.braces],
    base,
    kentledge,
    access,
    machinery,
    towerTop: [...towerTop, ...jib.chords, ...jib.braces, ...counter.chords, ...counter.braces],
    pendants,
    ballast,
    lights,
  };
}
