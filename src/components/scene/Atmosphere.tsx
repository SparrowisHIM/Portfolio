"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The void gets a floor and a far distance.
 *
 * Pure black has no depth cue, so a tower in it reads as a model of unknown
 * size. Two almost invisible things fix that: a band of slightly-not-black
 * where the ground meets the sky, and a few layers of ground haze the base
 * of the building stands in. The haze is also what the work lights have to
 * scatter in — a light cone in a vacuum is not a light cone.
 */

const HORIZON_RADIUS = 150;
const HORIZON_HEIGHT = 100;
/** Where the shell crosses y = 0, as a fraction of its height. */
const HORIZON_AT = 0.18;

const horizonVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const horizonFragment = /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  // A soft band at the horizon line: tight below, feathered up into the sky.
  float d = vUv.y - ${HORIZON_AT.toFixed(3)};
  float a = exp(-abs(d) * (d > 0.0 ? 6.5 : 18.0));
  gl_FragColor = vec4(uColor, a * 0.6);
}
`;

const hazeVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const hazeFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uRadius;
uniform float uStrength;
varying vec3 vWorld;

void main() {
  // Slow blobby drift, so the murk is never a flat wash.
  float n = 0.5 + 0.5 * sin(vWorld.x * 0.13 + uTime * 0.06) * sin(vWorld.z * 0.11 - uTime * 0.045);
  n = 0.35 + 0.65 * n;
  float r = length(vWorld.xz) / uRadius;
  float a = uStrength * n * smoothstep(1.0, 0.2, r);
  // Thin it out close to the camera so you never fly through a bright sheet.
  float near = smoothstep(2.0, 12.0, distance(cameraPosition, vWorld));
  gl_FragColor = vec4(uColor, a * near);
}
`;

/** Height and weight of each haze layer, thinning as it rises. */
const LAYERS: [number, number][] = [
  [0.12, 1],
  [0.45, 0.82],
  [0.95, 0.6],
  [1.7, 0.42],
  [2.7, 0.26],
  [4.2, 0.14],
];

export function Atmosphere({ animate }: { animate: boolean }) {
  const haze = useRef<THREE.ShaderMaterial>(null);
  const radius = 62;

  const horizonUniforms = useMemo(() => ({ uColor: { value: new THREE.Color("#0c1a2c") } }), []);
  // One clock and one colour shared by every layer; only the weight differs.
  const layers = useMemo(() => {
    const uColor = { value: new THREE.Color("#16263c") };
    const uTime = { value: 0 };
    const uRadius = { value: radius };
    return LAYERS.map(([y, weight]) => ({
      y,
      uniforms: { uColor, uTime, uRadius, uStrength: { value: 0.05 * weight } },
    }));
  }, []);

  useFrame(({ clock }) => {
    if (animate && haze.current) haze.current.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <group>
      <mesh position={[0, HORIZON_HEIGHT * (0.5 - HORIZON_AT), 0]} renderOrder={-2}>
        <cylinderGeometry args={[HORIZON_RADIUS, HORIZON_RADIUS, HORIZON_HEIGHT, 48, 1, true]} />
        <shaderMaterial
          vertexShader={horizonVertex}
          fragmentShader={horizonFragment}
          uniforms={horizonUniforms}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          fog={false}
        />
      </mesh>
      {layers.map((layer, i) => (
        <mesh key={layer.y} position={[0, layer.y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
          <circleGeometry args={[radius, 64]} />
          <shaderMaterial
            ref={i === 0 ? haze : undefined}
            vertexShader={hazeVertex}
            fragmentShader={hazeFragment}
            uniforms={layer.uniforms}
            side={THREE.DoubleSide}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}
