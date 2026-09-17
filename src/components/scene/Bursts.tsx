"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { events, HUES } from "@/lib/pulses";

type BurstsProps = {
  animate: boolean;
  count?: number;
};

/**
 * A pooled particle spray for connection moments: a few sparks thrown from
 * a point, coloured by the event, falling and fading in under a second.
 */
export function Bursts({ animate, count = 480 }: BurstsProps) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(count * 3).fill(-1000), [count]);
  const colors = useMemo(() => new Float32Array(count * 3), [count]);
  const velocities = useMemo(() => new Float32Array(count * 3), [count]);
  const life = useMemo(() => new Float32Array(count), [count]);
  const cursor = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    if (animate) {
      while (events.bursts.length) {
        const b = events.bursts.shift()!;
        const [r, g, bl] = HUES[b.hue];
        for (let n = 0; n < b.count; n++) {
          const i = cursor.current;
          cursor.current = (cursor.current + 1) % count;
          positions[i * 3] = b.x;
          positions[i * 3 + 1] = b.y;
          positions[i * 3 + 2] = b.z;
          const a = Math.random() * Math.PI * 2;
          const u = Math.random() * 2 - 1;
          const s = 0.8 + Math.random() * 2.2;
          const h = Math.sqrt(1 - u * u);
          velocities[i * 3] = Math.cos(a) * h * s;
          velocities[i * 3 + 1] = u * s + 0.8;
          velocities[i * 3 + 2] = Math.sin(a) * h * s;
          colors[i * 3] = r;
          colors[i * 3 + 1] = g;
          colors[i * 3 + 2] = bl;
          life[i] = 0.35 + Math.random() * 0.5;
        }
      }
    } else {
      events.bursts.length = 0;
    }
    for (let i = 0; i < count; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      velocities[i * 3 + 1] -= 6 * dt;
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      const fade = Math.min(1, life[i] * 2.5);
      colors[i * 3] *= 0.97;
      colors[i * 3 + 1] *= 0.97;
      colors[i * 3 + 2] *= 0.97;
      if (life[i] <= 0 || fade <= 0) positions[i * 3 + 1] = -1000;
    }
    if (points.current) {
      (points.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (points.current.geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial vertexColors size={0.085} sizeAttenuation transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}
