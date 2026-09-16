"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { builtHeight } from "@/lib/construction";
import { InstancedBoxes, type BoxInstance } from "./InstancedBoxes";
import { palette } from "./materials";

const POLE = 0.09;
const LEDGER = 0.07;

type ScaffoldProps = {
  site: Site;
  section: RefObject<number>;
};

/** Scaffolding climbs with the building: everything above the built height is clipped. */
export function Scaffold({ site, section }: ScaffoldProps) {
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 4));
  const materials = useMemo(() => {
    const clip = [plane.current];
    return {
      steel: new THREE.MeshStandardMaterial({
        color: palette.steel,
        roughness: 0.45,
        metalness: 0.7,
        clippingPlanes: clip,
      }),
      plank: new THREE.MeshStandardMaterial({
        color: "#8c7351",
        roughness: 0.9,
        clippingPlanes: clip,
      }),
    };
  }, []);

  useFrame((_, delta) => {
    const top = builtHeight(site, section.current ?? 0) + 1.6;
    plane.current.constant = THREE.MathUtils.damp(plane.current.constant, top, 5, delta);
  });

  const poles = useMemo<BoxInstance[]>(
    () =>
      site.poles.map((p) => ({
        position: [p.position[0], p.height / 2, p.position[2]],
        scale: [POLE, p.height, POLE],
      })),
    [site],
  );

  const ledgers = useMemo<BoxInstance[]>(
    () =>
      site.ledgers.map((l) => ({
        position: l.position,
        scale: l.axis === "x" ? [l.length, LEDGER, LEDGER] : [LEDGER, LEDGER, l.length],
      })),
    [site],
  );

  const planks = useMemo<BoxInstance[]>(
    () =>
      site.planks.map((p) => ({
        position: p.position,
        scale: p.axis === "x" ? [p.length, 0.06, 0.85] : [0.85, 0.06, p.length],
      })),
    [site],
  );

  return (
    <group>
      <InstancedBoxes items={poles} material={materials.steel} />
      <InstancedBoxes items={ledgers} material={materials.steel} />
      <InstancedBoxes items={planks} material={materials.plank} />
    </group>
  );
}
