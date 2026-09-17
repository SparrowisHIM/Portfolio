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

attribute float aFloor;
attribute float aStart;
attribute float aDur;
attribute vec3 aOrigin;
attribute float aSeed;
attribute float aHue;
attribute float aLock;

varying vec3 vWorld;
varying vec3 vNormalW;
varying float vBuilt;
varying float vSeed;
varying float vHue;
varying float vLock;
varying float vAxis;

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
  // Fly in from the origin offset.
  world.xyz += aOrigin * (1.0 - ease);
  // Fade in over the first part of the flight.
  vBuilt = smoothstep(0.0, 0.35, p);

  // The cursor is a weak magnetic field: nearby geometry leans toward where
  // it just was and lags behind its motion.
  if (uForce > 0.5) {
    vec3 d = world.xyz - uCursor;
    float r2 = dot(d, d);
    float fall = exp(-r2 / 14.0) * uCursorOn;
    vec3 dir = length(d) > 0.001 ? d / length(d) : vec3(0.0);
    world.xyz += (dir * 0.08 - uCursorVel * 0.012) * fall * step(0.999, p);
  }

  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vSeed = aSeed;
  vHue = aHue;
  vLock = aLock;
  vAxis = position.y;
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

varying vec3 vWorld;
varying vec3 vNormalW;
varying float vBuilt;
varying float vSeed;
varying float vHue;
varying float vLock;
varying float vAxis;

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
  // Graphite: a little top light, a faint rim so edges read in the dark.
  float top = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = uBase * (0.55 + 0.45 * top) + vec3(0.10, 0.12, 0.16) * rim;

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
