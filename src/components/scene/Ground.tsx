"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { SIDE_ANGLE } from "@/lib/site-generator";
import { groundTexture } from "@/lib/textures";
import { box, type Instance } from "@/lib/geometry";
import { Instances } from "./Instances";
import { materials, palette } from "./materials";

/** Mud, gravel and tyre tracks inside the hoarding; a road with a kerb outside it. */
export function Ground({ site }: { site: Site }) {
  const m = materials();
  const ground = useMemo(
    () => new THREE.MeshStandardMaterial({ map: groundTexture(3), roughness: 1, color: "#9aa6b4" }),
    [],
  );
  const asphalt = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0a1119", roughness: 0.95 }), []);
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9cfd6", roughness: 0.8 }), []);

  const { hoarding } = site;
  const bannerAngle = SIDE_ANGLE[hoarding.bannerSide];
  const horizontal = hoarding.bannerSide === "+z" || hoarding.bannerSide === "-z";
  const halfOut = horizontal ? hoarding.halfDepth : hoarding.halfWidth;
  const halfAlong = horizontal ? hoarding.halfWidth : hoarding.halfDepth;
  const roadOut = halfOut + 5;

  const dashes = useMemo<Instance[]>(() => {
    const items: Instance[] = [];
    for (let a = -halfAlong - 20; a < halfAlong + 20; a += 3) {
      items.push(box([a, 0.012, 0], [1.6, 0.01, 0.12]));
    }
    return items;
  }, [halfAlong]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} material={ground}>
        <planeGeometry args={[260, 260]} />
      </mesh>
      {/* Setting-out grid, faint enough to read as chalk lines on the ground. */}
      <gridHelper args={[60, 30, "#1b2c42", "#132238"]} position={[0, 0.005, 0]}>
        <lineBasicMaterial attach="material" color="#22374f" transparent opacity={0.35} depthWrite={false} />
      </gridHelper>
      {/* The road past the site, with a kerb along the hoarding. */}
      <group rotation={[0, bannerAngle, 0]}>
        <group position={[0, 0, roadOut]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} material={asphalt}>
            <planeGeometry args={[halfAlong * 2 + 60, 7.5]} />
          </mesh>
          <Instances items={dashes} material={paint} />
          <mesh position={[0, 0.08, -3.9]} material={m.concreteDark}>
            <boxGeometry args={[halfAlong * 2 + 60, 0.16, 0.3]} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -4.8]} material={m.concreteDark}>
            <planeGeometry args={[halfAlong * 2 + 60, 1.5]} />
          </mesh>
        </group>
      </group>
      <color attach="background" args={[palette.night]} />
    </group>
  );
}
