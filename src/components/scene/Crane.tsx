"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { SLAB_THICKNESS } from "@/lib/site-generator";
import { concrete, palette, safety, steel } from "./materials";

type CraneProps = {
  site: Site;
  animate: boolean;
};

const MAST = 0.7;

export function Crane({ site, animate }: CraneProps) {
  const { crane } = site;
  const slew = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.getElapsedTime();
    if (slew.current) {
      slew.current.rotation.y = crane.angle + Math.sin(t * 0.12) * 0.22;
    }
    if (load.current) {
      load.current.rotation.z = Math.sin(t * 0.9) * 0.02;
      load.current.rotation.x = Math.cos(t * 0.7) * 0.015;
    }
  });

  const mastSegments = Math.floor(crane.mastHeight / 1.6);

  return (
    <group position={crane.position}>
      {/* Base */}
      <mesh position={[0, 0.25, 0]} material={concrete}>
        <boxGeometry args={[2.4, 0.5, 2.4]} />
      </mesh>
      {/* Mast: a solid core with a lattice of horizontal ties */}
      <mesh position={[0, crane.mastHeight / 2, 0]} material={safety}>
        <boxGeometry args={[MAST, crane.mastHeight, MAST]} />
      </mesh>
      {Array.from({ length: mastSegments }, (_, i) => (
        <mesh key={i} position={[0, (i + 0.5) * 1.6, 0]} material={steel}>
          <boxGeometry args={[MAST + 0.16, 0.05, MAST + 0.16]} />
        </mesh>
      ))}
      {/* Slewing unit */}
      <group
        ref={slew}
        position={[0, crane.mastHeight, 0]}
        rotation={[0, crane.angle, 0]}
      >
        <mesh position={[0, 0.4, 0]} material={safety}>
          <boxGeometry args={[1.1, 0.8, 1.1]} />
        </mesh>
        {/* Cab */}
        <mesh position={[0.8, 0.25, 0]}>
          <boxGeometry args={[0.7, 0.7, 0.8]} />
          <meshStandardMaterial
            color={palette.glass}
            emissive={palette.sodium}
            emissiveIntensity={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* Jib */}
        <mesh position={[0, 0.9, crane.jibLength / 2]} material={safety}>
          <boxGeometry args={[0.35, 0.35, crane.jibLength]} />
        </mesh>
        {/* Counter jib and counterweight */}
        <mesh
          position={[0, 0.9, -crane.counterJibLength / 2]}
          material={safety}
        >
          <boxGeometry args={[0.35, 0.35, crane.counterJibLength]} />
        </mesh>
        <mesh
          position={[0, 0.4, -crane.counterJibLength + 0.6]}
          material={concrete}
        >
          <boxGeometry args={[1, 1.1, 1.4]} />
        </mesh>
        {/* Tower peak with pendant lines */}
        <mesh position={[0, 2.4, 0]} material={safety}>
          <boxGeometry args={[0.2, 3, 0.2]} />
        </mesh>
        <Pendant from={[0, 3.9, 0]} to={[0, 1.05, crane.jibLength * 0.75]} />
        <Pendant
          from={[0, 3.9, 0]}
          to={[0, 1.05, -crane.counterJibLength + 0.4]}
        />
        {/* Trolley, cable and the slab being lowered */}
        <group position={[0, 0.72, crane.trolley]}>
          <mesh material={steel}>
            <boxGeometry args={[0.5, 0.3, 0.6]} />
          </mesh>
          <mesh position={[0, -crane.hookDrop / 2, 0]}>
            <boxGeometry args={[0.025, crane.hookDrop, 0.025]} />
            <meshStandardMaterial
              color={palette.steel}
              metalness={0.9}
              roughness={0.3}
            />
          </mesh>
          <group ref={load} position={[0, -crane.hookDrop, 0]}>
            <mesh position={[0, -0.15, 0]} material={steel}>
              <boxGeometry args={[0.25, 0.3, 0.12]} />
            </mesh>
            {/* Sling lines */}
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                position={[s * 0.6, -0.5, 0]}
                rotation={[0, 0, s * 0.55]}
                material={steel}
              >
                <boxGeometry args={[0.02, 1.3, 0.02]} />
              </mesh>
            ))}
            <mesh position={[0, -1.05, 0]} material={concrete}>
              <boxGeometry args={[2.6, SLAB_THICKNESS, 1.6]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

function Pendant({
  from,
  to,
}: {
  from: [number, number, number];
  to: [number, number, number];
}) {
  const { mid, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    return {
      mid: a.clone().add(b).multiplyScalar(0.5),
      length: dir.length(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.clone().normalize(),
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...from, ...to]);

  return (
    <mesh position={mid} quaternion={quaternion} material={steel}>
      <boxGeometry args={[0.03, length, 0.03]} />
    </mesh>
  );
}
