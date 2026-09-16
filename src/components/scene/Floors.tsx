"use client";

import { useMemo } from "react";
import type { Floor, Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, SLAB_THICKNESS } from "@/lib/site-generator";
import { concrete, concreteDark, createGlass, steel } from "./materials";

const COLUMN = 0.36;

function FloorBlock({ floor }: { floor: Floor }) {
  const glass = useMemo(() => createGlass(), []);
  const { width, depth, glazed, columns } = floor;
  const wallHeight = FLOOR_HEIGHT - SLAB_THICKNESS;
  const faces: { key: string; visible: boolean; position: [number, number, number]; rotation: [number, number, number]; size: [number, number] }[] = [
    { key: "+x", visible: glazed[0], position: [width / 2, wallHeight / 2, 0], rotation: [0, Math.PI / 2, 0], size: [depth, wallHeight] },
    { key: "-x", visible: glazed[1], position: [-width / 2, wallHeight / 2, 0], rotation: [0, -Math.PI / 2, 0], size: [depth, wallHeight] },
    { key: "+z", visible: glazed[2], position: [0, wallHeight / 2, depth / 2], rotation: [0, 0, 0], size: [width, wallHeight] },
    { key: "-z", visible: glazed[3], position: [0, wallHeight / 2, -depth / 2], rotation: [0, Math.PI, 0], size: [width, wallHeight] },
  ];

  return (
    <group position={[0, floor.y, 0]}>
      {/* Slab */}
      <mesh position={[0, SLAB_THICKNESS / 2, 0]} material={concrete} castShadow receiveShadow>
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
          castShadow
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

export function Floors({ site }: { site: Site }) {
  return (
    <group>
      {site.floors.map((floor) => (
        <FloorBlock key={floor.index} floor={floor} />
      ))}
      <TopLevel site={site} />
    </group>
  );
}
