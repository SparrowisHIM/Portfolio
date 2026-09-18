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
uniform vec3 uShear;
uniform vec2 uWind;
uniform float uTear;
uniform float uHeight;
uniform float uLife;

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
varying float vFloor;

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
  // origin). Everything else condenses out of a vortex, unwinding from
  // high and wide round the site onto the grid as each member is called.
  float u = clamp(1.0 - ease, 0.0, 1.0);
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
  // Fade in over the flight.
  vBuilt = smoothstep(0.0, 0.5, p);

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

  // Steel is never completely still. A shimmer the size of a temperature
  // change runs through the frame, least at the base, most at the top, so
  // the building reads as a live object even with nothing happening.
  float life = uLife * (0.35 + 0.65 * flex) * step(0.999, p);
  world.x += sin(uTime * 0.9 + aSeed * 12.0) * 0.018 * life;
  world.y += sin(uTime * 1.3 + aSeed * 21.0) * 0.010 * life;
  world.z += cos(uTime * 1.1 + aSeed * 17.0) * 0.018 * life;

  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vSeed = aSeed;
  vHue = aHue;
  vLock = aLock;
  vAxis = position.y;
  vWeight = aWeight;
  vFloor = aFloor;
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
uniform float uForce;
uniform float uGlow;
uniform vec3 uWarm;
uniform vec3 uCold;
uniform float uActiveFloor;

varying vec3 vWorld;
varying vec3 vNormalW;
varying float vBuilt;
varying float vSeed;
varying float vHue;
varying float vLock;
varying float vAxis;
varying float vWeight;
varying float vFloor;

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
  // beams sit back, hairlines stay quiet — but they all have to be *there*.
  // Squaring the weight over a 0.16 floor put every beam, diagonal and rail
  // at a fifth of a column, so the frame read as a handful of posts with
  // nothing between them. The reference reads as fabric because the small
  // members are visible. Gentler curve, higher floor: columns still lead at
  // 1.0, floor beams land near 0.5, hairlines near 0.38.
  float w = mix(0.3, 1.0, pow(vWeight, 1.35));
  // Heat: 1 on the floor being worked, falling away sharply below it. A
  // gentle falloff left half the building in a muddy in-between; a floor
  // should read as clearly warm or clearly cold.
  float heat = exp(-pow(vFloor - uActiveFloor, 2.0) * 1.9);
  vec3 site = mix(uCold, uWarm, heat);
  vec3 col = (uBase * (0.7 + 0.3 * top) + vec3(0.22, 0.27, 0.4) * rim * (0.5 + uGlow)) * w;
  col += vec3(0.22, 0.14, 0.04) * smoothstep(0.8, 1.0, vWeight) * (0.3 + uGlow) * heat;
  if (uNode > 0.5) col += vec3(0.25, 0.28, 0.36) * uGlow * w;
  // Hairline light: a bright core along the axis and a slow iridescent
  // drift along the length, cool white to warm, so a line reads as light.
  float core = pow(max(dot(n, v), 0.0), 6.0);
  col += uBase * core * 0.5 * w;
  float drift = 0.5 + 0.5 * sin(vAxis * 4.0 + vSeed * 6.2831 + uTime * 0.35);
  col *= mix(vec3(0.94, 0.98, 1.06), vec3(1.06, 0.99, 0.94), drift);

  vec3 accent = vHue > 2.5 ? hue(vHue) : site;
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

  // Inspection, not deformation: the frame does not move when you point at
  // it. Nodes wake up under the cursor and a survey ring runs out from it
  // through the steel, lighting what it crosses.
  float dc = distance(vWorld, uCursor);
  float near = exp(-dc * dc / 9.0) * uCursorOn;
  col += accent * near * (0.35 + 0.9 * uNode);
  float sweep = fract(uTime * 0.5);
  float ring = exp(-pow(dc - sweep * 11.0, 2.0) * 0.7) * (1.0 - sweep) * uCursorOn * uForce;
  col += accent * ring * (0.5 + 0.9 * vWeight);
  if (uNode > 0.5 && vHue > 2.5) {
    float breathe = pow(0.5 + 0.5 * sin(uTime * 1.6 + vSeed * 6.0), 6.0);
    col += accent * breathe * 1.4;
  }

  // Finished floors go quiet and blue; the level being built holds the lamp.
  col *= mix(vec3(1.0), site * 1.25, 0.72) * (1.06 + 0.46 * heat) * (1.0 + 0.3 * smoothstep(0.75, 1.0, vWeight));

  gl_FragColor = vec4(col, vBuilt);
}
`;
