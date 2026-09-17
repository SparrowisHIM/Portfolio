"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRandom } from "@/lib/random";
import { wind, windAt } from "@/lib/wind";

type DustProps = {
  seed: number;
  color: string;
  height: number;
  animate: boolean;
  count?: number;
};

/** Slow-drifting dust caught in the work lights, blown by the wind and stirred by the pointer. */
export function Dust({ seed, color, height, animate, count = 700 }: DustProps) {
  const points = useRef<THREE.Points>(null);
  const spread = 24;

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
    const attr = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = wind.time;
    const w = windAt(t) * 0.6;
    const wx = wind.dir[0] * w;
    const wz = wind.dir[1] * w;
    const stir = wind.stir;
    for (let i = 0; i < count; i++) {
      let x = arr[i * 3];
      let y = arr[i * 3 + 1];
      let z = arr[i * 3 + 2];
      y += speeds[i] * delta;
      x += (Math.sin(t + i) * 0.002 + wx * delta);
      z += (Math.cos(t * 0.7 + i) * 0.002 + wz * delta);
      // Scatter away from a fast-moving pointer.
      if (stir.strength > 0.02) {
        const dx = x - stir.x;
        const dy = y - stir.y;
        const dz = z - stir.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 16) {
          const k = (1 - Math.sqrt(d2) / 4) * stir.strength * delta * 2.5;
          x += (dx + stir.vx * 0.05) * k;
          y += (dy + stir.vy * 0.05) * k;
          z += (dz + stir.vz * 0.05) * k;
        }
      }
      if (y > height + 8) y = 0;
      if (x > spread) x -= spread * 2;
      if (x < -spread) x += spread * 2;
      if (z > spread) z -= spread * 2;
      if (z < -spread) z += spread * 2;
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} key={seed} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
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
