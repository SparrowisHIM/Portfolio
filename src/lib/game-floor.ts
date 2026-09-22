import { GAME_SLAB_HEIGHT, type Block } from "./stack-game";

export type Finish = "concrete" | "steel" | "window" | "light" | "interior";
export type FloorPart = {
  finish: Finish;
  x: number; y: number; z: number;
  width: number; height: number; depth: number;
  tint: string;
};

/** Geometry is in the section's local coordinates. Cut faces keep the original bays. */
export function floorParts(block: Block): FloorPart[] {
  const parts: FloorPart[] = [];
  const source = block.section ?? block;
  const cx = block.section?.offsetX ?? 0;
  const cz = block.section?.offsetZ ?? 0;
  const w = source.width;
  const d = source.depth;
  const h = GAME_SLAB_HEIGHT;
  const level = block.designLevel ?? Math.max(0, Math.round(block.y / h));
  const add = (finish: Finish, x: number, y: number, z: number, width: number, height: number, depth: number, tint = "#ffffff") => {
    const left = Math.max(-block.width / 2, cx + x - width / 2);
    const right = Math.min(block.width / 2, cx + x + width / 2);
    const back = Math.max(-block.depth / 2, cz + z - depth / 2);
    const front = Math.min(block.depth / 2, cz + z + depth / 2);
    if (right <= left || front <= back) return;
    parts.push({ finish, x: (left + right) / 2, y, z: (back + front) / 2,
      width: right - left, height, depth: front - back, tint });
  };

  // Thin structural decks leave a full-height room between each pair of floors.
  add("concrete", 0, 0.075, 0, w, 0.15, d, "#a9b3b8");
  add("concrete", 0, h - 0.065, 0, w, 0.13, d, "#d3d6d3");
  add("interior", 0, 0.155, 0, Math.max(0.01, w - 0.18), 0.025, Math.max(0.01, d - 0.18), "#6c6559");

  // A lift/stair core and interior partitions give a sliced room a real inside.
  const coreW = Math.min(1.1, w * 0.28);
  const coreD = Math.min(1.4, d * 0.3);
  add("concrete", 0, h / 2, 0, coreW, h - 0.28, coreD, "#818f98");
  add("interior", 0, h / 2, -d * 0.21, Math.max(0.01, w - 0.36), h - 0.32, 0.04, "#413e38");

  const pier = Math.min(0.17, w * 0.16, d * 0.16);
  for (let side = 0; side < 4; side++) {
    const alongX = side < 2;
    const sign = side % 2 === 0 ? 1 : -1;
    const length = alongX ? w : d;
    const cross = alongX ? d : w;
    const bays = Math.max(1, Math.min(5, Math.round(length / 1.45)));
    const span = Math.max(0.01, length - pier * 2);
    const pitch = span / bays;
    const face = sign * (cross / 2 - pier / 2 - 0.045);
    const part = (finish: Finish, u: number, y: number, v: number, width: number, height: number, depth: number, tint?: string) => {
      add(finish, alongX ? u : v, y, alongX ? v : u,
        alongX ? width : depth, height, alongX ? depth : width, tint);
    };
    // Concrete edge beams and aligned load-bearing piers, not glowing stripes.
    part("concrete", 0, 0.235, face, length - 0.08, 0.16, pier, "#a5b0b6");
    part("steel", 0, h - 0.19, face, length - 0.12, 0.065, pier * 0.85);
    for (let bay = 0; bay <= bays; bay++) {
      const u = -span / 2 + bay * pitch;
      part("concrete", u, h / 2, face, pier, h - 0.2, pier, "#bbc3c6");
    }
    for (let bay = 0; bay < bays; bay++) {
      const u = -span / 2 + (bay + 0.5) * pitch;
      const paneW = Math.max(0.012, pitch - pier - 0.03);
      const paneH = h - 0.49;
      const paneY = 0.31 + paneH / 2;
      const paneFace = face - sign * 0.085;
      const lit = ((level * 11 + bay * 7 + side * 3) % 9) < 5;
      const tint = lit ? ["#dcc69f", "#b6c3c5", "#e3c797"][(bay + level + side) % 3] : "#426177";
      part("window", u, paneY, paneFace, paneW, paneH, 0.035, tint);
      // An actual glazing bar and sill stand proud of the recessed pane.
      part("steel", u, paneY, paneFace + sign * 0.028, 0.028, paneH, 0.035);
      part("steel", u, paneY + paneH * 0.28, paneFace + sign * 0.028, paneW, 0.022, 0.035);
      part("steel", u, 0.3, face, paneW, 0.035, 0.15);
      if (lit) part("light", u, h - 0.235, paneFace, paneW * 0.65, 0.018, 0.042, "#e2b66f");
    }
  }
  return parts;
}
