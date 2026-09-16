"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Floor, Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, SLAB_THICKNESS } from "@/lib/site-generator";
import { PLACED_AT, floorProgress, lerp, smoothstep } from "@/lib/construction";
import { concrete, concreteDark, palette, steel } from "./materials";

const COLUMN = 0.36;
const STUB = 0.18;

const GLASS = {
  color: palette.glass,
  emissiveIntensity: 0.04,
  roughness: 0.15,
  metalness: 0.4,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
} as const;

type Face = {
  key: string;
  visible: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
};

type FloorBlockProps = {
  floor: Floor;
  active: boolean;
  lamp: string;
  /** Section value from scroll: 0 ground, 1..N floors, N+1 roof. */
  section: RefObject<number>;
  onSelect?: (index: number) => void;
};

/**
 * One floor, built in front of you. Column height, slab, glazing and lamp all
 * follow the floor's construction progress, which follows page scroll.
 */
function FloorBlock({ floor, active, lamp, section, onSelect }: FloorBlockProps) {
  const glazing = useRef<THREE.MeshStandardMaterial[]>([]);
  const glazingMeshes = useRef<THREE.Mesh[]>([]);
  const columns = useRef<THREE.Mesh[]>([]);
  const slab = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const { width, depth, glazed } = floor;
  const wallHeight = FLOOR_HEIGHT - SLAB_THICKNESS;

  const faces: Face[] = [
    { key: "+x", visible: glazed[0], position: [width / 2, 0, 0], rotation: [0, Math.PI / 2, 0], size: [depth, wallHeight] },
    { key: "-x", visible: glazed[1], position: [-width / 2, 0, 0], rotation: [0, -Math.PI / 2, 0], size: [depth, wallHeight] },
    { key: "+z", visible: glazed[2], position: [0, 0, depth / 2], rotation: [0, 0, 0], size: [width, wallHeight] },
    { key: "-z", visible: glazed[3], position: [0, 0, -depth / 2], rotation: [0, Math.PI, 0], size: [width, wallHeight] },
  ];

  useFrame((_, delta) => {
    const f = section.current ?? 0;
    const t = floorProgress(floor.index, f);
    const below = floorProgress(floor.index - 1, f);

    // Columns: a rebar stub appears once the floor below is placed, then rises.
    const stub = floor.index === 0 || below >= PLACED_AT ? STUB : 0;
    const rise = t === 0 ? stub : lerp(STUB, 1, smoothstep(0, 0.3, t));
    for (const column of columns.current) {
      column.scale.y = Math.max(rise, 0.0001);
      column.position.y = (wallHeight * rise) / 2;
      column.visible = rise > 0;
    }

    // Slab: lives on the crane until it is placed.
    if (slab.current) slab.current.visible = t >= PLACED_AT;

    // Glazing rises from the slab once it is down.
    const glass = smoothstep(0.7, 0.9, t);
    for (const mesh of glazingMeshes.current) {
      mesh.scale.y = Math.max(glass, 0.0001);
      mesh.position.y = SLAB_THICKNESS + (wallHeight * glass) / 2;
      mesh.visible = glass > 0;
    }

    // Light: a dim lamp once the floor is closed, bright while being read.
    const lit = t >= 0.9;
    const glow = active ? 0.28 : lit ? 0.08 : 0.03;
    for (const material of glazing.current) {
      material.emissiveIntensity = THREE.MathUtils.damp(material.emissiveIntensity, glow, 4, delta);
    }
    if (light.current) {
      const target = active ? 40 : lit ? 6 : 0;
      light.current.intensity = THREE.MathUtils.damp(light.current.intensity, target, 4, delta);
    }
  });

  return (
    <group
      position={[0, floor.y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(floor.index);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <group ref={slab}>
        <mesh position={[0, SLAB_THICKNESS / 2, 0]} material={concrete}>
          <boxGeometry args={[width, SLAB_THICKNESS, depth]} />
        </mesh>
        <mesh position={[0, -0.12, 0]} material={concreteDark}>
          <boxGeometry args={[width - 0.2, 0.24, depth - 0.2]} />
        </mesh>
      </group>
      {/* Columns grow from the slab below (or the ground for floor 0). */}
      <group position={[0, floor.index === 0 ? SLAB_THICKNESS : -wallHeight, 0]}>
        {floor.columns.map(([x, z], i) => (
          <mesh
            key={i}
            ref={(mesh) => {
              if (mesh) columns.current[i] = mesh;
            }}
            position={[x, wallHeight / 2, z]}
            material={floor.finished ? concrete : steel}
          >
            <boxGeometry args={[COLUMN, wallHeight, COLUMN]} />
          </mesh>
        ))}
      </group>
      {faces
        .filter((f) => f.visible)
        .map((f, i) => (
          <mesh
            key={f.key}
            ref={(mesh) => {
              if (mesh) glazingMeshes.current[i] = mesh;
            }}
            position={[f.position[0], SLAB_THICKNESS + wallHeight / 2, f.position[2]]}
            rotation={f.rotation}
          >
            <planeGeometry args={f.size} />
            <meshStandardMaterial
              ref={(material) => {
                if (material) glazing.current[i] = material;
              }}
              emissive={lamp}
              {...GLASS}
            />
          </mesh>
        ))}
      <pointLight
        ref={light}
        position={[0, FLOOR_HEIGHT * 0.7, 0]}
        color={lamp}
        intensity={0}
        distance={14}
        decay={2}
      />
    </group>
  );
}

type FloorsProps = {
  site: Site;
  /** Index of the floor currently being read, or -1. */
  activeFloor: number;
  section: RefObject<number>;
  onSelect?: (index: number) => void;
};

export function Floors({ site, activeFloor, section, onSelect }: FloorsProps) {
  return (
    <group>
      {site.floors.map((floor) => (
        <FloorBlock
          key={floor.index}
          floor={floor}
          active={floor.index === activeFloor}
          lamp={site.lamp.color}
          section={section}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
