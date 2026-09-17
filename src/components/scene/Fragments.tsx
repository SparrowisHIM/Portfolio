"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRandom } from "@/lib/random";
import { cursor } from "@/lib/pulses";
import { wind } from "@/lib/wind";

type FragmentsProps = {
  seed: number;
  height: number;
  animate: boolean;
  count?: number;
};

/**
 * Loose structural fragments drifting in the void round the site: short
 * dark lines that turn slowly, ride the wind and give way to the cursor.
 */
export function Fragments({ seed, height, animate, count = 48 }: FragmentsProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const items = useMemo(() => {
    const rnd = createRandom(seed ^ 0xf4a6);
    return Array.from({ length: count }, () => {
      const a = rnd.range(0, Math.PI * 2);
      const r = rnd.range(11, 34);
      return {
        x: Math.cos(a) * r,
        y: rnd.range(0.5, height + 9),
        z: Math.sin(a) * r,
        length: rnd.range(0.5, 2.2),
        rx: rnd.range(0, Math.PI),
        ry: rnd.range(0, Math.PI),
        spin: rnd.range(-0.15, 0.15),
        phase: rnd.range(0, Math.PI * 2),
        px: 0,
        pz: 0,
      };
    });
  }, [seed, height, count]);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const t = wind.time;
    items.forEach((f, i) => {
      if (animate) {
        f.ry += f.spin * delta;
        // Give way to the cursor, then drift back.
        const dx = f.x + f.px - cursor.x;
        const dy = f.y - cursor.y;
        const dz = f.z + f.pz - cursor.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 36) {
          const k = (1 - Math.sqrt(d2) / 6) * delta * 2.5 * cursor.active;
          f.px += dx * k;
          f.pz += dz * k;
        }
        f.px -= f.px * delta * 0.8;
        f.pz -= f.pz * delta * 0.8;
      }
      const bob = Math.sin(t * 0.4 + f.phase) * 0.25;
      dummy.position.set(f.x + f.px + wind.dir[0] * wind.gust * 0.6, f.y + bob, f.z + f.pz + wind.dir[1] * wind.gust * 0.6);
      dummy.rotation.set(f.rx, f.ry, 0);
      dummy.scale.set(0.035, f.length, 0.035);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#232b3a" transparent opacity={0.75} />
    </instancedMesh>
  );
}
