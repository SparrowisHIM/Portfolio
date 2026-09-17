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
uniform vec3 uShear;
uniform vec2 uWind;
uniform float uHeight;

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
varying float vMax;

void main() {
  int fi = int(aFloor + 0.5);
  float built = smoothstep(0.86, 1.0, uProgress[fi]);
  // Skin grows as construction moves on above: active floor bare, three
  // floors down finished.
  float grow = smoothstep(0.0, 1.3, uActive - aFloor - 0.15);
  vSkin = built * grow * aMaxSkin;
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  // The glass rides the same field as the skeleton.
  float h = clamp(world.y / uHeight, 0.0, 1.0);
  float flex = h * h;
  world.xyz += uShear * flex;
  world.xz += uWind * flex;
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vUv = uv;
  vPerimeter = aPerimeter;
  vPlate = aPlate;
  vFloor = aFloor;
  vMax = aMaxSkin;
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
uniform vec3 uWarm;
uniform vec3 uCold;
uniform float uActiveFloor;
uniform float uGlow;
uniform float uTear;

varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vSkin;
varying vec2 vPerimeter;
varying float vPlate;
varying float vFloor;
varying float vMax;

void main() {
  if (vSkin <= 0.002) discard;
  int fi = int(vFloor + 0.5);
  vec3 accent = mix(uCold, uWarm, exp(-pow(vFloor - uActiveFloor, 2.0) * 0.9));
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vWorld);
  float facing = abs(dot(n, v));
  float fresnel = pow(1.0 - facing, 2.5);

  // X-ray: the storey under the cursor opens, not a blob around it.
  float lateral = dot(vWorld.xz - uCursor.xz, vWorld.xz - uCursor.xz);
  float hole = exp(-pow((vWorld.y - uCursor.y) / 2.1, 2.0)) * exp(-lateral / 320.0) * uXray;
  float skin = vSkin * (1.0 - hole);

  // Smoked glass, near black, with a faint warm breath along the floor
  // line on finished floors only. Cooler and a little denser at the rim.
  vec3 glass = mix(vec3(0.028, 0.036, 0.055), vec3(0.22, 0.27, 0.36), fresnel);
  float finished = smoothstep(0.5, 1.0, vMax);
  float warm = vPlate > 0.5 ? 0.12 : 0.5 * pow(1.0 - vUv.y, 2.0);
  vec3 col = glass + accent * warm * finished * (0.03 + 0.25 * uGlow);
  float alpha = mix(0.55, 0.92, fresnel) * skin;
  if (vPlate > 0.5) alpha = 0.55 * skin;

  // Only the plate lines draw: a thin edge where the floor meets the glass.
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.0, 0.028, min(e.x, e.y));
  float plateLine = vPlate > 0.5 ? edge : (1.0 - smoothstep(0.0, 0.03, e.y));
  col += vec3(0.3, 0.34, 0.46) * plateLine * (0.25 + 0.4 * uGlow);
  alpha = max(alpha, plateLine * 0.5 * skin);

  if (vPlate > 0.5) {
    // The deck. A floor was a sheet of tinted nothing you could see straight
    // through; profiled metal decking gives it a direction and a surface,
    // and it is what you actually stand on before the screed goes down.
    float rib = abs(fract(vUv.x * 30.0) - 0.5) * 2.0;
    float ribLine = 1.0 - smoothstep(0.45, 0.95, rib);
    float bay = 1.0 - smoothstep(0.0, 0.02, abs(fract(vUv.y * 4.0) - 0.5) * 2.0 - 0.94);
    col += vec3(0.13, 0.15, 0.20) * ribLine * (0.35 + 0.4 * uGlow);
    col += vec3(0.20, 0.23, 0.30) * bay * (0.3 + 0.4 * uGlow);
    alpha = min(0.88, alpha + (0.26 + 0.18 * ribLine) * skin);
  } else {
    // Curtain wall. A wall was one flat quad of smoked glass; a real one is
    // a spandrel band hiding the slab edge, vision glass above it, and
    // mullions dividing the bay. All of it comes out of the UVs, so the
    // walls cost nothing and the building gets its horizontal banding.
    float spandrel = 1.0 - smoothstep(0.24, 0.29, vUv.y);
    col = mix(col, col * 0.5 + accent * 0.045 * finished, spandrel);
    alpha = mix(alpha, min(0.95 * skin, alpha + 0.36 * skin), spandrel);
    float mx = fract(vUv.x * 2.0);
    float mull = 1.0 - smoothstep(0.0, 0.03, min(mx, 1.0 - mx));
    float transom = 1.0 - smoothstep(0.0, 0.014, abs(vUv.y - 0.265));
    float head = 1.0 - smoothstep(0.0, 0.012, abs(vUv.y - 0.93));
    float frame = max(mull, max(transom, head));
    col += vec3(0.24, 0.28, 0.38) * frame * (0.3 + 0.45 * uGlow);
    alpha = max(alpha, frame * 0.55 * skin);
  }

  // When a floor completes, one pulse runs round its outline.
  if (vPerimeter.x >= 0.0) {
    float since = uTime - uCompleted[fi];
    if (uCompleted[fi] > 0.0 && since < 3.0) {
      float here = mix(vPerimeter.x, vPerimeter.y, vUv.x);
      float head = fract(since * 0.55);
      float dist = min(abs(here - head), 1.0 - abs(here - head));
      float run = exp(-dist * 40.0) * exp(-since * 0.9);
      col += accent * run * edge * 3.0;
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
  col += accent * hole * 0.05;
  // Torn open by a fast scroll: the glass goes first.
  alpha *= 1.0 - uTear * 0.9;

  gl_FragColor = vec4(col, alpha);
}
`;
