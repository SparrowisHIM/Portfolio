"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Floor, Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, SLAB_THICKNESS } from "@/lib/site-generator";
import { PLACED_AT, floorProgress, lerp, smoothstep } from "@/lib/construction";
import { box, hSection, post, strut, type Instance } from "@/lib/geometry";
import { ceilingTexture, nettingTexture } from "@/lib/textures";
import { Instances } from "./Instances";
import { materials, palette } from "./materials";

const WALL = FLOOR_HEIGHT - SLAB_THICKNESS;
const COLUMN = { depth: 0.36, flange: 0.3, t: 0.045 };
const BEAM = { depth: 0.42, flange: 0.2, t: 0.035 };
const SPANDREL = 0.55;

type Face = {
  /** Index into Floor.glazed: +x, -x, +z, -z. */
  key: number;
  nx: number;
  nz: number;
  length: number;
  rotationY: number;
};

function faces(width: number, depth: number): Face[] {
  return [
    { key: 0, nx: 1, nz: 0, length: depth, rotationY: Math.PI / 2 },
    { key: 1, nx: -1, nz: 0, length: depth, rotationY: -Math.PI / 2 },
    { key: 2, nx: 0, nz: 1, length: width, rotationY: 0 },
    { key: 3, nx: 0, nz: -1, length: width, rotationY: Math.PI },
  ];
}

/** A point on a face: `along` the face from its centre, `out` from the tower centre. */
function onFace(face: Face, width: number, depth: number, along: number, out: number, y: number): [number, number, number] {
  const half = face.nx !== 0 ? width / 2 : depth / 2;
  return [face.nx * (half + out) - face.nz * along, y, face.nz * (half + out) + face.nx * along];
}

type FloorBlockProps = {
  floor: Floor;
  /** The floor below is enclosed, so this slab's soffit is a lit ceiling. */
  belowFinished: boolean;
  /** The unfinished top level: columns and beams only. */
  columnsOnly?: boolean;
  active: boolean;
  lamp: string;
  section: RefObject<number>;
  onSelect?: (index: number) => void;
};

/**
 * One storey, built in front of you. Steel columns rise from the slab below,
 * beams are set down, the crane lands the slab, edge protection goes up, then
 * the curtain wall rises and the lights come on. All of it follows page scroll.
 */
function FloorBlock({ floor, belowFinished, columnsOnly, active, lamp, section, onSelect }: FloorBlockProps) {
  const m = materials();
  const { width, depth, glazed, index } = floor;
  const columns = useRef<THREE.Group>(null);
  const starters = useRef<THREE.Group>(null);
  const beams = useRef<THREE.Group>(null);
  const slab = useRef<THREE.Group>(null);
  const rails = useRef<THREE.Group>(null);
  const glazing = useRef<THREE.Group>(null);
  const tripod = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);

  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.glass,
        emissive: lamp,
        emissiveIntensity: 0.04,
        roughness: 0.12,
        metalness: 0.55,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    [lamp],
  );
  const ceiling = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: ceilingTexture(lamp),
        emissiveMap: ceilingTexture(lamp),
        emissive: "#ffffff",
        emissiveIntensity: 0.15,
        roughness: 0.8,
      }),
    [lamp],
  );
  const net = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: nettingTexture("#ff7a2f"),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.9,
      }),
    [],
  );

  const parts = useMemo(() => {
    const hx = width / 2 - 0.35;
    const hz = depth / 2 - 0.35;
    const columnItems: Instance[] = [];
    const starterItems: Instance[] = [];
    for (const [x, z] of floor.columns) {
      columnItems.push(...hSection([x, 0, z], [x, WALL, z], COLUMN.depth, COLUMN.flange, COLUMN.t, [1, 0, 0]));
      for (const dx of [-0.1, 0.1]) for (const dz of [-0.1, 0.1]) starterItems.push(post([x + dx, 0, z + dz], 0.6, 0.022));
    }

    // Beams hang just under the slab: edge beams, primaries on the column lines,
    // secondaries between them.
    const beamItems: Instance[] = [];
    const by = -BEAM.depth / 2;
    const along = (a: [number, number, number], b: [number, number, number]) =>
      beamItems.push(...hSection(a, b, BEAM.depth, BEAM.flange, BEAM.t, [0, 1, 0]));
    along([-hx, by, -hz], [hx, by, -hz]);
    along([-hx, by, hz], [hx, by, hz]);
    for (const x of [-hx, 0, hx]) along([x, by, -hz], [x, by, hz]);
    const bays = Math.max(2, Math.round(width / 1.5));
    for (let k = 1; k < bays; k++) {
      const x = -hx + (k * (2 * hx)) / bays;
      if (Math.abs(x) < 0.4) continue;
      along([x, by + 0.03, -hz], [x, by + 0.03, hz]);
    }

    // Edge protection on open faces: posts, two rails, a toe board.
    const railItems: Instance[] = [];
    const toeItems: Instance[] = [];
    const netFaces: Face[] = [];
    const glazedFaces: Face[] = [];
    for (const face of faces(width, depth)) {
      if (columnsOnly) continue;
      if (glazed[face.key]) {
        glazedFaces.push(face);
        continue;
      }
      netFaces.push(face);
      const count = Math.max(2, Math.round(face.length / 1.2));
      for (let i = 0; i <= count; i++) {
        const a = -face.length / 2 + (i * face.length) / count;
        railItems.push(post(onFace(face, width, depth, a, 0.06, 0), 1.1, 0.05));
      }
      for (const y of [1.05, 0.55]) {
        railItems.push(strut(onFace(face, width, depth, -face.length / 2, 0.06, y), onFace(face, width, depth, face.length / 2, 0.06, y), 0.035));
      }
      toeItems.push(strut(onFace(face, width, depth, -face.length / 2, 0.06, 0.08), onFace(face, width, depth, face.length / 2, 0.06, 0.08), 0.03, 0.16));
    }

    // Curtain wall: mullions, transoms, a spandrel band and the glass.
    const mullionItems: Instance[] = [];
    const spandrelItems: Instance[] = [];
    for (const face of glazedFaces) {
      const count = Math.max(2, Math.round(face.length / 1.4));
      for (let i = 0; i <= count; i++) {
        const a = -face.length / 2 + (i * face.length) / count;
        mullionItems.push(strut(onFace(face, width, depth, a, 0.05, 0), onFace(face, width, depth, a, 0.05, WALL), 0.07));
      }
      for (const y of [SPANDREL, WALL * 0.68, WALL - 0.04]) {
        mullionItems.push(strut(onFace(face, width, depth, -face.length / 2, 0.05, y), onFace(face, width, depth, face.length / 2, 0.05, y), 0.05));
      }
      const c = onFace(face, width, depth, 0, 0.02, SPANDREL / 2);
      spandrelItems.push(box(c, face.nx !== 0 ? [0.04, SPANDREL, face.length] : [face.length, SPANDREL, 0.04]));
    }

    // A tripod work lamp on unfinished floors, in a corner away from the core.
    const tripodItems: Instance[] = [];
    const lampAt: [number, number, number] = [hx - 0.6, SLAB_THICKNESS, hz - 0.6];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      tripodItems.push(strut([lampAt[0] + Math.cos(a) * 0.35, lampAt[1], lampAt[2] + Math.sin(a) * 0.35], [lampAt[0], lampAt[1] + 1.7, lampAt[2]], 0.025));
    }
    tripodItems.push(post([lampAt[0], lampAt[1] + 1.7, lampAt[2]], 0.5, 0.03));

    return { columnItems, starterItems, beamItems, railItems, toeItems, netFaces, glazedFaces, mullionItems, spandrelItems, tripodItems, lampAt };
  }, [floor, width, depth, glazed, columnsOnly]);

  useFrame((_, delta) => {
    const f = section.current ?? 0;
    const t = floorProgress(index, f);
    const below = floorProgress(index - 1, f);

    // Columns: starter bars show once the slab below is down, then the steel rises.
    const stub = index > 0 && below >= PLACED_AT ? 0.06 : 0;
    const rise = index === 0 ? 0 : t === 0 ? stub : lerp(0.06, 1, smoothstep(0, 0.3, t));
    if (columns.current) {
      columns.current.scale.y = Math.max(rise, 0.0001);
      columns.current.visible = rise > 0;
    }
    if (starters.current) {
      starters.current.visible = rise > 0 && rise < 1;
      starters.current.position.y = -WALL + WALL * rise;
    }
    // Beams are set down on the columns.
    if (beams.current) {
      const s = smoothstep(0.28, 0.42, t);
      beams.current.visible = index > 0 && t >= 0.28;
      beams.current.position.y = lerp(0.9, 0, s);
    }
    if (slab.current) slab.current.visible = t >= PLACED_AT;
    // Edge protection goes up, netting fades in.
    const guard = smoothstep(0.66, 0.78, t);
    if (rails.current) {
      rails.current.visible = guard > 0;
      rails.current.scale.y = Math.max(guard, 0.0001);
    }
    net.opacity = guard * 0.85;
    // Glazing rises from the slab once it is down.
    const glassUp = smoothstep(0.7, 0.9, t);
    if (glazing.current) {
      glazing.current.scale.y = Math.max(glassUp, 0.0001);
      glazing.current.visible = glassUp > 0;
    }
    // Light: a dim lamp once the floor is closed, bright while being read.
    const lit = t >= 0.9;
    const glow = active ? 0.3 : lit ? 0.08 : 0.03;
    glass.emissiveIntensity = THREE.MathUtils.damp(glass.emissiveIntensity, glow, 4, delta);
    ceiling.emissiveIntensity = THREE.MathUtils.damp(ceiling.emissiveIntensity, active ? 1.6 : lit ? 0.7 : 0.1, 4, delta);
    if (tripod.current) tripod.current.visible = !floor.finished && t >= PLACED_AT;
    if (light.current) {
      const target = active ? 42 : lit ? 7 : 0;
      light.current.intensity = THREE.MathUtils.damp(light.current.intensity, target, 4, delta);
    }
  });

  return (
    <group
      position={[0, floor.y, 0]}
      onClick={(e) => {
        if (columnsOnly) return;
        e.stopPropagation();
        onSelect?.(index);
      }}
      onPointerOver={() => {
        if (!columnsOnly) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      {index > 0 && (
        <>
          <group ref={columns} position={[0, -WALL, 0]}>
            <Instances items={parts.columnItems} material={m.steel} frustumCulled={false} />
          </group>
          <group ref={starters} position={[0, -WALL, 0]}>
            <Instances items={parts.starterItems} material={m.rebar} frustumCulled={false} />
          </group>
          <group ref={beams}>
            <Instances items={parts.beamItems} material={m.steelDark} frustumCulled={false} />
          </group>
        </>
      )}

      {!columnsOnly && (
        <>
          <group ref={slab}>
            <mesh position={[0, SLAB_THICKNESS / 2, 0]} material={m.concrete}>
              <boxGeometry args={[width, SLAB_THICKNESS, depth]} />
            </mesh>
            {index > 0 && (
              <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]} material={belowFinished ? ceiling : m.deck}>
                <planeGeometry args={[width - 0.1, depth - 0.1]} />
              </mesh>
            )}
            {/* Screed line painted on the slab edge. */}
            <mesh position={[0, SLAB_THICKNESS - 0.03, 0]} material={m.concreteDark}>
              <boxGeometry args={[width + 0.02, 0.05, depth + 0.02]} />
            </mesh>
          </group>

          <group ref={rails} position={[0, SLAB_THICKNESS, 0]}>
            <Instances items={parts.railItems} material={m.crane} frustumCulled={false} />
            <Instances items={parts.toeItems} material={m.plank} frustumCulled={false} />
            {parts.netFaces.map((face) => {
              const c = onFace(face, width, depth, 0, 0.08, 0.6);
              return (
                <mesh key={face.key} position={c} rotation={[0, face.rotationY, 0]} material={net}>
                  <planeGeometry args={[face.length, 1.15]} />
                </mesh>
              );
            })}
          </group>

          <group ref={glazing} position={[0, SLAB_THICKNESS, 0]}>
            {parts.glazedFaces.map((face) => {
              const c = onFace(face, width, depth, 0, 0, WALL / 2);
              return (
                <mesh key={face.key} position={c} rotation={[0, face.rotationY, 0]} material={glass}>
                  <planeGeometry args={[face.length, WALL]} />
                </mesh>
              );
            })}
            <Instances items={parts.mullionItems} material={m.steelDark} frustumCulled={false} />
            <Instances items={parts.spandrelItems} material={m.steelDark} frustumCulled={false} />
          </group>

          <group ref={tripod}>
            <Instances items={parts.tripodItems} material={m.galvanised} frustumCulled={false} />
            <mesh position={[parts.lampAt[0], parts.lampAt[1] + 2.25, parts.lampAt[2]]} rotation={[0.5, -0.8, 0]}>
              <boxGeometry args={[0.36, 0.26, 0.14]} />
              <meshStandardMaterial color={lamp} emissive={lamp} emissiveIntensity={3} toneMapped={false} />
            </mesh>
          </group>

          <pointLight
            ref={light}
            position={floor.finished ? [0, FLOOR_HEIGHT * 0.7, 0] : [parts.lampAt[0], parts.lampAt[1] + 2.2, parts.lampAt[2]]}
            color={lamp}
            intensity={0}
            distance={14}
            decay={2}
          />
        </>
      )}
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
  const top: Floor = useMemo(
    () => ({
      index: site.floors.length,
      y: site.topLevel.y,
      width: site.topLevel.width,
      depth: site.topLevel.depth,
      columns: site.topLevel.columns,
      glazed: [false, false, false, false],
      finished: false,
    }),
    [site],
  );
  return (
    <group>
      {site.floors.map((floor, i) => (
        <FloorBlock
          key={floor.index}
          floor={floor}
          belowFinished={i > 0 && site.floors[i - 1].finished}
          active={floor.index === activeFloor}
          lamp={site.lamp.color}
          section={section}
          onSelect={onSelect}
        />
      ))}
      <FloorBlock floor={top} belowFinished={false} columnsOnly active={false} lamp={site.lamp.color} section={section} />
    </group>
  );
}
