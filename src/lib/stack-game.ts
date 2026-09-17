import { FLOOR_HEIGHT, SLAB_THICKNESS } from "./site-generator";

/**
 * Night shift: the stacking game.
 *
 * The crane swings the next slab back and forth over the tower. Drop it and
 * whatever hangs over the edge of the floor below is cut off and falls. Each
 * floor is a little harder: the swing gets faster and the footprint you have
 * left is whatever you managed to land on.
 */

export type Block = {
  x: number;
  z: number;
  width: number;
  depth: number;
  /** Underside of the slab. */
  y: number;
  perfect: boolean;
};

export type Debris = Block & {
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  life: number;
};

export type Axis = "x" | "z";

export type GameState = {
  active: boolean;
  over: boolean;
  blocks: Block[];
  moving: Block | null;
  axis: Axis;
  dir: 1 | -1;
  speed: number;
  /** Half range of the swing. */
  range: number;
  debris: Debris[];
  score: number;
  best: number;
  streak: number;
  /** Time of the last drop, for HUD flashes. */
  lastDrop: number;
  lastPerfect: boolean;
  /** Where the crane hook should be right now, world space. */
  hook: [number, number, number];
  /** Bumped whenever React should re-read the state. */
  version: number;
  time: number;
};

const PERFECT = 0.22;
const HOOK_ABOVE_SLAB = 1.25;
const BEST_KEY = "build-site:night-shift:best";

const listeners = new Set<() => void>();

export const game: GameState = {
  active: false,
  over: false,
  blocks: [],
  moving: null,
  axis: "x",
  dir: 1,
  speed: 4,
  range: 7,
  debris: [],
  score: 0,
  best: 0,
  streak: 0,
  lastDrop: -10,
  lastPerfect: false,
  hook: [0, 0, 0],
  version: 0,
  time: 0,
};

function notify() {
  game.version++;
  for (const l of listeners) l();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function snapshot() {
  return game.version;
}

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private mode. The score still shows for this session.
  }
}

/** Put the next slab on the hook at one end of its swing. */
function spawn() {
  const top = game.blocks[game.blocks.length - 1];
  game.axis = game.axis === "x" ? "z" : "x";
  game.dir = game.dir === 1 ? -1 : 1;
  const y = top.y + FLOOR_HEIGHT;
  const start = -game.dir * game.range;
  game.moving = {
    x: game.axis === "x" ? top.x + start : top.x,
    z: game.axis === "z" ? top.z + start : top.z,
    width: top.width,
    depth: top.depth,
    y,
    perfect: false,
  };
  game.speed = Math.min(11, 4.2 + game.score * 0.32);
}

/** Start a shift on top of the tower as built. */
export function startGame(base: { x: number; z: number; width: number; depth: number; y: number }) {
  game.active = true;
  game.over = false;
  game.blocks = [{ ...base, perfect: false }];
  game.debris = [];
  game.score = 0;
  game.streak = 0;
  game.best = readBest();
  game.axis = "z";
  game.dir = -1;
  game.range = Math.max(6, Math.max(base.width, base.depth) * 0.9);
  game.time = 0;
  spawn();
  notify();
}

export function endGame() {
  game.active = false;
  game.over = false;
  game.moving = null;
  game.debris = [];
  notify();
}

/** Advance the swing and the falling offcuts. */
export function stepGame(dt: number) {
  if (!game.active) return;
  game.time += dt;
  const m = game.moving;
  if (m && !game.over) {
    const top = game.blocks[game.blocks.length - 1];
    const centre = game.axis === "x" ? top.x : top.z;
    const v = game.speed * game.dir * dt;
    if (game.axis === "x") m.x += v;
    else m.z += v;
    const pos = game.axis === "x" ? m.x : m.z;
    if (pos > centre + game.range) game.dir = -1;
    if (pos < centre - game.range) game.dir = 1;
    game.hook = [m.x, m.y + SLAB_THICKNESS + HOOK_ABOVE_SLAB, m.z];
  }
  for (let i = game.debris.length - 1; i >= 0; i--) {
    const d = game.debris[i];
    d.vy -= 18 * dt;
    d.x += d.vx * dt;
    d.z += d.vz * dt;
    d.y += d.vy * dt;
    d.life -= dt;
    if (d.life <= 0 || d.y < -20) game.debris.splice(i, 1);
  }
}

/** Let go of the slab. */
export function drop() {
  const m = game.moving;
  if (!game.active || game.over || !m) return;
  const top = game.blocks[game.blocks.length - 1];
  const axis = game.axis;
  const size = axis === "x" ? m.width : m.depth;
  const delta = axis === "x" ? m.x - top.x : m.z - top.z;
  const overlap = size - Math.abs(delta);
  game.lastDrop = game.time;

  if (overlap <= 0.05) {
    // Missed the tower: the whole slab goes over the side.
    game.debris.push({ ...m, vx: axis === "x" ? Math.sign(delta) * 2 : 0, vz: axis === "z" ? Math.sign(delta) * 2 : 0, vy: 1, spin: Math.sign(delta) * 2.5, life: 4 });
    game.moving = null;
    game.over = true;
    game.lastPerfect = false;
    if (game.score > game.best) {
      game.best = game.score;
      writeBest(game.best);
    }
    notify();
    return;
  }

  const perfect = Math.abs(delta) < PERFECT;
  const placed: Block = { ...m, perfect };
  if (perfect) {
    // Snap to the floor below. A streak of perfect drops grows the slab back a little.
    placed.x = top.x;
    placed.z = top.z;
    game.streak++;
    if (game.streak >= 3) {
      const grow = 0.35;
      placed.width = Math.min(top.width + grow, game.blocks[0].width);
      placed.depth = Math.min(top.depth + grow, game.blocks[0].depth);
    }
  } else {
    game.streak = 0;
    if (axis === "x") {
      placed.width = overlap;
      placed.x = top.x + delta / 2;
      game.debris.push({
        ...m,
        width: Math.abs(delta),
        x: m.x + (Math.sign(delta) * size) / 2 - (Math.sign(delta) * Math.abs(delta)) / 2 + Math.sign(delta) * 0.02,
        vx: Math.sign(delta) * 1.5,
        vz: 0,
        vy: 0.5,
        spin: Math.sign(delta) * 2,
        life: 4,
        perfect: false,
      });
    } else {
      placed.depth = overlap;
      placed.z = top.z + delta / 2;
      game.debris.push({
        ...m,
        depth: Math.abs(delta),
        z: m.z + (Math.sign(delta) * size) / 2 - (Math.sign(delta) * Math.abs(delta)) / 2 + Math.sign(delta) * 0.02,
        vx: 0,
        vz: Math.sign(delta) * 1.5,
        vy: 0.5,
        spin: Math.sign(delta) * 2,
        life: 4,
        perfect: false,
      });
    }
  }
  game.blocks.push(placed);
  game.score++;
  game.lastPerfect = perfect;
  spawn();
  notify();
}

/** Top of the stack, for the camera. */
export function stackTop() {
  const top = game.blocks[game.blocks.length - 1];
  return top ? top.y + FLOOR_HEIGHT : 0;
}
