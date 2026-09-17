"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { SLAB_THICKNESS } from "@/lib/site-generator";
import { remainingSlabs, yardPosition } from "@/lib/construction";
import { materials } from "./materials";

type YardProps = {
  site: Site;
  section: RefObject<number>;
};

/** The slab yard: precast floors stacked on timber bearers, waiting for the crane. */
export function Yard({ site, section }: YardProps) {
  const m = materials();
  const slabs = useRef<THREE.Mesh[]>([]);
  const position = yardPosition(site);
  const count = Math.max(0, site.floors.length - 1);
  const width = site.floors[1]?.width ?? 8;
  const depth = site.floors[1]?.depth ?? 6;

  useFrame(() => {
    const remaining = remainingSlabs(site, section.current ?? 0);
    slabs.current.forEach((mesh, i) => {
      mesh.visible = i < remaining;
    });
  });

  return (
    <group position={position}>
      {[-1, 0, 1].map((s) => (
        <mesh key={s} position={[s * width * 0.32, 0.08, 0]} material={m.plank}>
          <boxGeometry args={[0.3, 0.16, depth + 0.4]} />
        </mesh>
      ))}
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            if (mesh) slabs.current[i] = mesh;
          }}
          position={[0, 0.16 + SLAB_THICKNESS * (i + 0.5), 0]}
          material={m.concrete}
        >
          <boxGeometry args={[width, SLAB_THICKNESS, depth]} />
        </mesh>
      ))}
    </group>
  );
}
