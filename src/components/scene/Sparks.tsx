"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, SLAB_THICKNESS } from "@/lib/site-generator";
import { craneJob, lerp, smoothstep } from "@/lib/construction";
import { wind } from "@/lib/wind";

type SparksProps = {
  site: Site;
  section: RefObject<number>;
  animate: boolean;
  count?: number;
};

const GRAVITY = -14;

/** Welding sparks at the top of whichever column is being raised right now. */
export function Sparks({ site, section, animate, count = 220 }: SparksProps) {
  const points = useRef<THREE.Points>(null);
  const flash = useRef<THREE.PointLight>(null);
  const positions = useMemo(() => new Float32Array(count * 3).fill(-100), [count]);
  const velocities = useMemo(() => new Float32Array(count * 3), [count]);
  const life = useMemo(() => new Float32Array(count), [count]);
  const cursor = useRef(0);
  const origin = useRef(new THREE.Vector3(0, -100, 0));

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const job = craneJob(site, section.current ?? 0);
    const isTop = job.index >= site.floors.length;
    const level = isTop ? site.topLevel : site.floors[job.index];
    const welding = animate && !!level && job.t > 0.02 && job.t < 0.32;

    if (welding) {
      // Weld at the current top of a column; the welder moves between columns.
      const columns = level.columns;
      const [cx, cz] = columns[Math.floor(clock.getElapsedTime() / 4) % Math.max(1, columns.length)] ?? [0, 0];
      const wallHeight = FLOOR_HEIGHT - SLAB_THICKNESS;
      const rise = lerp(0.06, 1, smoothstep(0, 0.3, job.t));
      const baseY = (isTop ? site.topLevel.y : level.y) - wallHeight;
      origin.current.set(cx, baseY + wallHeight * rise, cz);

      const burst = Math.random() < 0.7 ? 7 : 0;
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

    const wx = wind.dir[0] * wind.gust * 2;
    const wz = wind.dir[1] * wind.gust * 2;
    for (let i = 0; i < count; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      velocities[i * 3 + 1] += GRAVITY * dt;
      positions[i * 3] += (velocities[i * 3] + wx) * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += (velocities[i * 3 + 2] + wz) * dt;
      if (life[i] <= 0) positions[i * 3 + 1] = -100;
    }
    if (points.current) {
      (points.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
    if (flash.current) {
      flash.current.position.copy(origin.current);
      flash.current.intensity = welding ? (Math.random() < 0.6 ? 110 : 12) : 0;
    }
  });

  return (
    <>
      <points ref={points} frustumCulled={false}>
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
