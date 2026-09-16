"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Floor, Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, SLAB_THICKNESS } from "@/lib/site-generator";
import { concrete, concreteDark, createGlass, palette, steel } from "./materials";

const COLUMN = 0.36;

type Face = {
  key: string;
  visible: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
};

function FloorBlock({ floor, active }: { floor: Floor; active: boolean }) {
  const glass = useMemo(() => createGlass(), []);
  const light = useRef<THREE.PointLight>(null);
  const { width, depth, glazed, columns } = floor;
  const wallHeight = FLOOR_HEIGHT - SLAB_THICKNESS;

  const faces: Face[] = [
    { key: "+x", visible: glazed[0], position: [width / 2, wallHeight / 2, 0], rotation: [0, Math.PI / 2, 0], size: [depth, wallHeight] },
    { key: "-x", visible: glazed[1], position: [-width / 2, wallHeight / 2, 0], rotation: [0, -Math.PI / 2, 0], size: [depth, wallHeight] },
    { key: "+z", visible: glazed[2], position: [0, wallHeight / 2, depth / 2], rotation: [0, 0, 0], size: [width, wallHeight] },
    { key: "-z", visible: glazed[3], position: [0, wallHeight / 2, -depth / 2], rotation: [0, Math.PI, 0], size: [width, wallHeight] },
  ];

  // The floor being read lights up: glazing glows and a lamp inside comes on.
  useFrame((_, delta) => {
    const target = active ? 0.55 : 0.04;
    glass.emissiveIntensity = THREE.MathUtils.damp(glass.emissiveIntensity, target, 4, delta);
    if (light.current) {
      light.current.intensity = THREE.MathUtils.damp(light.current.intensity, active ? 40 : 0, 4, delta);
    }
  });

  return (
    <group position={[0, floor.y, 0]}>
      {/* Slab */}
      <mesh position={[0, SLAB_THICKNESS / 2, 0]} material={concrete}>
        <boxGeometry args={[width, SLAB_THICKNESS, depth]} />
      </mesh>
      {/* Edge beam under the slab */}
      <mesh position={[0, -0.12, 0]} material={concreteDark}>
        <boxGeometry args={[width - 0.2, 0.24, depth - 0.2]} />
      </mesh>
      {/* Columns */}
      {columns.map(([x, z], i) => (
        <mesh
          key={i}
          position={[x, SLAB_THICKNESS + wallHeight / 2, z]}
          material={floor.finished ? concrete : steel}
        >
          <boxGeometry args={[COLUMN, wallHeight, COLUMN]} />
        </mesh>
      ))}
      {/* Glazing */}
      {faces
        .filter((f) => f.visible)
        .map((f) => (
          <mesh
            key={f.key}
            position={[f.position[0], f.position[1] + SLAB_THICKNESS, f.position[2]]}
            rotation={f.rotation}
            material={glass}
          >
            <planeGeometry args={f.size} />
          </mesh>
        ))}
      <pointLight
        ref={light}
        position={[0, FLOOR_HEIGHT * 0.7, 0]}
        color={palette.sodium}
        intensity={0}
        distance={14}
        decay={2}
      />
    </group>
  );
}

function TopLevel({ site }: { site: Site }) {
  const { topLevel } = site;
  const stubHeight = FLOOR_HEIGHT * 0.55;
  return (
    <group position={[0, topLevel.y, 0]}>
      {topLevel.columns.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, stubHeight / 2, 0]} material={steel}>
            <boxGeometry args={[COLUMN, stubHeight, COLUMN]} />
          </mesh>
          {/* Rebar poking out of the unfinished column */}
          {[-0.1, 0.1].map((dx) =>
            [-0.1, 0.1].map((dz) => (
              <mesh key={`${dx}${dz}`} position={[dx, stubHeight + 0.45, dz]} material={steel}>
                <boxGeometry args={[0.03, 0.9, 0.03]} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

type FloorsProps = {
  site: Site;
  /** Index of the floor currently being read, or -1. */
  activeFloor: number;
};

export function Floors({ site, activeFloor }: FloorsProps) {
  return (
    <group>
      {site.floors.map((floor) => (
        <FloorBlock key={floor.index} floor={floor} active={floor.index === activeFloor} />
      ))}
      <TopLevel site={site} />
    </group>
  );
}
