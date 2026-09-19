"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { floorProgress, smoothstep } from "@/lib/construction";
import { buildParts, plinth, storey, CLAD_LAG, type Part, type PartKind, type Vec3 } from "@/lib/building";
import { boardConcreteTexture } from "@/lib/textures";

/**
 * The building: one instanced draw per material, placed from the frame loop.
 *
 * Standard materials rather than a custom shader, deliberately. The thing
 * being built is a solid object with concrete, steel and glass in it, and a
 * lit surface is what makes those read as materials at all. The previous
 * skeletal renderer drew everything as self-lit line work, which is why it
 * came out looking like every other three.js demo.
 *
 * Matrices are written every frame rather than in an effect. r3f rebuilds an
 * instancedMesh whenever its `args` change and hands back an empty matrix
 * buffer, and an effect will not be watching — that is the blank-building bug
 * this project already lost a session to. Writing from the loop cannot miss it,
 * and we need per-frame placement for the settle-in anyway.
 */

type BuildingProps = {
  site: Site;
  /** Construction time: the same clock the crane and lights read. */
  build: RefObject<number>;
  animate: boolean;
};

/** How long a part takes to settle once it starts arriving. */
const SETTLE = 0.08;

function easeOutBack(t: number) {
  const c1 = 1.32;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/** Materials whose instances are worth casting a shadow from. */
const CASTS_SHADOW = new Set(["concrete", "coreConcrete"]);

/** Which material each kind draws with. Kinds sharing one are drawn together. */
const MATERIAL_OF: Record<PartKind, string> = {
  column: "concrete",
  slab: "concrete",
  core: "coreConcrete",
  glass: "glass",
  mullion: "frame",
  ceiling: "lightStrip",
  fitout: "fitout",
  rail: "safety",
  starter: "rebar",
  stack: "timber",
};

/** Transparent groups draw after everything opaque. */
const TRANSPARENT = new Set(["glass"]);

export function Building({ site, build, animate }: BuildingProps) {
  const parts = useMemo(() => buildParts(site), [site]);
  const base = useMemo(() => plinth(site), [site]);

  // Grouped once, so each group is a single draw call.
  const groups = useMemo(() => {
    const by = new Map<string, Part[]>();
    for (const part of parts) {
      const key = MATERIAL_OF[part.kind];
      const list = by.get(key);
      if (list) list.push(part);
      else by.set(key, [part]);
    }
    return [...by.entries()].map(([material, items]) => ({ material, items }));
  }, [parts]);

  const materials = useMemo(() => {
    const map = boardConcreteTexture(5);
    const concrete = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map,
      roughness: 0.94,
      metalness: 0.02,
    });
    // The core reads a shade deeper so the shaft separates from the plates
    // it passes through, the way board-marked in-situ concrete does against
    // a precast slab.
    const coreConcrete = new THREE.MeshStandardMaterial({
      color: "#b9b4aa",
      map,
      roughness: 0.96,
      metalness: 0.02,
    });
    return {
      concrete,
      coreConcrete,
      /*
        Dark glass. Opaque enough to read as a surface and catch a highlight,
        open enough that the lit ceiling behind it comes through — that glow
        from inside is the whole reason a finished floor looks alive. It does
        not write depth, or the panes on the far side of a storey punch holes
        in the ones in front of them.
      */
      glass: new THREE.MeshPhysicalMaterial({
        color: "#10171f",
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      /** Curtain wall framing: near black, faintly metallic. */
      frame: new THREE.MeshStandardMaterial({ color: "#191c21", roughness: 0.45, metalness: 0.65 }),
      /*
        Ceiling runs. Unlit and out of the tone mapper so they stay a clean
        warm line however dark the storey around them is.
      */
      lightStrip: new THREE.MeshBasicMaterial({ color: "#ffd9a2", toneMapped: false }),
      fitout: new THREE.MeshStandardMaterial({ color: "#6b6256", roughness: 0.8 }),
      safety: new THREE.MeshStandardMaterial({ color: "#d4632a", roughness: 0.6, metalness: 0.1 }),
      rebar: new THREE.MeshStandardMaterial({ color: "#6a6257", roughness: 0.75, metalness: 0.5 }),
      timber: new THREE.MeshStandardMaterial({ color: "#7d7263", roughness: 0.9 }),
      plinth: new THREE.MeshStandardMaterial({ color: "#14161a", roughness: 0.42, metalness: 0.35 }),
      plinthTop: new THREE.MeshStandardMaterial({ color: "#1b1e23", roughness: 0.28, metalness: 0.5 }),
    };
  }, []);

  return (
    <group>
      <Plinth base={base} materials={materials} />
      {groups.map((group) => (
        <PartGroup
          key={group.material}
          items={group.items}
          material={materials[group.material as keyof typeof materials]}
          casts={CASTS_SHADOW.has(group.material)}
          order={TRANSPARENT.has(group.material) ? 2 : 0}
          build={build}
          animate={animate}
        />
      ))}
    </group>
  );
}

/**
 * One instanced draw for every part sharing a material. Parts that have not
 * arrived yet are collapsed to zero scale rather than skipped, so an instance
 * keeps its slot and the buffer never has to be rebuilt mid-scroll.
 */
function PartGroup({
  items,
  material,
  casts,
  order,
  build,
  animate,
}: {
  items: Part[];
  material: THREE.Material;
  casts: boolean;
  order: number;
  build: RefObject<number>;
  animate: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useFrame(() => {
    const target = mesh.current;
    if (!target) return;
    const f = build.current ?? 0;

    for (let i = 0; i < items.length; i++) {
      const part = items[i];
      const progress = floorProgress(part.floor, f);
      let t = animate ? (progress - part.at) / SETTLE : progress >= part.at ? 1 : 0;

      // Taken away again: edge protection comes off as the glazing goes in.
      if (part.offFloor !== undefined && floorProgress(part.offFloor, f) >= (part.offAt ?? 1)) {
        t = 0;
      }

      if (t <= 0) {
        // Not placed yet. Zero scale is the cheapest way to hide one instance.
        dummy.scale.set(0, 0, 0);
        dummy.position.set(part.position[0], part.position[1], part.position[2]);
        dummy.rotation.set(0, part.rotationY, 0);
        dummy.updateMatrix();
        target.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const e = t >= 1 ? 1 : easeOutBack(t);
      const fall = part.drop * (1 - Math.min(1, t));
      dummy.position.set(part.position[0], part.position[1] + fall, part.position[2]);
      dummy.rotation.set(0, part.rotationY, 0);
      // Come in a touch over size and settle back, so a part lands rather
      // than appears.
      const s = t >= 1 ? 1 : 0.88 + 0.12 * e;
      dummy.scale.set(part.scale[0] * s, part.scale[1] * s, part.scale[2] * s);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, items.length]}
      castShadow={casts}
      receiveShadow
      renderOrder={order}
      frustumCulled={false}
    />
  );
}

/**
 * The plinth.
 *
 * The single most useful thing in the reference: it turns a black background
 * from "nothing is there" into "this is a studio shot of a model". It also
 * gives the site somewhere to stand when it arrives, and the building
 * something to be reflected in.
 */
function Plinth({
  base,
  materials,
}: {
  base: ReturnType<typeof plinth>;
  materials: Record<string, THREE.Material>;
}) {
  const { width, depth, height, lip } = base;
  return (
    <group>
      {/* Lower step, wider, catching the uplights. */}
      <mesh position={[0, -height - 0.16, 0]} receiveShadow material={materials.plinth}>
        <boxGeometry args={[width + lip * 2, 0.32, depth + lip * 2]} />
      </mesh>
      {/* Upper step, the deck the building stands on. */}
      <mesh position={[0, -height / 2, 0]} receiveShadow material={materials.plinthTop}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
    </group>
  );
}

/** Small warm uplights set into the plinth, washing the underside of the base slab. */
export function PlinthLights({ site }: { site: Site }) {
  const base = useMemo(() => plinth(site), [site]);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    const hw = base.width / 2 - 0.5;
    const hd = base.depth / 2 - 0.5;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) out.push([sx * hw, sz * hd]);
    }
    return out;
  }, [base]);

  return (
    <group>
      {spots.map(([x, z], i) => (
        <pointLight
          key={i}
          position={[x, 0.12, z]}
          color="#ffb765"
          intensity={1.5}
          distance={4.2}
          decay={2}
        />
      ))}
      {spots.map(([x, z], i) => (
        <mesh key={`l${i}`} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.13, 12]} />
          <meshBasicMaterial color="#ffcd91" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One warm lamp inside each storey that gets glazed.
 *
 * The emissive ceiling runs give the glow you see through the glass, but they
 * light nothing — without these the fit-out and the core inside a finished
 * floor are black shapes behind a bright line. Intensity follows the glazing
 * in, so a floor warms up as it is handed over rather than snapping on.
 */
export function InteriorLights({ site, build }: { site: Site; build: RefObject<number> }) {
  const lamps = useMemo(() => {
    const out: { key: number; cladBy: number; position: Vec3 }[] = [];
    const levels = site.floors.length;
    for (let index = 0; index < levels; index++) {
      const cladBy = index + CLAD_LAG;
      if (cladBy > levels) continue;
      const { bottom, top } = storey(index);
      out.push({ key: index, cladBy, position: [0, bottom + (top - bottom) * 0.62, 0] });
    }
    return out;
  }, [site]);

  const refs = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(() => {
    const f = build.current ?? 0;
    for (let i = 0; i < lamps.length; i++) {
      const light = refs.current[i];
      if (!light) continue;
      light.intensity = 26 * smoothstep(0.34, 0.72, floorProgress(lamps[i].cladBy, f));
    }
  });

  return (
    <group>
      {lamps.map((lamp, i) => (
        <pointLight
          key={lamp.key}
          ref={(node) => {
            refs.current[i] = node;
          }}
          position={lamp.position}
          color="#ffc47d"
          intensity={0}
          distance={13}
          decay={2}
        />
      ))}
    </group>
  );
}

export { smoothstep };
