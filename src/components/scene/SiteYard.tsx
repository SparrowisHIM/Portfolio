"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { BEARER_H, DUNNAGE_H, PLANK, STACK_MIN, stackCount, stackPlateY, yardPosition, yardTurn } from "@/lib/construction";
import { plinth, SLAB } from "@/lib/building";
import { materials } from "./materials";
import { Beam } from "./Beam";
import { layoutYard } from "./yard-layout";

/** The laydown stacks exactly what the crane lifts. */
const PLATE = { w: PLANK.width, d: PLANK.depth };
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * The site on the plinth: the laydown the crane lifts from, and the dressing
 * that says someone works here - cabin, skip, stock, a lighting mast.
 *
 * The laydown is the load-bearing piece. Every lift begins at it, so the
 * pile shrinks as the building goes up: the plate that leaves the pile is
 * the plate that lands on the frame. It draws down to STACK_MIN and holds
 * there, because a yard that runs dry reads as one that has finished.
 */
export function SiteYard({ site, build }: { site: Site; build: RefObject<number> }) {
  const m = materials();
  const base = useMemo(() => plinth(site), [site]);
  const deck = base.top;
  const layout = useMemo(() => layoutYard(site, base), [site, base]);
  const yard = useMemo(() => yardPosition(site), [site]);
  const turn = useMemo(() => yardTurn(site), [site]);
  const plates = useRef<THREE.InstancedMesh>(null);
  const dunnage = useRef<THREE.InstancedMesh>(null);
  const shown = useRef<{ site?: Site; mesh?: THREE.InstancedMesh; left: number }>({ left: -1 });
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const maxPlates = STACK_MIN + site.floors.length;

  useFrame(() => {
    const mesh = plates.current;
    const bearers = dunnage.current;
    if (!mesh || !bearers) return;
    const left = stackCount(site, build.current ?? 0);
    // The pile only changes when a plate leaves it. Keyed on the mesh too:
    // r3f rebuilds an instancedMesh when its args change, with empty matrices.
    const last = shown.current;
    if (last.site === site && last.mesh === mesh && last.left === left) return;
    shown.current = { site, mesh, left };
    for (let i = 0; i < maxPlates; i++) {
      if (i >= left) {
        mesh.setMatrixAt(i, HIDDEN);
        bearers.setMatrixAt(i * 2, HIDDEN);
        bearers.setMatrixAt(i * 2 + 1, HIDDEN);
        continue;
      }
      const y = stackPlateY(i);
      const a = turn + i * 0.008;
      dummy.position.set(yard[0], y, yard[2]);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(PLATE.w, SLAB, PLATE.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Timber between every pair of plates, out near the edges and running
      // past the ends so it reads from any face.
      for (let b = 0; b < 2; b++) {
        const off = (b === 0 ? -1 : 1) * PLATE.d * 0.42;
        dummy.position.set(yard[0] - Math.cos(a) * off, y - SLAB / 2 - DUNNAGE_H / 2, yard[2] + Math.sin(a) * off);
        dummy.scale.set(PLATE.w * 1.04, DUNNAGE_H, 0.22);
        dummy.updateMatrix();
        bearers.setMatrixAt(i * 2 + b, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    bearers.instanceMatrix.needsUpdate = true;
  });

  const on = (p: [number, number]): [number, number, number] => [p[0], deck, p[1]];

  return (
    <group>
      {/* The laydown: the plates still waiting to go up. */}
      <instancedMesh ref={plates} args={[undefined, m.precast, maxPlates]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={dunnage} args={[undefined, m.timber, maxPlates * 2]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* Ground bearers, so the bottom plate is not resting on the deck. */}
      <group position={[yard[0], deck + BEARER_H / 2, yard[2]]} rotation={[0, turn, 0]}>
        {[-1.15, 1.15].map((o) => (
          <mesh key={o} position={[0, 0, o]} castShadow material={m.timber}>
            <boxGeometry args={[PLATE.w * 0.92, BEARER_H, 0.22]} />
          </mesh>
        ))}
      </group>

      <Cabin position={on(layout.cabin.p)} turn={layout.cabin.a} m={m} />
      <Skip position={on(layout.skip.p)} turn={layout.skip.a} m={m} />
      <RebarStack position={on(layout.rebar.p)} turn={layout.rebar.a} m={m} />
      <Mast position={on(layout.mast.p)} m={m} />
      <TubeStack position={on(layout.tubes.p)} turn={layout.tubes.a} m={m} />
      <PanelStack position={on(layout.panels.p)} turn={layout.panels.a} m={m} />
      <Genset position={on(layout.genset.p)} turn={layout.genset.a} m={m} />
      <Drums position={on(layout.drums.p)} turn={layout.drums.a} m={m} />

      {layout.cones.map((c, i) => (
        <Cone key={i} position={on(c.p)} m={m} />
      ))}
      {layout.pallets.map(({ p }, i) => (
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
      {/*
        Every child is shifted back 0.34 so the group origin sits in the
        middle of the real footprint, steps included. It is not cosmetic:
        the yard keeps pieces off each other with a radius measured about
        this origin, and an off-centre body inflates that radius by the
        whole of the overhang - which for this cabin was the difference
        between fitting on the deck and standing through the fence.
      */}
      <mesh position={[0, 0.98, -0.34]} castShadow receiveShadow material={m.cabin}>
        <boxGeometry args={[3.4, 1.95, 1.95]} />
      </mesh>
      {/* Corrugation, as four shallow ribs rather than a texture. */}
      {[-1.18, -0.39, 0.39, 1.18].map((x) => (
        <mesh key={x} position={[x, 0.98, 0.65]} material={m.steelDark}>
          <boxGeometry args={[0.07, 1.8, 0.05]} />
        </mesh>
      ))}
      {/* The one warm window: the thing that says somebody is in there. */}
      <mesh position={[0.78, 1.15, 0.645]}>
        <planeGeometry args={[0.8, 0.52]} />
        <meshBasicMaterial color="#ffc87a" toneMapped={false} />
      </mesh>
      <mesh position={[-0.76, 0.95, 0.645]} material={m.steelDark}>
        <boxGeometry args={[0.7, 1.55, 0.04]} />
      </mesh>
      {/* Steps up to the door. */}
      <mesh position={[-0.76, 0.1, 1.01]} castShadow material={m.steelDark}>
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
  /*
    Where the heads are pointing, in the mast's own space. The spot already
    aims at the world origin — the middle of the site — so the shafts have
    to agree with it or the light will be coming from somewhere the beam is
    not.
  */
  const [px, py, pz] = position;
  const aim = useMemo(() => {
    /*
      Aimed short of the tower, at the deck in front of it. Aimed at the
      building the shaft is cut off by the scaffold within a couple of
      metres — the mast stands outside the runs, so anything it points at
      the frame goes through them first.
    */
    const target = new THREE.Vector3(-px * 0.42, 0.2 - py, -pz * 0.42);
    return [-0.26, 0.26].map((o) => ({
      from: new THREE.Vector3(o, 4.35, 0.27),
      to: target.clone().add(new THREE.Vector3(o * 2.4, 0, 0)),
    }));
  }, [px, py, pz]);

  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]} castShadow material={m.steelDark}>
        <boxGeometry args={[0.7, 0.24, 0.7]} />
      </mesh>
      <mesh position={[0, 2.2, 0]} castShadow material={m.lampMast}>
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
      {/*
        The mast actually lights the site now. It stood there with two bright
        faces and lit nothing, which left the deck a flat even wash with no
        reason for any part of it to be brighter than any other. The default
        spot target is world origin, which is the middle of the site — so it
        rakes across the deck and up the building, exactly where a site lamp
        would be aimed.
      */}
      <spotLight
        position={[0, 4.35, 0.3]}
        color="#ffc98a"
        intensity={95}
        angle={0.95}
        penumbra={0.9}
        distance={42}
        decay={1.25}
      />
      {aim.map((a, i) => (
        <Beam key={i} from={a.from} to={a.to} spread={0.3} strength={0.62} />
      ))}
    </group>
  );
}

/**
 * Scaffold tube, bundled on bearers.
 *
 * The scaffold on the building has to have come from somewhere, and a run
 * of tube reads as the most site-like thing you can put on a deck: long,
 * cheap, stacked in a triangle because that is how round stock stacks.
 */
function TubeStack({ position, turn, m }: { position: [number, number, number]; turn: number; m: Kit }) {
  const rows = [
    { y: 0.19, n: 7 },
    { y: 0.31, n: 6 },
    { y: 0.43, n: 5 },
  ];
  return (
    <group position={position} rotation={[0, turn, 0]}>
      {[-1.15, 1.15].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]} material={m.timber}>
          <boxGeometry args={[0.16, 0.12, 0.9]} />
        </mesh>
      ))}
      {rows.map((row) =>
        Array.from({ length: row.n }, (_, i) => (
          <mesh
            key={`${row.y}-${i}`}
            position={[0, row.y, (i - (row.n - 1) / 2) * 0.115]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            material={m.rebar}
          >
            <cylinderGeometry args={[0.052, 0.052, 3.0, 7]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/**
 * Formwork panels, leaned against a low rack.
 *
 * Everything else in the yard is flat on the deck. One thing standing at
 * an angle is what stops the whole compound reading as a plan.
 */
function PanelStack({ position, turn, m }: { position: [number, number, number]; turn: number; m: Kit }) {
  return (
    <group position={position} rotation={[0, turn, 0]}>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.42, 0.18]} rotation={[0.26, 0, 0]} material={m.steelDark}>
          <boxGeometry args={[0.08, 0.9, 0.08]} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[0, 0.5 - i * 0.012, 0.3 + i * 0.07]}
          rotation={[0.26, 0, 0]}
          castShadow
          material={m.timber}
        >
          <boxGeometry args={[2.1, 1.25, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0.52]} material={m.timber}>
        <boxGeometry args={[2.2, 0.1, 0.2]} />
      </mesh>
    </group>
  );
}

/** Site generator: the reason any of the lights are on. */
function Genset({ position, turn, m }: { position: [number, number, number]; turn: number; m: Kit }) {
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.07, 0]} material={m.steelDark}>
        <boxGeometry args={[1.62, 0.14, 0.92]} />
      </mesh>
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow material={m.cabin}>
        <boxGeometry args={[1.5, 0.76, 0.84]} />
      </mesh>
      {/* Radiator grille, as ribs. */}
      {[-0.2, -0.07, 0.06, 0.19].map((z) => (
        <mesh key={z} position={[0.752, 0.52, z]} material={m.steelDark}>
          <boxGeometry args={[0.03, 0.5, 0.05]} />
        </mesh>
      ))}
      <mesh position={[-0.5, 1.02, 0.2]} material={m.steelDark}>
        <cylinderGeometry args={[0.055, 0.055, 0.42, 8]} />
      </mesh>
      {/* One green pilot lamp: it is running. */}
      <mesh position={[0.6, 0.72, 0.425]}>
        <planeGeometry args={[0.07, 0.05]} />
        <meshBasicMaterial color="#7dffa8" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Fuel drums, because the generator has to drink something. */
function Drums({ position, turn, m }: { position: [number, number, number]; turn: number; m: Kit }) {
  const at: [number, number][] = [
    [-0.34, -0.16],
    [0.02, 0.2],
    [0.38, -0.1],
  ];
  return (
    <group position={position} rotation={[0, turn, 0]}>
      {at.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.29, 0]} castShadow material={m.skip}>
            <cylinderGeometry args={[0.17, 0.17, 0.58, 12]} />
          </mesh>
          {[0.14, 0.44].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={m.steelDark}>
              <cylinderGeometry args={[0.178, 0.178, 0.035, 12]} />
            </mesh>
          ))}
        </group>
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
