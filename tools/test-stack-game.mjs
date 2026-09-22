import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = process.env.PORTFOLIO_ROOT
  ? pathToFileURL(process.env.PORTFOLIO_ROOT.replace(/[\\/]?$/, '/'))
  : new URL('../', import.meta.url);
const require = createRequire(new URL('package.json', root));
const ts = require('typescript');
const source = process.env.STACK_GAME_SOURCE ? pathToFileURL(process.env.STACK_GAME_SOURCE) : new URL('src/lib/stack-game.ts', root);
const result = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  fileName: source.pathname,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  reportDiagnostics: true,
});
assert.equal(result.diagnostics.length, 0, 'engine transpiles');
const engineUrl = 'data:text/javascript;base64,' + Buffer.from(result.outputText).toString('base64');
const engine = await import(engineUrl);
const { game, startGame, endGame, stepGame, drop, stackTop, GAME_SLAB_HEIGHT, GAME_MAX_DEBRIS,
  GAME_DROP_DURATION, subscribe, towerPose, blockPose, movingPose, landingTarget } = engine;
const store = new Map();
global.window = { localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } };
const base = { x: 0, z: 0, y: 0, width: 6.4, depth: 6.4 };
const near = (actual, expected, message, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} != ${expected}`);
const advance = (seconds, dt = 1 / 120) => { for (let i = 0; i < Math.round(seconds / dt); i++) stepGame(dt); };
const aim = fraction => {
  const target = landingTarget();
  game.moving.x = target.x + Math.cos(game.lean) * base.width * fraction;
  game.moving.y = target.y + 0.72;
  game.movingRotation = game.lean;
  game.movingVelocity = { x: 0, y: 0 };
};
const place = fraction => {
  // Let the essential sway settle, then aim at the same visible roof used by the renderer.
  advance(2.5);
  aim(fraction);
  drop();
  advance(0.45);
};
let checks = 0;
function check(label, fn) { fn(); checks++; process.stdout.write(`PASS ${label}\n`); }

check('released floors preserve pendulum momentum and accelerate under gravity', () => {
  startGame(base); advance(1);
  const { x, y } = game.moving;
  const velocity = { ...game.movingVelocity };
  drop(); advance(.1);
  near(game.moving.x, x + velocity.x * .1, 'horizontal momentum');
  near(game.moving.y, y + velocity.y * .1 - .5 * 14 * .1 ** 2, 'ballistic height');
  near(game.movingVelocity.y, velocity.y - 1.4, 'gravity accelerates fall');
});

check('ballistic release agrees at 30 and 120 frames per second', () => {
  const run = dt => { startGame(base); advance(1); drop(); advance(.2,dt); return { ...game.moving }; };
  const fast=run(1/120), slow=run(1/30);
  near(fast.x,slow.x,'fall X'); near(fast.y,slow.y,'fall Y');
});

check('front-view pendulum starts with full floors and a bounded horizontal range', () => {
  startGame(base);
  assert.equal(game.axis, 'x');
  assert.equal(game.phase, 'swinging');
  near(game.range, 3.2, 'half-floor range');
  near(stackTop(), GAME_SLAB_HEIGHT, 'base roof');
  near(game.moving.width, 6.4, 'complete floor width');
  assert.ok(game.moving.y > stackTop(), 'floor is suspended above roof');
  assert.ok(game.hook[1] > game.moving.y + GAME_SLAB_HEIGHT, 'hook is above the floor');
});

check('release visibly falls before score changes and rejects repeated input while airborne', () => {
  startGame(base); aim(0); const y = game.moving.y; drop();
  assert.equal(game.score, 0); assert.equal(game.phase, 'falling');
  const releaseTime = game.lastDrop;
  drop(); assert.equal(game.lastDrop, releaseTime);
  advance(GAME_DROP_DURATION / 2);
  assert.equal(game.score, 0); assert.ok(game.moving.y < y); assert.ok(game.moving.y > stackTop());
  drop(); advance(0.2);
  assert.equal(game.score, 1); assert.equal(game.phase, 'swinging'); assert.equal(game.lastPerfect, true);
});

check('all imperfect placements keep complete architectural dimensions without offcuts', () => {
  startGame(base);
  for (const error of [0.18, -0.16, 0.14, -0.17]) {
    place(error);
    assert.equal(game.over, false);
    const floor = game.blocks.at(-1);
    near(floor.width, base.width, 'whole width'); near(floor.depth, base.depth, 'whole depth');
    assert.equal(floor.section, undefined, 'no cut section'); assert.equal(game.debris.length, 0);
  }
  assert.equal(game.score, 4);
});

for (const direction of [-1, 1]) {
  check(`repeated ${direction > 0 ? 'right' : 'left'} errors create lean and directional collapse`, () => {
    startGame(base);
    const trace = [];
    for (let i = 0; i < 8 && !game.over; i++) {
      place(direction * 0.20);
      trace.push({ floor: game.score, stability: +game.stability.toFixed(3), lean: +game.lean.toFixed(3), imbalance: +game.imbalance.toFixed(3) });
    }
    assert.equal(game.over, true); assert.equal(game.overReason, 'unstable');
    assert.ok(game.score >= 4 && game.score <= 6, 'mistakes give several chances before collapse');
    assert.equal(game.collapse.direction, -direction);
    const before = game.lean; advance(0.6);
    assert.ok(Math.abs(game.lean) > Math.abs(before), 'tower visibly continues tipping after failure');
    assert.equal(game.stability, 0);
    process.stdout.write(`TRACE ${JSON.stringify(trace)}\n`);
  });
}

check('precise follow-up floors restore a damaged tower before collapse', () => {
  startGame(base); place(0.20); place(0.20);
  const damaged = { strain: game.strain, imbalance: Math.abs(game.imbalance), stability: game.stability };
  place(0); assert.equal(game.lastPerfect, true); assert.equal(game.recovery, true);
  place(0); place(0); advance(1.5);
  assert.equal(game.over, false);
  assert.ok(game.strain < damaged.strain * 0.2);
  assert.ok(Math.abs(game.imbalance) < damaged.imbalance * 0.4);
  assert.ok(game.stability > damaged.stability + 0.20);
  process.stdout.write(`TRACE recovery ${JSON.stringify({ damaged, recovered: { strain: game.strain, imbalance: game.imbalance, stability: game.stability } })}\n`);
});

check('near-centred landings recover strain without requiring pixel-perfect input', () => {
  startGame(base); place(0.22);
  const strain = game.strain; const imbalance = Math.abs(game.imbalance);
  place(-0.07);
  assert.equal(game.lastQuality, 'steady'); assert.equal(game.recovery, true);
  assert.ok(game.strain < strain); assert.ok(Math.abs(game.imbalance) < imbalance);
});

check('opposite-side correction reduces directional imbalance and risk', () => {
  startGame(base); place(0.20); place(0.20);
  const before = { strain: game.strain, imbalance: game.imbalance };
  place(-0.22);
  assert.equal(game.recovery, true); assert.equal(game.over, false);
  assert.ok(Math.abs(game.imbalance) < Math.abs(before.imbalance) * 0.6);
  assert.ok(game.strain < before.strain);
});

check('idle time damps sway but cannot erase accumulated structural risk', () => {
  startGame(base); place(0.20); place(0.20);
  const strain = game.strain; const imbalance = game.imbalance;
  advance(10);
  near(game.strain, strain, 'idle strain'); near(game.imbalance, imbalance, 'idle imbalance');
  assert.ok(game.stability < 0.65, 'waiting cannot produce a healthy tower');
});

check('suspension hook stays fixed while the loaded tower moves underneath it', () => {
  startGame(base); place(0.20);
  const hook = [...game.hook]; const roof = landingTarget();
  advance(0.2);
  assert.deepEqual(game.hook, hook);
  assert.ok(Math.abs(landingTarget().x - roof.x) > 0.001, 'roof moves independently');
  assert.ok(Math.abs(game.moving.x - game.hook[0]) <= game.range + 1e-8, 'pendulum stays in its arc');
});

check('world-space tower pose and roof contact agree around a nonzero foundation', () => {
  startGame({ ...base, x: 3, y: 5, z: -2 });
  game.lean = -0.12;
  const foundation = blockPose(game.blocks[0]);
  near(foundation.x, 3, 'fixed pivot X'); near(foundation.y, 5, 'fixed pivot Y'); near(foundation.z, -2, 'fixed pivot Z');
  const pose = towerPose(); const roof = landingTarget();
  const roofLocal = { x: 3, y: 5 + GAME_SLAB_HEIGHT };
  near(roof.x, pose.x + Math.cos(game.lean) * roofLocal.x - Math.sin(game.lean) * roofLocal.y, 'rendered roof X');
  near(roof.y, pose.y + Math.sin(game.lean) * roofLocal.x + Math.cos(game.lean) * roofLocal.y, 'rendered roof Y');
  near(stackTop(), roof.y, 'camera sees the same roof height');
});

check('touchdown uses current visible lean and the airborne floor rotates onto that roof', () => {
  startGame(base); place(0.20); advance(2.5); aim(0.12);
  const releasedX = movingPose().x;
  drop();
  while (game.phase === 'falling' && game.fallProgress < 0.94) stepGame(1 / 120);
  const falling = movingPose();
  near(falling.x, releasedX, 'release preserves world X');
  assert.ok(Math.abs(falling.rotationZ - game.lean) < 0.015, 'floor aligns to visible roof before contact');
  const expectedX = (releasedX - towerPose().x + Math.sin(game.lean) * (game.blocks.at(-1).y + GAME_SLAB_HEIGHT)) / Math.cos(game.lean);
  advance(0.08);
  assert.equal(game.score, 2);
  near(game.blocks.at(-1).x, expectedX, 'world to tower contact conversion', 0.004);
});

check('a complete miss resolves after the fall and releases one whole-floor debris piece', () => {
  startGame(base); aim(1.05); drop();
  assert.equal(game.over, false); advance(0.45);
  assert.equal(game.over, true); assert.equal(game.overReason, 'miss'); assert.equal(game.score, 0);
  assert.equal(game.debris.length, 1); near(game.debris[0].width, 6.4, 'missed floor stays whole');
  assert.equal(game.moving, null); assert.equal(game.collapse, null);
  advance(4.1); assert.equal(game.debris.length, 0);
});

check('debris insertion respects its fixed capacity', () => {
  startGame(base);
  game.debris = Array.from({ length: GAME_MAX_DEBRIS }, (_, i) => ({ ...base, perfect: false, x: i,
    vx: 0, vy: 0, vz: 0, spin: 0, rotationZ: 0, life: 4 }));
  aim(1.1); drop(); advance(0.45);
  assert.equal(game.debris.length, GAME_MAX_DEBRIS);
});

check('30 Hz and 120 Hz stepping produce the same sway and pendulum state', () => {
  const run = dt => {
    startGame(base); place(0.2); advance(1, dt);
    return { lean: game.lean, velocity: game.leanVelocity, x: game.moving.x, y: game.moving.y };
  };
  const fast = run(1 / 120); const slow = run(1 / 30);
  for (const key of Object.keys(fast)) near(slow[key], fast[key], `frame-independent ${key}`);
});

check('invalid deltas and resumed background tabs cannot fast-forward the game', () => {
  startGame(base); const time = game.time;
  for (const delta of [NaN, Infinity, -1, 0]) stepGame(delta);
  near(game.time, time, 'invalid deltas ignored');
  stepGame(60); near(game.time, 0.05, 'resume is capped');
  assert.ok(Number.isFinite(game.moving.x));
});

check('ordinary frames do not publish React events; release and contact do', () => {
  startGame(base); let notifications = 0; const unsubscribe = subscribe(() => notifications++);
  advance(1); assert.equal(notifications, 0);
  aim(0); drop(); assert.equal(notifications, 1);
  advance(0.45); assert.equal(notifications, 2);
  unsubscribe();
});

check('restart clears imbalance, active fall, collapse, feedback and input timing', () => {
  startGame(base); place(0.2); aim(0.1); drop(); startGame(base);
  assert.equal(game.score, 0); assert.equal(game.streak, 0); assert.equal(game.time, 0);
  assert.equal(game.lastDrop, -10); assert.equal(game.lastLanding, -10);
  assert.equal(game.lastPerfect, false); assert.equal(game.lastQuality, null); assert.equal(game.recovery, false);
  assert.equal(game.imbalance, 0); assert.equal(game.strain, 0); assert.equal(game.lean, 0);
  assert.equal(game.stability, 1); assert.equal(game.collapse, null); assert.equal(game.phase, 'swinging');
  advance(0.4); assert.equal(game.score, 0, 'old fall cannot resolve after restart');
});

check('records save on landings and survive storage being blocked', () => {
  startGame(base);
  for (let i = 0; i < 8; i++) place(0);
  assert.ok(Number(store.get('build-site:night-shift:best')) >= 8);
  const best = game.best;
  window.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  endGame(); startGame(base); assert.equal(game.best, best);
});

// Architectural geometry remains finite and bounded for complete reusable floors.
const floorSource = new URL('src/lib/game-floor.ts', root);
const floorResult = ts.transpileModule(fs.readFileSync(floorSource, 'utf8'), {
  fileName: floorSource.pathname,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }, reportDiagnostics: true,
});
assert.equal(floorResult.diagnostics.length, 0);
const floorJs = floorResult.outputText.replace(/from (["'])\.\/stack-game\1/g, `from '${engineUrl}'`);
const { floorParts } = await import('data:text/javascript;base64,' + Buffer.from(floorJs).toString('base64'));
const finishes = ['concrete', 'steel', 'window', 'light', 'interior'];

check('complete floor architecture stays finite and within all rendering budgets', () => {
  for (const size of [6.4, 8]) for (const level of [0, 1, 17]) {
    const block = { ...base, width: size, depth: size, y: level * GAME_SLAB_HEIGHT, perfect: false };
    const parts = floorParts(block);
    assert.ok(parts.length > 0 && parts.length <= 160);
    for (const part of parts) {
      assert.ok(finishes.includes(part.finish));
      for (const key of ['x', 'y', 'z', 'width', 'height', 'depth']) assert.ok(Number.isFinite(part[key]));
      for (const key of ['width', 'height', 'depth']) assert.ok(part[key] > 0);
      assert.ok(part.x - part.width / 2 >= -block.width / 2 - 1e-9);
      assert.ok(part.x + part.width / 2 <= block.width / 2 + 1e-9);
      assert.ok(part.z - part.depth / 2 >= -block.depth / 2 - 1e-9);
      assert.ok(part.z + part.depth / 2 <= block.depth / 2 + 1e-9);
      assert.ok(part.y - part.height / 2 >= -1e-9);
      assert.ok(part.y + part.height / 2 <= GAME_SLAB_HEIGHT + 1e-9);
    }
    for (const finish of finishes) {
      const count = parts.filter(part => part.finish === finish).length;
      assert.ok(count * 32 <= 2048, 'tower batch stays within capacity');
      assert.ok(count * (1 + GAME_MAX_DEBRIS) <= 640, 'airborne batch stays within capacity');
    }
  }
});

check('leaning and falling transform complete floors without changing their facade geometry', () => {
  startGame(base); place(0.20);
  const floor = game.blocks.at(-1); const before = floorParts(floor);
  advance(0.25); assert.deepEqual(floorParts(floor), before);
  aim(1.1); drop(); advance(0.45);
  const piece = game.debris[0]; const debrisBefore = floorParts(piece);
  advance(0.2); assert.deepEqual(floorParts(piece), debrisBefore);
});

process.stdout.write(`${checks} checks passed.\n`);
