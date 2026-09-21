"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import {
  BEARER_H,
  DUNNAGE_H,
  PLANK,
  STACK_MIN,
  stackCount,
  stackPlateY,
  yardPosition,
  yardTurn,
} from "@/lib/construction";
import { craneReach, plinth, SLAB } from "@/lib/building";
import { createRandom } from "@/lib/random";
import { materials } from "./materials";
import { insideHoarding } from "./Hoarding";
import { Beam } from "./Beam";

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
    /*
      Which hand the laydown is on, as a bearing off the open face. The
      dressing is placed on bearings and the laydown is snapped to an axis,
      so the two were free to land on the same spot — and the lighting mast
      did, standing up through the middle of the pile.
    */
    const pile = yardPosition(site);
    const toPile = Math.atan2(
      Math.sin(Math.atan2(pile[0], pile[2]) - site.viewAngle),
      Math.cos(Math.atan2(pile[0], pile[2]) - site.viewAngle),
    );
    const clearOfPile = toPile >= 0 ? -1 : 1;

    /*
      What a new piece of dressing has to miss.

      Bearings alone were not enough. They are fixed offsets off the open
      face, so two of them can sit a tenth of a radian apart - and at this
      radius that is close enough to interpenetrate. The lighting mast
      stood inside the rebar stack on every seed that put the laydown on
      the far hand, because the mast's bearing is +/-1.35 and the rebar's
      is a fixed +1.5. Measured at seed 20260916: 1.32m apart, needing
      1.90m.

      Clamping made it worse rather than better. `insideHoarding` pulls
      anything that overruns the deck back to the boundary, so two pieces
      whose bearings both leave the deck are pulled onto the same piece of
      fence and end up inside each other.

      Everything already down is treated as a rectangle and tested against
      a circle of the new piece's own footprint radius - generous for the
      round things, which is the right way to be wrong here. The laydown
      and the crane base are down before any of it.
    */
    const pileHalf =
      yardTurn(site) === 0
        ? { hx: PLANK.width / 2, hz: PLANK.depth / 2 }
        : { hx: PLANK.depth / 2, hz: PLANK.width / 2 };
    const reach = craneReach(site);
    const blockers = [
      { x: pile[0], z: pile[2], ...pileHalf },
      { x: site.crane.position[0], z: site.crane.position[2], hx: reach, hz: reach },
    ];
    const clears = (q: readonly [number, number], keep: number) =>
      blockers.every((b) => {
        const dx = Math.max(Math.abs(q[0] - b.x) - b.hx, 0);
        const dz = Math.max(Math.abs(q[1] - b.z) - b.hz, 0);
        return dx * dx + dz * dz >= keep * keep;
      });

    /*
      Place a piece on a bearing off the open face, then make it fit: pull
      it inside the fence, and if it has landed on something already down,
      walk it round the face until it is clear.

      The bearing decides where a thing belongs, the deck decides whether
      it fits, and this decides who gives way - which is whoever arrives
      last. The order below is therefore a priority order: the cabin, the
      skip and the rebar keep their bearings and the mast, the pallets and
      the cones move around them. The mast can afford to: its spot aims at
      the world origin and its beams are aimed off its own position, so it
      lights the site correctly from wherever it ends up.
    */
    const at = (offset: number, out: number, keep = 0.6) => {
      const put = (a: number): [number, number] =>
        insideHoarding(base, [Math.sin(a) * (half + out), Math.cos(a) * (half + out)], keep);
      const a0 = site.viewAngle + offset;
      // A tenth of a radian at a time, alternating hands, so a piece that
      // has to move ends up as near its own bearing as it can.
      const walk = () => {
        for (let step = 1; step <= 16; step++) {
          for (const dir of [1, -1] as const) {
            const a = a0 + dir * step * 0.1;
            const q = put(a);
            if (clears(q, keep)) return { p: q, a };
          }
        }
        return null;
      };
      const first = put(a0);
      const spot = clears(first, keep) ? { p: first, a: a0 } : (walk() ?? { p: first, a: a0 });
      blockers.push({ x: spot.p[0], z: spot.p[1], hx: keep, hz: keep });
      return spot;
    };

    /*
      `keep` is the radius of the circle that contains the piece, which for
      a box is its half-diagonal and not its half-width: every one of these
      is turned to an arbitrary bearing, so the short side is not the one
      facing the fence. The cabin is 4.0 x 1.95 (2.23), the skip 2.1 x 1.34
      (1.25), the rebar 2.6 long on 0.79 of bundles (1.36), the pallets
      1.5 x 1.1 (0.94). Three of these were rounded down and each one let
      a corner through the hoarding.
    */
    const cabin = at(2.45, 2.8, 2.23);
    const skip = at(-2.15, 2.7, 1.25);
    const rebar = at(1.5, 2.6, 1.4);
    const mast = at(clearOfPile * 1.35, 3.1, 0.5);
    return {
      cabin: cabin.p,
      cabinTurn: cabin.a,
      skip: skip.p,
      skipTurn: skip.a,
      rebar: rebar.p,
      rebarTurn: rebar.a,
      mast: mast.p,
      cones: [at(-0.6, 2.2, 0.3).p, at(0.55, 2.4, 0.3).p, at(1.05, 1.9, 0.3).p],
      pallets: [at(-1.75, 2.6, 0.94).p, at(2.95, 2.8, 0.94).p],
      jitter: rnd.range(-0.15, 0.15),
    };
  }, [site, base]);

  const yard = useMemo(() => yardPosition(site), [site]);
  const turn = useMemo(() => yardTurn(site), [site]);
  const plates = useRef<THREE.InstancedMesh>(null);
  const dunnage = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  /*
    The pile draws down as the building goes up and then holds at STACK_MIN.
    It used to run to nothing by the top floor, which reads as a yard that
    has finished rather than one that is working — there is always more
    ready to go.
  */
  const maxPlates = STACK_MIN + site.floors.length;
  /** Two bearers under every plate, so the gap is filled with timber. */
  const maxBearers = maxPlates * 2;

  useFrame(() => {
    const mesh = plates.current;
    const bearers = dunnage.current;
    if (!mesh || !bearers) return;
    const left = stackCount(site, build.current ?? 0);
    for (let i = 0; i < maxPlates; i++) {
      const y = stackPlateY(i);
      if (i < left) {
        dummy.position.set(yard[0], y, yard[2]);
        dummy.rotation.set(0, turn + i * 0.008, 0);
        dummy.scale.set(PLATE.w, SLAB, PLATE.d);
      } else {
        dummy.scale.set(0, 0, 0);
        dummy.position.set(yard[0], y, yard[2]);
        dummy.rotation.set(0, 0, 0);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      /*
        Timber between every pair of plates — which is how precast is
        actually stacked, and also the fix for the black line that ran
        between each plate and the next. The gap was there so the pile did
        not read as one solid block; empty, all it did was put a shadowed
        void between two lit faces, and the pile read as striped.
      */
      for (let b = 0; b < 2; b++) {
        const k = i * 2 + b;
        if (i < left) {
          // Out near the edges and running past the ends, so the timber
          // reads from any face. Tucked into the middle of the plate it was
          // only visible through the gap it was supposed to be filling.
          const off = (b === 0 ? -1 : 1) * PLATE.d * 0.42;
          const a = turn + i * 0.008;
          dummy.position.set(
            yard[0] - Math.cos(a) * off,
            y - SLAB / 2 - DUNNAGE_H / 2,
            yard[2] + Math.sin(a) * off,
          );
          dummy.rotation.set(0, a, 0);
          dummy.scale.set(PLATE.w * 1.04, DUNNAGE_H, 0.22);
        } else {
          dummy.scale.set(0, 0, 0);
          dummy.position.set(yard[0], y, yard[2]);
          dummy.rotation.set(0, 0, 0);
        }
        dummy.updateMatrix();
        bearers.setMatrixAt(k, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    bearers.instanceMatrix.needsUpdate = true;
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
      <instancedMesh
        ref={dunnage}
        args={[undefined, m.timber, maxBearers]}
        receiveShadow
        frustumCulled={false}
      >
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
  /*
    Where the heads are pointing, in the mast's own space. The spot already
    aims at the world origin — the middle of the site — so the shafts have
    to agree with it or the light will be coming from somewhere the beam is
    not.
  */
  const aim = useMemo(() => {
    /*
      Aimed short of the tower, at the deck in front of it. Aimed at the
      building the shaft is cut off by the scaffold within a couple of
      metres — the mast stands outside the runs, so anything it points at
      the frame goes through them first.
    */
    const target = new THREE.Vector3(-position[0] * 0.42, 0.2 - position[1], -position[2] * 0.42);
    return [-0.26, 0.26].map((o) => ({
      from: new THREE.Vector3(o, 4.35, 0.27),
      to: target.clone().add(new THREE.Vector3(o * 2.4, 0, 0)),
    }));
  }, [position]);

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
