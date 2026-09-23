/** Whole-floor stacking with a deterministic, lightweight balance simulation. */
export const GAME_SLAB_HEIGHT = 1.45;
export const GAME_MAX_DEBRIS = 8;
export const GAME_DROP_DURATION = 0.34;

export type Block = {
  x: number;
  z: number;
  width: number;
  depth: number;
  /** Underside, in the standing tower's coordinates. */
  y: number;
  perfect: boolean;
  /** Facade identity stays fixed while its world height changes. */
  designLevel?: number;
  /** Kept for reusable architectural section geometry. Gameplay uses whole floors. */
  section?: { offsetX: number; offsetZ: number; width: number; depth: number };
};

type Debris = Block & {
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  rotationZ: number;
  life: number;
};

type Axis = "x" | "z";
export type FloorPose = { x: number; y: number; z: number; rotationZ: number };
export type GameState = {
  active: boolean;
  over: boolean;
  phase: "swinging" | "falling" | "over";
  overReason: "miss" | "unstable" | null;
  blocks: Block[];
  /** World coordinates while suspended or falling. */
  moving: Block | null;
  movingRotation: number;
  movingVelocity: { x: number; y: number };
  fallProgress: number;
  axis: Axis;
  dir: 1 | -1;
  speed: number;
  range: number;
  debris: Debris[];
  score: number;
  best: number;
  streak: number;
  lastDrop: number;
  lastLanding: number;
  lastPerfect: boolean;
  lastQuality: "perfect" | "steady" | "off-centre" | "miss" | null;
  recovery: boolean;
  /** Signed rotation around Z. A negative angle leans right. */
  lean: number;
  leanVelocity: number;
  /** Signed accumulated placement error; positive means loaded to the right. */
  imbalance: number;
  strain: number;
  /** 1 is stable; 0 has collapsed. Changes continuously without React renders. */
  stability: number;
  collapse: { startedAt: number; direction: 1 | -1; initialLean: number } | null;
  /** Fixed world-space suspension point for the current pendulum. */
  hook: [number, number, number];
  version: number;
  time: number;
};

const PERFECT_FRACTION = 0.035;
const STEADY_FRACTION = 0.09;
const DROP_COOLDOWN = 0.3;
const LIFT_GAP = 0.72;
const CABLE_LENGTH = 8;
const MAX_IMBALANCE = 1.4;
const BEST_KEY = "build-site:night-shift:best";
const listeners = new Set<() => void>();
let swingPhase = -Math.PI / 2;
let swingDirection = 1;
const GRAVITY = 14;
let flight: { fromY: number; fromRotation: number } | null = null;

export const game: GameState = {
  active: false, over: false, phase: "swinging", overReason: null,
  blocks: [], moving: null, movingRotation: 0, fallProgress: 0,
  movingVelocity: { x: 0, y: 0 },
  axis: "x", dir: 1, speed: 3.2, range: 3.2,
  debris: [], score: 0, best: 0, streak: 0,
  lastDrop: -10, lastLanding: -10, lastPerfect: false, lastQuality: null, recovery: false,
  lean: 0, leanVelocity: 0, imbalance: 0, strain: 0, stability: 1, collapse: null,
  hook: [0, 0, 0], version: 0, time: 0,
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function notify() {
  game.version++;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function snapshot() { return game.version; }

function readBest() {
  try {
    const value = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch { return 0; }
}

function saveBest() {
  if (game.score <= game.best) return;
  game.best = game.score;
  try { window.localStorage.setItem(BEST_KEY, String(game.best)); }
  catch { /* The session record still works with storage blocked. */ }
}

/** Parent transform for the original absolute Block coordinates, pivoted at the base. */
export function towerPose(): FloorPose {
  const base = game.blocks[0];
  if (!base) return { x: 0, y: 0, z: 0, rotationZ: 0 };
  const c = Math.cos(game.lean);
  const s = Math.sin(game.lean);
  return {
    x: base.x - c * base.x + s * base.y,
    y: base.y - s * base.x - c * base.y,
    z: 0,
    rotationZ: game.lean,
  };
}

/** The renderer and contact solver share exactly the same tower transformation. */
export function blockPose(block: Pick<Block, "x" | "y" | "z">): FloorPose {
  const pose = towerPose();
  const c = Math.cos(pose.rotationZ);
  const s = Math.sin(pose.rotationZ);
  return { x: pose.x + c * block.x - s * block.y,
    y: pose.y + s * block.x + c * block.y, z: block.z, rotationZ: pose.rotationZ };
}

export function landingTarget(): FloorPose {
  const top = game.blocks[game.blocks.length - 1];
  return top ? blockPose({ x: top.x, y: top.y + GAME_SLAB_HEIGHT, z: top.z })
    : { x: 0, y: 0, z: 0, rotationZ: 0 };
}

export function movingPose(): FloorPose | null {
  return game.moving ? { x: game.moving.x, y: game.moving.y, z: game.moving.z, rotationZ: game.movingRotation } : null;
}

/** Intersect a vertical world-space drop with the visibly tilted top floor. */
function landingAt(worldX: number) {
  const top = game.blocks[game.blocks.length - 1];
  const localY = top.y + GAME_SLAB_HEIGHT;
  const pose = towerPose();
  const c = Math.cos(pose.rotationZ);
  const s = Math.sin(pose.rotationZ);
  const localX = (worldX - pose.x + s * localY) / c;
  return { localX, localY, worldY: pose.y + s * localX + c * localY };
}

function updateSwing() {
  const moving = game.moving;
  if (!moving) return;
  const displacement = Math.sin(swingPhase) * game.range;
  const length = Math.max(CABLE_LENGTH, game.range * 1.5);
  const vx = Math.cos(swingPhase) * game.speed * swingDirection;
  game.movingVelocity.x = vx;
  game.movingVelocity.y = displacement * vx / Math.sqrt(length * length - displacement * displacement);
  moving.x = game.hook[0] + displacement;
  moving.z = game.hook[2];
  moving.y = game.hook[1] - Math.sqrt(length * length - displacement * displacement) - GAME_SLAB_HEIGHT;
  game.movingRotation = -Math.asin(displacement / length) * 0.08;
  game.dir = Math.cos(swingPhase) * swingDirection >= 0 ? 1 : -1;
}

function spawn() {
  const base = game.blocks[0];
  game.phase = "swinging";
  game.fallProgress = 0;
  flight = null;
  swingPhase = game.score % 2 === 0 ? -Math.PI / 2 : Math.PI / 2;
  swingDirection = game.score % 2 === 0 ? 1 : -1;
  game.axis = "x";
  game.speed = Math.min(6.2, 3.2 + game.score * 0.10);
  game.moving = { x: 0, y: 0, z: base.z, width: base.width, depth: base.depth, perfect: false, designLevel: game.score + 1 };
  const target = landingTarget();
  const length = Math.max(CABLE_LENGTH, game.range * 1.5);
  game.hook = [target.x, target.y + GAME_SLAB_HEIGHT + LIFT_GAP + length, target.z];
  updateSwing();
}

export function startGame(base: Omit<Block, "perfect">) {
  game.active = true;
  game.over = false;
  game.overReason = null;
  game.blocks = [{ ...base, section: undefined, perfect: false }];
  game.debris = [];
  game.score = 0;
  game.streak = 0;
  game.best = Math.max(game.best, readBest());
  game.range = Math.max(1, base.width * 0.5);
  game.time = 0;
  game.lastDrop = -10;
  game.lastLanding = -10;
  game.lastPerfect = false;
  game.lastQuality = null;
  game.recovery = false;
  game.lean = 0;
  game.leanVelocity = 0;
  game.imbalance = 0;
  game.strain = 0;
  game.stability = 1;
  game.collapse = null;
  spawn();
  notify();
}

export function endGame() {
  saveBest();
  game.active = false;
  game.over = false;
  game.overReason = null;
  game.moving = null;
  game.debris = [];
  game.collapse = null;
  game.lastDrop = -10;
  game.lastLanding = -10;
  game.lastPerfect = false;
  game.lastQuality = null;
  game.recovery = false;
  flight = null;
  notify();
}

function updateStability() {
  const risk = Math.max(game.strain, Math.abs(game.imbalance) / MAX_IMBALANCE, Math.abs(game.lean) / 0.33 * 0.65);
  game.stability = game.over ? 0 : 1 - clamp(risk, 0, 1);
}

function collapse() {
  const direction = (Math.sign(game.lean) || -Math.sign(game.imbalance) || -1) as 1 | -1;
  game.collapse = { startedAt: game.time, direction, initialLean: game.lean };
  game.over = true;
  game.overReason = "unstable";
  game.phase = "over";
  game.moving = null;
  game.stability = 0;
  flight = null;
}

function addDebris(block: Block, direction: number) {
  if (game.debris.length >= GAME_MAX_DEBRIS) game.debris.shift();
  game.debris.push({ ...block, perfect: false, vx: game.movingVelocity.x || direction * 1.35, vy: game.movingVelocity.y, vz: 0,
    spin: -direction * 1.6, rotationZ: game.movingRotation, life: 4 });
}

function resolveLanding() {
  const moving = game.moving;
  if (!moving) return;
  const top = game.blocks[game.blocks.length - 1];
  const contact = landingAt(moving.x);
  const offset = contact.localX - top.x;
  const error = offset / top.width;
  const magnitude = Math.abs(error);
  game.lastLanding = game.time;

  if (magnitude >= 1) {
    addDebris(moving, Math.sign(offset));
    game.moving = null;
    game.over = true;
    game.phase = "over";
    game.overReason = "miss";
    game.lastPerfect = false;
    game.lastQuality = "miss";
    game.recovery = false;
    game.streak = 0;
    flight = null;
    updateStability();
    saveBest();
    notify();
    return;
  }

  const perfect = magnitude <= PERFECT_FRACTION;
  const steady = magnitude <= STEADY_FRACTION;
  const previousStrain = game.strain;
  const previousImbalance = game.imbalance;
  const correcting = previousImbalance * error < 0;
  if (perfect) {
    game.imbalance *= 0.70;
    game.strain = Math.max(0, game.strain - 0.22);
    game.leanVelocity *= 0.45;
  } else if (steady) {
    game.imbalance = game.imbalance * 0.90 + error * 0.8;
    game.strain = Math.max(0, game.strain - 0.09 + magnitude * 0.25);
    game.leanVelocity *= 0.70;
  } else {
    game.imbalance += error * 1.6;
    const extraLoad = Math.max(0, Math.abs(game.imbalance) - Math.abs(previousImbalance));
    game.strain += (magnitude - STEADY_FRACTION) + extraLoad * 0.22;
    if (correcting) game.strain = Math.max(0, game.strain - Math.min(0.22, magnitude * 0.9));
  }
  game.leanVelocity -= error * 0.35;
  game.recovery = game.strain < previousStrain - 0.015 || Math.abs(game.imbalance) < Math.abs(previousImbalance) - 0.04;
  game.lastPerfect = perfect;
  game.lastQuality = perfect ? "perfect" : steady ? "steady" : "off-centre";
  game.streak = perfect ? game.streak + 1 : 0;
  game.blocks.push({ x: perfect ? top.x : contact.localX, y: contact.localY, z: top.z,
    width: moving.width, depth: moving.depth, perfect, designLevel: moving.designLevel });
  game.score++;
  saveBest();
  if (game.strain >= 1 || Math.abs(game.imbalance) >= MAX_IMBALANCE) collapse();
  else spawn();
  updateStability();
  notify();
}

/** Release is immediate; placement is resolved only when the floor visibly touches down. */
export function drop() {
  const moving = game.moving;
  if (!game.active || game.over || !moving || game.phase !== "swinging" || game.time - game.lastDrop < DROP_COOLDOWN) return;
  flight = { fromY: moving.y, fromRotation: game.movingRotation };
  game.phase = "falling";
  game.fallProgress = 0;
  game.lastDrop = game.time;
  notify();
}

function step(dt: number) {
  game.time += dt;
  if (game.collapse) {
    const progress = clamp((game.time - game.collapse.startedAt) / 1.4, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    game.lean = game.collapse.initialLean + (game.collapse.direction * 1.48 - game.collapse.initialLean) * eased;
    game.leanVelocity = 0;
  } else {
    const targetLean = clamp(-game.imbalance * 0.17, -0.26, 0.26);
    const stiffness = Math.max(10, 22 - game.score * 0.22);
    const damping = 1.05 * Math.sqrt(stiffness);
    const acceleration = (targetLean - game.lean) * stiffness - game.leanVelocity * damping;
    game.leanVelocity += acceleration * dt;
    game.lean += game.leanVelocity * dt;
    if (!game.over && Math.abs(game.lean) > 0.33) { collapse(); notify(); }
  }

  if (game.moving && !game.over) {
    if (game.phase === "swinging") {
      swingPhase += game.speed / game.range * swingDirection * dt;
      updateSwing();
    } else if (flight) {
      // Ballistic release retains the actual tangent velocity of the suspended floor.
      // The roof can sway underneath it; it does not pull the falling floor down.
      game.moving.x += game.movingVelocity.x * dt;
      game.moving.y += game.movingVelocity.y * dt - 0.5 * GRAVITY * dt * dt;
      game.movingVelocity.y -= GRAVITY * dt;
      const contact = landingAt(game.moving.x);
      const progress = clamp((flight.fromY - game.moving.y) / Math.max(0.01, flight.fromY - contact.worldY), 0, 1);
      game.fallProgress = progress;
      game.movingRotation = flight.fromRotation + (game.lean - flight.fromRotation) * progress * progress;
      if (game.moving.y <= contact.worldY && game.movingVelocity.y < 0) {
        game.moving.y = contact.worldY;
        resolveLanding();
      }
    }
  }

  for (let i = game.debris.length - 1; i >= 0; i--) {
    const piece = game.debris[i];
    piece.vy -= GRAVITY * dt;
    piece.x += piece.vx * dt;
    piece.z += piece.vz * dt;
    piece.y += piece.vy * dt;
    piece.rotationZ += piece.spin * dt;
    piece.life -= dt;
    if (piece.life <= 0 || piece.y < game.blocks[0].y - 20) game.debris.splice(i, 1);
  }
  updateStability();
}

/** Capped, substepped integration prevents tab-resume jumps and unstable spring updates. */
export function stepGame(delta: number) {
  if (!game.active || !Number.isFinite(delta) || delta <= 0) return;
  let remaining = Math.min(delta, 0.05);
  while (remaining > 1e-10) {
    const dt = Math.min(remaining, 1 / 120);
    step(dt);
    remaining -= dt;
  }
}

/** World-space upper surface, including the essential gameplay lean. */
export function stackTop() { return landingTarget().y; }
