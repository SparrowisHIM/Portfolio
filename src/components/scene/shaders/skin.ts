import { MAX_FLOORS } from "@/lib/structure";
import { MAX_PULSES } from "@/lib/pulses";

/**
 * The skin: smoked, near-black panels that grow over finished floors and
 * never quite hide the skeleton. The cursor x-rays a soft hole through them.
 */

export const skinDefines = { MAX_FLOORS, MAX_PULSES };

export const skinVertex = /* glsl */ `
uniform float uProgress[MAX_FLOORS];
uniform float uActive;

attribute float aFloor;
attribute vec2 aPerimeter;
attribute float aMaxSkin;
attribute float aPlate;

varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vSkin;
varying vec2 vPerimeter;
varying float vPlate;
varying float vFloor;

void main() {
  int fi = int(aFloor + 0.5);
  float built = smoothstep(0.86, 1.0, uProgress[fi]);
  // Skin grows as construction moves on above: active floor bare, three
  // floors down finished.
  float grow = smoothstep(0.0, 2.6, uActive - aFloor - 0.35);
  vSkin = built * grow * aMaxSkin;
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vUv = uv;
  vPerimeter = aPerimeter;
  vPlate = aPlate;
  vFloor = aFloor;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const skinFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uCursor;
uniform float uXray;
uniform float uCompleted[MAX_FLOORS];
uniform vec4 uPulses[MAX_PULSES];
uniform vec3 uPulseHue[MAX_PULSES];
uniform vec3 uAccent;

varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vSkin;
varying vec2 vPerimeter;
varying float vPlate;
varying float vFloor;

void main() {
  if (vSkin <= 0.002) discard;
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vWorld);
  float facing = abs(dot(n, v));
  float fresnel = pow(1.0 - facing, 2.5);

  // X-ray: a soft hole around the cursor.
  float d2 = dot(vWorld - uCursor, vWorld - uCursor);
  float hole = exp(-d2 / 7.0) * uXray;
  float skin = vSkin * (1.0 - hole);

  // Smoked glass: darker face-on, a little lighter at grazing angles.
  vec3 col = mix(vec3(0.02, 0.03, 0.05), vec3(0.09, 0.12, 0.17), fresnel);
  float alpha = mix(0.66, 0.9, fresnel) * skin;
  if (vPlate > 0.5) alpha = 0.38 * skin;

  // Thin edge lines on each panel, faintly lit.
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.0, 0.03, min(e.x, e.y));
  col += vec3(0.16, 0.19, 0.26) * edge * 0.6;
  alpha = max(alpha, edge * 0.35 * skin);

  // When a floor completes, one pulse runs round its outline.
  if (vPerimeter.x >= 0.0) {
    int fi = int(vFloor + 0.5);
    float since = uTime - uCompleted[fi];
    if (uCompleted[fi] > 0.0 && since < 3.0) {
      float here = mix(vPerimeter.x, vPerimeter.y, vUv.x);
      float head = fract(since * 0.55);
      float dist = min(abs(here - head), 1.0 - abs(here - head));
      float run = exp(-dist * 40.0) * exp(-since * 0.9);
      col += uAccent * run * edge * 3.0;
      alpha = max(alpha, run * edge);
    }
  }

  // Pulses through the structure show on the skin edges too.
  for (int i = 0; i < MAX_PULSES; i++) {
    vec4 pl = uPulses[i];
    if (pl.w < 0.0) continue;
    float t = uTime - pl.w;
    float dd = distance(vWorld, pl.xyz);
    float wave = exp(-abs(dd - t * 11.0) * 0.9) * exp(-t * 1.1) * step(0.0, t);
    col += uPulseHue[i] * wave * edge * 1.2;
  }

  // The skeleton showing through the hole: a faint glow where the skin is gone.
  col += uAccent * hole * 0.05;

  gl_FragColor = vec4(col, alpha);
}
`;
