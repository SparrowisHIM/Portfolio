"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { groundFade, groundSurface } from "@/lib/textures";
import { createRandom } from "@/lib/random";

/*
  Both of these have to clear the camera's far plane from the *furthest the
  camera ever stands from the origin*, not from the origin itself — about 61
  on a wide screen and more in portrait. See the note on `far` in SiteScene:
  getting that wrong cuts a hole in the sky.
*/
const SKY = 165;
const GROUND = 150;

const skyVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/*
  A night sky, not a black rectangle.

  Two bands and a horizon. The lift from the zenith down to the horizon is
  what gives the scene a top and a bottom — in pure black the tower has no
  distance and no scale, which is exactly what "it's just pitch black" is
  describing. The horizon itself is a tight glow, brighter than the sky just
  above it and falling away fast below, the way a city night sky sits on a
  dark ground.
*/
const skyFragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uRadius;
varying vec3 vWorld;

void main() {
  float h = vWorld.y / uRadius;
  vec3 c;
  if (h >= 0.0) {
    c = mix(uHorizon, uZenith, pow(clamp(h * 1.9, 0.0, 1.0), 0.72));
    // The band sitting on the horizon line.
    c += uHorizon * 0.55 * exp(-h * 22.0);
  } else {
    /*
      Below the horizon, away fast.

      This is the part the ground disc is standing in front of, and the
      ground fades out with distance — so anything but near black down here
      shows *through* the fade and reads as a bright floor stretching to the
      horizon. The first pass fell off over thirty metres and put a mid navy
      across the whole bottom of the frame, which looked exactly like a
      ground that was too bright and was not the ground at all.
    */
    c = mix(uHorizon, uGround, clamp(-h * 14.0, 0.0, 1.0));
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

/**
 * What the site stands in.
 *
 * The scene was a black void with a lit model in it, which reads as a
 * product shot and stops reading as a place. A ground to stand on, a sky
 * with a horizon in it and some stars is the whole difference between a
 * model of a construction site and a construction site at night.
 *
 * It is all deliberately very dark. The building is the brightest thing in
 * frame by a wide margin and has to stay that way — the ground is here to
 * say *there is a ground*, not to be looked at.
 */
export function Surroundings({ seed }: { seed: number }) {
  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uZenith: { value: new THREE.Color("#05080f") },
          uHorizon: { value: new THREE.Color("#132132") },
          uGround: { value: new THREE.Color("#04060a") },
          uRadius: { value: SKY },
        },
      }),
    [],
  );

  const ground = useMemo(
    () =>
      /*
        Unlit, with the spill from the site painted into the texture.

        As a lit standard material this one disc cost a tenth of the frame
        rate — it is the largest surface in the frame and it was evaluating
        every light in the scene plus the studio cube map, per pixel, for a
        surface that never moves and that nothing walks on. Measured: 34fps
        without it, 33.4 with the sky and stars but no ground, 29.8 with it.
        The sky was never the expensive part.
      */
      new THREE.MeshBasicMaterial({
        map: groundSurface(),
        // Faded out with distance rather than ended with an edge: a disc
        // that simply stops draws a hard circle round the site.
        alphaMap: groundFade(),
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  const stars = useMemo(() => {
    const rnd = createRandom(seed ^ 0x57a5);
    const count = 520;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Above the horizon only, and thinning toward it.
      const a = rnd.range(0, Math.PI * 2);
      const h = Math.pow(rnd.range(0, 1), 0.65);
      const r = Math.sqrt(Math.max(0, 1 - h * h));
      pos[i * 3] = Math.cos(a) * r * (SKY - 6);
      pos[i * 3 + 1] = h * (SKY - 6);
      pos[i * 3 + 2] = Math.sin(a) * r * (SKY - 6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geometry;
  }, [seed]);

  const starMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#c8d4e8",
        // Pixels, not metres: a star is a point of light at any distance,
        // and attenuated ones flicker into and out of existence as the
        // camera dollies.
        size: 1.6,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const groundGeometry = useMemo(() => new THREE.CircleGeometry(GROUND, 64), []);
  const skyGeometry = useMemo(() => new THREE.SphereGeometry(SKY, 32, 20), []);

  return (
    <group>
      <mesh geometry={skyGeometry} material={sky} renderOrder={-3} frustumCulled={false} />
      <points geometry={stars} material={starMaterial} renderOrder={-2} frustumCulled={false} />
      {/*
        At the underside of the plinth, so the base sits on the ground rather
        than hovering over it or being buried in it.
      */}
      <mesh
        geometry={groundGeometry}
        material={ground}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.52, 0]}
        renderOrder={-1}
        frustumCulled={false}
      />
    </group>
  );
}
