"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRandom } from "@/lib/random";
import { palette } from "./materials";

type DustProps = {
  seed: number;
  height: number;
  animate: boolean;
  count?: number;
};

/** Slow-drifting dust caught in the work lights. */
export function Dust({ seed, height, animate, count = 500 }: DustProps) {
  const points = useRef<THREE.Points>(null);
  const spread = 22;

  const { positions, speeds } = useMemo(() => {
    const rnd = createRandom(seed ^ 0x9e3779b9);
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rnd.range(-spread, spread);
      positions[i * 3 + 1] = rnd.range(0, height + 8);
      positions[i * 3 + 2] = rnd.range(-spread, spread);
      speeds[i] = rnd.range(0.08, 0.3);
    }
    return { positions, speeds };
  }, [seed, height, count]);

  useFrame((_, delta) => {
    if (!animate || !points.current) return;
    const attr = points.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = performance.now() * 0.0004;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * delta;
      arr[i * 3] += Math.sin(t + i) * 0.002;
      if (arr[i * 3 + 1] > height + 8) arr[i * 3 + 1] = 0;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} key={seed}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={palette.sodium}
        size={0.09}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
