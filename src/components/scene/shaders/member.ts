import { MAX_FLOORS } from "@/lib/structure";
import { MAX_PULSES } from "@/lib/pulses";

/**
 * Structural members and nodes. Every instance carries its own assembly
 * timing, so the whole skeleton flies in, overshoots, snaps and shivers on
 * the GPU from a handful of uniforms: the smoothed progress of each floor,
 * the cursor, and the pulses travelling through the structure.
 */

export const memberDefines = { MAX_FLOORS, MAX_PULSES };

export const memberVertex = /* glsl */ `
uniform float uProgress[MAX_FLOORS];
uniform float uTime;
uniform vec3 uCursor;
uniform vec3 uCursorVel;
uniform float uCursorOn;
uniform float uForce;
uniform vec3 uShear;
uniform vec2 uWind;
uniform float uTear;
uniform float uHeight;
uniform float uSection;

attribute float aFloor;
attribute float aStart;
attribute float aDur;
attribute vec3 aOrigin;
attribute float aSeed;
attribute float aHue;
attribute float aLock;
attribute float aWeight;

varying vec3 vWorld;
varying vec3 vNormalW;
varying float vBuilt;
varying float vSeed;
varying float vHue;
varying float vLock;
varying float vAxis;
varying float vWeight;

// Overshoot on arrival, then settle.
float backOut(float t) {
  float c1 = 1.9;
  float c3 = c1 + 1.0;
  float u = t - 1.0;
  return 1.0 + c3 * u * u * u + c1 * u * u;
}

void main() {
  int fi = int(aFloor + 0.5);
  float progress = uProgress[fi];
  // 0 before arrival, 1 once locked.
  float p = clamp((progress - aStart) / aDur, 0.0, 1.0);
  float age = max(0.0, progress - aStart - aDur);

  vec3 local = position;
  // Stretch along the member axis as it lands: 4 percent long, then settles.
  float ease = backOut(p);
  float stretch = 1.0 + 0.06 * sin(3.1416 * p) * (1.0 - p * 0.5);
  local.y *= stretch;
  // Shiver right after locking, in real time, decaying with the scroll age.
  float shiver = exp(-age * 45.0) * step(0.999, p) * 0.012 * sin(uTime * 70.0 + aSeed * 40.0);
  local.x += shiver;

  vec4 world = instanceMatrix * vec4(local, 1.0);
  world = modelMatrix * world;
  // Arrival. Frame members come straight down off the hook (a short
  // origin). Everything else condenses out of a vortex: the next floor
  // already exists as a faint swarm of lines circling high round the site,
  // which unwinds onto the grid as each member is called.
  float u = clamp(1.0 - ease, 0.0, 1.0);
  float pre = clamp((uSection - (aFloor - 1.5)) / 0.8, 0.0, 1.0);
  if (length(aOrigin) > 0.35) {
    float ang = u * u * 2.6 + u * uTime * 0.25 + aSeed * 0.5 * u;
    float rad = 1.0 + u * (1.2 + aSeed * 1.2);
    float cs = cos(ang);
    float sn = sin(ang);
    world.xz = vec2(world.x * cs - world.z * sn, world.x * sn + world.z * cs) * rad;
    world.y += u * (2.0 + 3.5 * aSeed) - u * u;
    world.xyz += aOrigin * (1.0 - ease) * 0.3;
  } else {
    world.xyz += aOrigin * (1.0 - ease);
  }
  // Fade in over the flight; the swarm before it is a ghost.
  vBuilt = max(smoothstep(0.0, 0.5, p), pre * 0.16 * (1.0 - step(0.001, p)));

  // The whole structure is one live field. Scroll shear: the stack lags
  // the scroll and whips back, more the higher up it is, a tower flexing
  // at its root. Wind leans on the top. A fast scroll tears the skeleton
  // into a swarm that settles again when the page stops.
  float h = clamp(world.y / uHeight, 0.0, 1.0);
  float flex = h * h;
  world.xyz += uShear * flex;
  float sway = 0.5 + 0.5 * sin(uTime * 0.6 + aSeed * 6.2831);
  world.xz += uWind * flex * (0.6 + 0.4 * sway);
  if (uTear > 0.001) {
    vec3 scatter = vec3(sin(aSeed * 91.7), 0.5 * cos(aSeed * 57.3), sin(aSeed * 33.1 + 1.0));
    float loose = 0.4 + 1.2 * (1.0 - aWeight);
    world.xyz += scatter * uTear * loose;
    float tw = uTear * 0.5 * flex * (aSeed - 0.5);
    float cs = cos(tw);
    float sn = sin(tw);
    world.xz = vec2(world.x * cs - world.z * sn, world.x * sn + world.z * cs);
  }

  // The cursor is a finger on silk: nearby lines are drawn toward it and
  // lag its motion, and while it moves a ripple runs out through the lines.
  if (uForce > 0.5) {
    vec3 d = world.xyz - uCursor;
    float r = length(d);
    float fall = exp(-r * r / 20.0) * uCursorOn;
    vec3 dir = r > 0.001 ? d / r : vec3(0.0);
    float moving = min(1.0, length(uCursorVel) * 0.4);
    float ripple = sin(r * 1.8 - uTime * 6.0) * exp(-r / 7.0) * uCursorOn * moving * 0.06 * (0.3 + 0.7 * (1.0 - aWeight));
    world.xyz += ((-dir * 0.22 - uCursorVel * 0.02) * fall + dir * ripple) * step(0.999, p);
  }

  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vSeed = aSeed;
  vHue = aHue;
  vLock = aLock;
  vAxis = position.y;
  vWeight = aWeight;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const memberFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uCursor;
uniform float uCursorOn;
uniform vec4 uPulses[MAX_PULSES];
uniform vec3 uPulseHue[MAX_PULSES];
uniform vec3 uBase;
uniform float uNode;
uniform float uGlow;

varying vec3 vWorld;
varying vec3 vNormalW;
varying float vBuilt;
varying float vSeed;
varying float vHue;
varying float vLock;
varying float vAxis;
varying float vWeight;

vec3 hue(float h) {
  if (h < 0.5) return vec3(1.0, 0.70, 0.28);
  if (h < 1.5) return vec3(0.50, 0.72, 1.0);
  if (h < 2.5) return vec3(0.92, 0.94, 1.0);
  return vec3(1.0, 0.28, 0.22);
}

void main() {
  if (vBuilt <= 0.001) discard;
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vWorld);
  // Drawn wire: self-lit so it reads against the void, brighter at the rim.
  float top = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  // Hierarchy by weight: columns carry the resting light and run warm,
  // beams sit back, hairlines barely register until something lights them.
  float w = mix(0.26, 1.0, vWeight * vWeight);
  vec3 col = (uBase * (0.7 + 0.3 * top) + vec3(0.22, 0.27, 0.4) * rim * (0.5 + uGlow)) * w;
  col += vec3(0.22, 0.14, 0.04) * smoothstep(0.8, 1.0, vWeight) * (0.3 + uGlow);
  if (uNode > 0.5) col += vec3(0.25, 0.28, 0.36) * uGlow * w;
  // Hairline light: a bright core along the axis and a slow iridescent
  // drift along the length, cool white to warm, so a line reads as light.
  float core = pow(max(dot(n, v), 0.0), 3.0);
  col += uBase * core * 0.6 * w;
  float drift = 0.5 + 0.5 * sin(vAxis * 4.0 + vSeed * 6.2831 + uTime * 0.35);
  col *= mix(vec3(0.82, 0.94, 1.18), vec3(1.16, 0.96, 0.84), drift);

  vec3 accent = hue(vHue);
  // Connection flash: bright for a moment after locking, then dark again.
  float since = uTime - vLock;
  float flash = vLock > 0.0 ? exp(-since * 3.2) : 0.0;
  col += accent * flash * (0.9 + 1.8 * step(0.5, vSeed));

  // Pulses travelling out from an event, a wave front that fades as it goes.
  for (int i = 0; i < MAX_PULSES; i++) {
    vec4 pl = uPulses[i];
    if (pl.w < 0.0) continue;
    float t = uTime - pl.w;
    float d = distance(vWorld, pl.xyz);
    float front = t * 11.0;
    float wave = exp(-abs(d - front) * 0.9) * exp(-t * 1.1) * step(0.0, t);
    col += uPulseHue[i] * wave * 1.6;
  }

  // Nodes wake up near the cursor; a warning node breathes red on its own.
  float near = exp(-dot(vWorld - uCursor, vWorld - uCursor) / 9.0) * uCursorOn;
  col += accent * near * (0.35 + 0.9 * uNode);
  if (uNode > 0.5 && vHue > 2.5) {
    float breathe = pow(0.5 + 0.5 * sin(uTime * 1.6 + vSeed * 6.0), 6.0);
    col += accent * breathe * 1.4;
  }

  gl_FragColor = vec4(col, vBuilt);
}
`;
