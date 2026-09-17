"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { beamTexture } from "@/lib/textures";
import { materials } from "./materials";

/**
 * Work lamps: warm heads clamped to the scaffold and one on a stand by the
 * yard, each with a soft cone of light hanging in the dust. Sodium lamps
 * take a moment to strike and hum slightly.
 */
export function Lamps({ site, animate }: { site: Site; animate: boolean }) {
  const m = materials();
  const last = site.lamps.length - 1;
  const heads = useRef<THREE.MeshStandardMaterial[]>([]);
  const cones = useRef<THREE.Mesh[]>([]);
  const beam = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: site.lamp.color,
        alphaMap: beamTexture(),
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [site.lamp.color],
  );

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.getElapsedTime();
    heads.current.forEach((mat, i) => {
      if (!mat) return;
      // A faint mains flicker, different phase per lamp.
      const flick = 1 + Math.sin(t * 37 + i * 1.7) * 0.05 + Math.sin(t * 5.3 + i) * 0.04;
      mat.emissiveIntensity = 3 * flick;
    });
    beam.opacity = 0.085 + Math.sin(t * 1.3) * 0.01;
  });

  return (
    <group>
      {site.lamps.map((position, i) => {
        const stand = i === last;
        const aim = Math.atan2(-position[0], -position[2]);
        return (
          <group key={i} position={position} rotation={[0, aim, 0]}>
            {stand ? (
              <>
                {[0, 1, 2].map((k) => {
                  const a = (k / 3) * Math.PI * 2;
                  return (
                    <mesh key={k} position={[Math.cos(a) * 0.3, -1.3, Math.sin(a) * 0.3]} rotation={[Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22]} material={m.galvanised}>
                      <boxGeometry args={[0.03, 2.6, 0.03]} />
                    </mesh>
                  );
                })}
                <mesh position={[0, -0.6, 0]} material={m.galvanised}>
                  <boxGeometry args={[0.04, 1.4, 0.04]} />
                </mesh>
              </>
            ) : (
              <mesh position={[0, 0, -0.5]} material={m.steelDark}>
                <boxGeometry args={[0.05, 0.05, 1.0]} />
              </mesh>
            )}
            <group rotation={[0.55, 0, 0]}>
              <mesh material={m.steelDark} position={[0, 0, -0.06]}>
                <boxGeometry args={[0.5, 0.36, 0.12]} />
              </mesh>
              <mesh position={[0, 0, 0.01]}>
                <boxGeometry args={[0.44, 0.3, 0.02]} />
                <meshStandardMaterial
                  ref={(mat) => {
                    if (mat) heads.current[i] = mat;
                  }}
                  color={site.lamp.color}
                  emissive={site.lamp.color}
                  emissiveIntensity={3}
                  toneMapped={false}
                />
              </mesh>
              <mesh
                ref={(mesh) => {
                  if (mesh) cones.current[i] = mesh;
                }}
                position={[0, 0, 4.5]}
                rotation={[-Math.PI / 2, 0, 0]}
                material={beam}
              >
                <cylinderGeometry args={[0.2, 3.2, 9, 20, 1, true]} />
              </mesh>
            </group>
            <pointLight color={site.lamp.color} intensity={stand ? 70 : 32} distance={stand ? 30 : 17} decay={2} />
          </group>
        );
      })}
    </group>
  );
}
