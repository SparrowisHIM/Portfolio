"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, SLAB_THICKNESS } from "@/lib/site-generator";
import { craneJob, lerp, smoothstep } from "@/lib/construction";

type SparksProps = {
  site: Site;
  section: RefObject<number>;
  animate: boolean;
  count?: number;
};

const GRAVITY = -14;

/** Welding sparks at the top of whichever column is being raised right now. */
export function Sparks({ site, section, animate, count = 180 }: SparksProps) {
  const points = useRef<THREE.Points>(null);
  const flash = useRef<THREE.PointLight>(null);
  const positions = useMemo(() => new Float32Array(count * 3).fill(-100), [count]);
  const velocities = useMemo(() => new Float32Array(count * 3), [count]);
  const life = useMemo(() => new Float32Array(count), [count]);
  const cursor = useRef(0);
  const column = useRef(0);
  const origin = useRef(new THREE.Vector3(0, -100, 0));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const job = craneJob(site, section.current ?? 0);
    const floor = site.floors[job.index];
    const welding = animate && !!floor && job.t > 0.02 && job.t < 0.32;

    if (welding) {
      // Weld at the current top of a column; switch columns now and then.
      if (Math.random() < 0.02) column.current = Math.floor(Math.random() * floor.columns.length);
      const [cx, cz] = floor.columns[column.current] ?? [0, 0];
      const wallHeight = FLOOR_HEIGHT - SLAB_THICKNESS;
      const rise = lerp(0.18, 1, smoothstep(0, 0.3, job.t));
      origin.current.set(cx, floor.y - wallHeight + wallHeight * rise, cz);

      const burst = Math.random() < 0.7 ? 6 : 0;
      for (let n = 0; n < burst; n++) {
        const i = cursor.current;
        cursor.current = (cursor.current + 1) % count;
        positions[i * 3] = origin.current.x;
        positions[i * 3 + 1] = origin.current.y;
        positions[i * 3 + 2] = origin.current.z;
        const a = Math.random() * Math.PI * 2;
        const s = 1.5 + Math.random() * 3.5;
        velocities[i * 3] = Math.cos(a) * s;
        velocities[i * 3 + 1] = 2 + Math.random() * 4;
        velocities[i * 3 + 2] = Math.sin(a) * s;
        life[i] = 0.35 + Math.random() * 0.5;
      }
    }

    for (let i = 0; i < count; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      velocities[i * 3 + 1] += GRAVITY * dt;
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      if (life[i] <= 0) positions[i * 3 + 1] = -100;
    }
    if (points.current) {
      (points.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
    if (flash.current) {
      flash.current.position.copy(origin.current);
      flash.current.intensity = welding ? (Math.random() < 0.6 ? 90 : 10) : 0;
    }
  });

  return (
    <>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffd08a"
          size={0.11}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <pointLight ref={flash} color="#bfe0ff" intensity={0} distance={9} decay={2} />
    </>
  );
}
