"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { PLANK, remainingSlabs, yardPosition } from "@/lib/construction";
import { plinth, SLAB } from "@/lib/building";
import { createRandom } from "@/lib/random";
import { materials } from "./materials";

/**
 * The site on the plinth.
 *
 * The hero frame was the weakest in the whole scroll: a bare slab and a core
 * box on an empty deck, with the crane reaching off into black to collect a
 * plate from nothing. Everything here is there to answer the question the
 * empty deck raised — someone works here, and the work has not started yet.
 *
 * The laydown is the load-bearing piece. Every lift begins at it, so the
 * stack has to be real and it has to shrink as the building goes up: the
 * plate that leaves the pile is the plate that lands on the frame.
 *
 * Everything sits on the plinth deck, in the band between the edge of the
 * building and the edge of the base, and is kept off the camera's side so it
 * dresses the shot rather than blocking it.
 */

/** The laydown stacks exactly what the crane lifts. */
const PLATE = { w: PLANK.width, d: PLANK.depth };

export function SiteYard({
  site,
  build,
}: {
  site: Site;
  build: RefObject<number>;
}) {
  const m = materials();
  const base = useMemo(() => plinth(site), [site]);
  const deck = base.top;

  const layout = useMemo(() => {
    const rnd = createRandom(site.seed ^ 0x51de);
    const half = Math.max(site.floors[0].width, site.floors[0].depth) / 2;
    // Polar placement relative to the open face, so the near side of the
    // plinth stays clear and the dressing reads behind and beside.
    const at = (offset: number, out: number): [number, number] => {
      const a = site.viewAngle + offset;
      return [Math.sin(a) * (half + out), Math.cos(a) * (half + out)];
    };
    return {
      cabin: at(2.45, 2.8),
      cabinTurn: site.viewAngle + 2.45,
      skip: at(-2.15, 2.7),
      skipTurn: site.viewAngle - 2.15,
      rebar: at(1.5, 2.6),
      rebarTurn: site.viewAngle + 1.5,
      mast: at(-1.3, 3.0),
      cones: [at(-0.6, 2.2), at(0.55, 2.4), at(1.05, 1.9)],
      pallets: [at(-1.75, 2.6), at(2.95, 2.8)],
      jitter: rnd.range(-0.15, 0.15),
    };
  }, [site]);

  const yard = useMemo(() => yardPosition(site), [site]);
  const yardTurn = useMemo(
    () => Math.atan2(site.crane.position[0], site.crane.position[2]) + site.yardSide * 0.6,
    [site],
  );
  const plates = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const maxPlates = site.floors.length;

  useFrame(() => {
    const mesh = plates.current;
    if (!mesh) return;
    // The pile is exactly what has not been lifted yet.
    const left = remainingSlabs(site, build.current ?? 0);
    for (let i = 0; i < maxPlates; i++) {
      if (i < left) {
        dummy.position.set(yard[0], deck + SLAB / 2 + i * (SLAB + 0.04), yard[2]);
        dummy.rotation.set(0, yardTurn + i * 0.012, 0);
        dummy.scale.set(PLATE.w, SLAB, PLATE.d);
      } else {
        dummy.scale.set(0, 0, 0);
        dummy.position.set(yard[0], deck, yard[2]);
        dummy.rotation.set(0, 0, 0);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* The laydown: the plates still waiting to go up. */}
      <instancedMesh
        ref={plates}
        args={[undefined, m.precast, maxPlates]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* Bearers under the stack, so it is not resting on the deck. */}
      <group position={[yard[0], deck + 0.06, yard[2]]} rotation={[0, yardTurn, 0]}>
        {[-1.15, 1.15].map((o) => (
          <mesh key={o} position={[0, 0, o]} castShadow material={m.timber}>
            <boxGeometry args={[PLATE.w * 0.92, 0.12, 0.18]} />
          </mesh>
        ))}
      </group>

      <Cabin position={[layout.cabin[0], deck, layout.cabin[1]]} turn={layout.cabinTurn} m={m} />
      <Skip position={[layout.skip[0], deck, layout.skip[1]]} turn={layout.skipTurn} m={m} />
      <RebarStack position={[layout.rebar[0], deck, layout.rebar[1]]} turn={layout.rebarTurn} m={m} />
      <Mast position={[layout.mast[0], deck, layout.mast[1]]} m={m} />

      {layout.cones.map((c, i) => (
        <Cone key={i} position={[c[0], deck, c[1]]} m={m} />
      ))}
      {layout.pallets.map((p, i) => (
        <mesh key={i} position={[p[0], deck + 0.11, p[1]]} rotation={[0, layout.jitter + i, 0]} material={m.timber}>
          <boxGeometry args={[1.5, 0.22, 1.1]} />
        </mesh>
      ))}
    </group>
  );
}

type Kit = ReturnType<typeof materials>;

/** Site office: a stacked container with one lit window. */
function Cabin({ position, turn, m }: { position: [number, number, number]; turn: number; m: Kit }) {
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.98, 0]} castShadow receiveShadow material={m.cabin}>
        <boxGeometry args={[4.0, 1.95, 1.95]} />
      </mesh>
      {/* Corrugation, as four shallow ribs rather than a texture. */}
      {[-1.4, -0.47, 0.47, 1.4].map((x) => (
        <mesh key={x} position={[x, 0.98, 0.99]} material={m.steelDark}>
          <boxGeometry args={[0.07, 1.8, 0.05]} />
        </mesh>
      ))}
      {/* The one warm window: the thing that says somebody is in there. */}
      <mesh position={[1.0, 1.15, 0.985]}>
        <planeGeometry args={[0.8, 0.52]} />
        <meshBasicMaterial color="#ffc87a" toneMapped={false} />
      </mesh>
      <mesh position={[-0.95, 0.95, 0.985]} material={m.steelDark}>
        <boxGeometry args={[0.7, 1.55, 0.04]} />
      </mesh>
      {/* Steps up to the door. */}
      <mesh position={[-0.95, 0.1, 1.35]} castShadow material={m.steelDark}>
        <boxGeometry args={[0.85, 0.2, 0.6]} />
      </mesh>
    </group>
  );
}

/** Muck skip, open topped, with a slight heap in it. */
function Skip({ position, turn, m }: { position: [number, number, number]; turn: number; m: Kit }) {
  return (
    <group position={position} rotation={[0, turn, 0]}>
      {[
        { p: [0, 0.39, -0.67] as const, s: [2.1, 0.78, 0.08] as const },
        { p: [0, 0.39, 0.67] as const, s: [2.1, 0.78, 0.08] as const },
        { p: [-1.05, 0.39, 0] as const, s: [0.08, 0.78, 1.34] as const },
        { p: [1.05, 0.39, 0] as const, s: [0.08, 0.78, 1.34] as const },
        { p: [0, 0.04, 0] as const, s: [2.1, 0.08, 1.34] as const },
      ].map((f, i) => (
        <mesh key={i} position={[f.p[0], f.p[1], f.p[2]]} castShadow receiveShadow material={m.skip}>
          <boxGeometry args={[f.s[0], f.s[1], f.s[2]]} />
        </mesh>
      ))}
      <mesh position={[0, 0.52, 0]} material={m.concreteDark}>
        <boxGeometry args={[1.9, 0.3, 1.15]} />
      </mesh>
    </group>
  );
}

/** Bundles of reinforcement on bearers. */
function RebarStack({ position, turn, m }: { position: [number, number, number]; turn: number; m: Kit }) {
  const rows = [
    { y: 0.16, n: 5 },
    { y: 0.32, n: 4 },
    { y: 0.48, n: 3 },
  ];
  return (
    <group position={position} rotation={[0, turn, 0]}>
      {rows.map((row) =>
        Array.from({ length: row.n }, (_, i) => (
          <mesh
            key={`${row.y}-${i}`}
            position={[(i - (row.n - 1) / 2) * 0.17, row.y, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={m.rebar}
          >
            <cylinderGeometry args={[0.055, 0.055, 2.6, 6]} />
          </mesh>
        )),
      )}
      {[-1.0, 1.0].map((z) => (
        <mesh key={z} position={[0, 0.05, z]} material={m.timber}>
          <boxGeometry args={[1.1, 0.1, 0.14]} />
        </mesh>
      ))}
    </group>
  );
}

/** A lighting mast at the edge of the deck, aimed in at the work. */
function Mast({ position, m }: { position: [number, number, number]; m: Kit }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]} castShadow material={m.steelDark}>
        <boxGeometry args={[0.7, 0.24, 0.7]} />
      </mesh>
      <mesh position={[0, 2.2, 0]} castShadow material={m.crane}>
        <cylinderGeometry args={[0.1, 0.14, 4.4, 8]} />
      </mesh>
      {[-0.26, 0.26].map((o) => (
        <mesh key={o} position={[o, 4.35, 0.16]} material={m.steelDark}>
          <boxGeometry args={[0.44, 0.3, 0.2]} />
        </mesh>
      ))}
      {/* The lamp faces, unlit geometry that reads as the source. */}
      {[-0.26, 0.26].map((o) => (
        <mesh key={`f${o}`} position={[o, 4.35, 0.27]}>
          <planeGeometry args={[0.38, 0.24]} />
          <meshBasicMaterial color="#ffd9a2" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Traffic cone. */
function Cone({ position, m }: { position: [number, number, number]; m: Kit }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} material={m.skip}>
        <boxGeometry args={[0.42, 0.06, 0.42]} />
      </mesh>
      <mesh position={[0, 0.32, 0]} material={m.skip}>
        <coneGeometry args={[0.17, 0.58, 10]} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.125, 0.145, 0.12, 10]} />
        <meshStandardMaterial color="#e8ecf0" emissive="#dfe6ee" emissiveIntensity={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}
