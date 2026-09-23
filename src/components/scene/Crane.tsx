"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { HOOK_ABOVE_SLAB, TROLLEY_Y, cranePose } from "@/lib/construction";
import { craneReach, plinth, SLAB } from "@/lib/building";
import { PLANK, type CranePose } from "@/lib/construction";
import { APEX, JIB_Y, buildCraneParts } from "@/lib/crane-parts";
import { wind } from "@/lib/wind";
import { game } from "@/lib/stack-game";
import { emitBurst, emitPulse, workHue } from "@/lib/pulses";
import { Instances } from "./Instances";
import { Beam } from "./Beam";
import { materials } from "./materials";

type CraneProps = {
  site: Site;
  /** Construction time: 0 ground, 1..N floors, N+1 roof. Stops at topping out. */
  build: RefObject<number>;
  animate: boolean;
};

/*
  The rigging, measured down from the rope attachment on the hook block.
  Everything has to fit between the hook and the top of the plate, which is
  HOOK_ABOVE_SLAB - PLATE/2 below — about a metre. Compact, but the spreader
  beam is nearly five metres across and it is the beam that carries the read
  at this distance; the hook underneath it is a shape, not a detail.
*/
const BLOCK_H = 0.3;
const HOOK_EYE = -0.46;
const BRIDLE_Y = -0.68;
/** Beam length and cross-beam depth, as fractions of the plate. */
const BEAM_SPAN = 0.66;
const BEAM_CROSS = 0.58;
/** Where the slings land on the plate, as fractions of it. */
const ANCHOR_X = 0.35;
const ANCHOR_Z = 0.31;

/*
  How far the jib may fall behind the pose, per axis.

  The ease is what makes the crane read as a machine, and it is also what
  breaks it. A scroll crossing several floors in a second hands the jib a
  pose it can only reach by travelling, and an eased value travels in a
  straight line through whatever is in the way — which on this site means
  through the building. Capping the lag means the jib is never far enough
  behind for that line to be long, so a fast scroll fast-forwards the real
  animation instead of cutting corners across it.

  Under the caps nothing changes: ordinary operation never reaches them.
*/
const LAG_SLEW = 0.3;
const LAG_TROLLEY = 2.0;
const LAG_HOIST = 3.0;

const UP = new THREE.Vector3(0, 1, 0);
/** Down onto the building, not into the air short of it. */
const LAMP_TO = new THREE.Vector3(0, -14.5, 9.2);

/** The same turn expressed as the shorter of the two ways round. */
function shortTurn(delta: number) {
  return (((delta + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

type Jib = { angle: number; trolley: number; y: number; set: boolean };

/**
 * Ease the jib toward its pose, then refuse to be further behind than the
 * lag caps allow. The ease is what makes it read as a machine; the caps
 * stop a fast scroll from dragging it through the building.
 */
function stepJib(jib: Jib, pose: CranePose, ease: number) {
  if (!jib.set) {
    Object.assign(jib, { angle: pose.angle, trolley: pose.trolley, y: pose.hook[1], set: true });
  }
  jib.angle += shortTurn(pose.angle - jib.angle) * ease;
  jib.trolley += (pose.trolley - jib.trolley) * ease;
  jib.y += (pose.hook[1] - jib.y) * ease;
  const cap = (target: number, at: number, lag: number) => {
    const by = target - at;
    return Math.abs(by) > lag ? target - Math.sign(by) * lag : at;
  };
  const behind = shortTurn(pose.angle - jib.angle);
  if (Math.abs(behind) > LAG_SLEW) jib.angle = pose.angle - Math.sign(behind) * LAG_SLEW;
  jib.trolley = cap(pose.trolley, jib.trolley, LAG_TROLLEY);
  jib.y = cap(pose.hook[1], jib.y, LAG_HOIST);
}

/** Point a unit box from `a` to `b`. */
function aim(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, size: number, tmp: THREE.Vector3, q: THREE.Quaternion) {
  const dir = tmp.copy(b).sub(a);
  const length = Math.max(0.01, dir.length());
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.copy(q.setFromUnitVectors(UP, dir.normalize()));
  mesh.scale.set(size, length, size);
}

/**
 * A lattice tower crane, in painted steel: square mast, A-frame top, tapered
 * truss jib, counter jib with its ballast, and two warm lamps on the
 * machinery deck.
 *
 * It carries a solid precast unit, in the same concrete as the slabs it is
 * stacking, which sways on the hook, descends, overshoots and snaps down —
 * and sends a pulse through the structure when it locks. It used to carry a
 * glowing wireframe outline instead, which was the loudest thing still
 * reading as a diagram once the building below it went solid.
 */
export function Crane({ site, build, animate }: CraneProps) {
  const { crane } = site;
  const m = materials();
  // The crane stands on the plinth with everything else, not on y = 0.
  const deck = useMemo(() => plinth(site).top, [site]);
  // Shared with the yard, which keeps its dressing off the base.
  const reach = useMemo(() => craneReach(site), [site]);
  const slew = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);
  const spreader = useRef<THREE.Group>(null);
  /** Everything that turns with the plate: the gear, the plate, its anchors. */
  const rig = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const crossBeams = useRef<(THREE.Mesh | null)[]>([]);
  const bridle = useRef<(THREE.Mesh | null)[]>([]);
  const anchors = useRef<THREE.Group>(null);
  const ropes = useRef<THREE.Mesh[]>([]);
  const slings = useRef<THREE.Mesh[]>([]);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const wasLoaded = useRef(false);
  const loadPos = useRef(new THREE.Vector3());
  const loadVel = useRef(new THREE.Vector3());
  const settled = useRef(false);
  /** Where the jib actually is, as opposed to where the timeline wants it. */
  const jibAt = useRef<Jib>({ angle: 0, trolley: 0, y: 0, set: false });
  const tmpA = useRef(new THREE.Vector3());
  const tmpB = useRef(new THREE.Vector3());
  const tmpC = useRef(new THREE.Vector3());
  const tmpQ = useRef(new THREE.Quaternion());
  /** Where the trolley is in the world, kept clear of the scratch vectors. */
  const hookTop = useRef(new THREE.Vector3());

  const parts = useMemo(() => buildCraneParts(crane, reach), [crane, reach]);
  // The machinery deck lamp, in the slew's own space: it inherits the jib's aim.
  const lampFrom = useMemo(() => new THREE.Vector3(0, JIB_Y + 0.5, -0.8 - crane.counterJibLength * 0.45), [crane]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 30);
    let pose = cranePose(site, build.current ?? 0);
    const playing = game.active && !!game.moving;
    if (playing && game.moving) {
      // On the night shift the hook goes wherever the game swings the slab.
      const [hx, hy, hz] = game.hook;
      const dx = hx - crane.position[0];
      const dz = hz - crane.position[2];
      pose = {
        angle: Math.atan2(dx, dz),
        trolley: Math.min(crane.jibLength - 0.6, Math.hypot(dx, dz)),
        hook: [hx, hy, hz],
        loaded: true,
        slab: { width: game.moving.width, depth: game.moving.depth },
      };
    }

    // The jib eases to its pose, never cuts to it: the timeline hands over
    // between states in a single frame, and applied raw the crane would jump.
    const jib = jibAt.current;
    stepJib(jib, pose, animate && !playing ? 1 - Math.exp(-7 * dt) : 1);

    if (slew.current) slew.current.rotation.y = jib.angle;
    if (trolley.current) trolley.current.position.z = jib.trolley;

    // Pendulum: the load chases the (eased) hook with a spring and damper,
    // and the wind leans on it. The vertical spring gives the landing snap.
    const target = tmpA.current.set(
      crane.position[0] + Math.sin(jib.angle) * jib.trolley,
      jib.y,
      crane.position[2] + Math.cos(jib.angle) * jib.trolley,
    );
    const pos = loadPos.current;
    const vel = loadVel.current;
    if (!settled.current) {
      pos.copy(target);
      vel.set(0, 0, 0);
      settled.current = true;
    }
    const stiffness = animate && !playing ? 26 : playing ? 140 : 400;
    const damping = animate && !playing ? 4.2 : playing ? 14 : 40;
    const gust = animate ? wind.gust * 3 : 0;
    vel.x += ((target.x - pos.x) * stiffness - vel.x * damping + wind.dir[0] * gust) * dt;
    vel.z += ((target.z - pos.z) * stiffness - vel.z * damping + wind.dir[1] * gust) * dt;
    vel.y += ((target.y - pos.y) * (animate ? 60 : 900) - vel.y * (animate ? 9.5 : 60)) * dt;
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y += vel.y * dt;

    if (load.current) {
      load.current.position.copy(pos);
      const tilt = 0.055;
      load.current.rotation.z = THREE.MathUtils.clamp(-vel.x * 0.007, -tilt, tilt);
      load.current.rotation.x = THREE.MathUtils.clamp(vel.z * 0.007, -tilt, tilt);
      load.current.rotation.y = THREE.MathUtils.damp(load.current.rotation.y, 0, 2, dt);
    }
    // The plate hides the moment it locks and the structure takes over.
    if (frame.current) {
      frame.current.visible = pose.loaded && !playing;
      frame.current.scale.set(pose.slab.width, 1, pose.slab.depth);
    }
    // Plate, spreader and anchors turn together (a lift includes a quarter
    // turn); the hook block does not care about yaw.
    if (rig.current) rig.current.rotation.y = pose.rotation ?? 0;
    // Rigging shows from the moment the slings go on, before the weight moves.
    const rigged = pose.hitched ?? pose.loaded;
    if (spreader.current) spreader.current.visible = rigged;
    if (anchors.current) anchors.current.visible = rigged;
    // The beam spans the plate it is carrying, so it scales with it.
    const span = pose.slab.width * BEAM_SPAN;
    const cross = pose.slab.depth * BEAM_CROSS;
    if (beam.current) beam.current.scale.x = span;
    for (let i = 0; i < 2; i++) {
      const arm = crossBeams.current[i];
      if (!arm) continue;
      arm.position.x = (i === 0 ? -1 : 1) * span * 0.5;
      arm.scale.z = cross;
    }
    for (let i = 0; i < 2; i++) {
      const leg = bridle.current[i];
      if (!leg) continue;
      tmpA.current.set(0, HOOK_EYE - 0.04, 0);
      tmpB.current.set((i === 0 ? -1 : 1) * span * 0.5, BRIDLE_Y, 0);
      aim(leg, tmpA.current, tmpB.current, 0.055, tmpC.current, tmpQ.current);
    }
    if (wasLoaded.current && !pose.loaded && animate && !playing) {
      emitPulse(pos.x, pos.y - HOOK_ABOVE_SLAB, pos.z, workHue());
      emitBurst(pos.x, pos.y - HOOK_ABOVE_SLAB, pos.z, "amber", 16);
    }
    wasLoaded.current = pose.loaded;

    // Hoist ropes: two falls from the trolley to the hook block. The trolley
    // position has its own vector because aim() overwrites its scratch.
    if (trolley.current) {
      const top = trolley.current.getWorldPosition(hookTop.current);
      for (let i = 0; i < 2; i++) {
        const rope = ropes.current[i];
        if (!rope) continue;
        const off = (i === 0 ? -1 : 1) * 0.1;
        tmpC.current.set(pos.x + off, pos.y + 0.2, pos.z);
        const from = tmpA.current.set(top.x + off, top.y - 0.2, top.z);
        aim(rope, from, tmpC.current, 0.04, tmpB.current, tmpQ.current);
      }
    }

    // Four near-vertical slings from the cross beam ends to anchors in the plate.
    if (rigged) {
      const top = -HOOK_ABOVE_SLAB + SLAB / 2;
      for (let i = 0; i < 4; i++) {
        const sling = slings.current[i];
        if (!sling) continue;
        sling.visible = true;
        const sx = i < 2 ? -1 : 1;
        const sz = i % 2 === 0 ? -1 : 1;
        tmpA.current.set(sx * span * 0.5, BRIDLE_Y - 0.06, sz * cross * 0.5);
        tmpB.current.set(sx * pose.slab.width * ANCHOR_X, top, sz * pose.slab.depth * ANCHOR_Z);
        aim(sling, tmpA.current, tmpB.current, 0.042, tmpC.current, tmpQ.current);
      }
    } else {
      for (const sling of slings.current) if (sling) sling.visible = false;
    }

    if (beacon.current) {
      const t = clock.getElapsedTime();
      beacon.current.emissiveIntensity = animate ? 0.3 + Math.pow(0.5 + 0.5 * Math.sin(t * 1.4), 8) * 3 : 1.5;
    }
  });

  return (
    <group>
      <group position={[crane.position[0], deck, crane.position[2]]}>
        <Instances items={parts.base} material={m.steelDark} />
        <Instances items={parts.kentledge} material={m.kentledge} />
        <Instances items={parts.mast} material={m.crane} />
        <Instances items={parts.access} material={m.galvanised} />
        {parts.lights.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#e8eefb" emissive="#dfe8ff" emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
        ))}

        <group ref={slew} position={[0, crane.mastHeight, 0]}>
          <mesh position={[0, 0.15, 0]} material={m.steelDark}>
            <cylinderGeometry args={[1.05, 1.05, 0.4, 20]} />
          </mesh>
          <Instances items={parts.towerTop} material={m.crane} />
          <Instances items={parts.pendants} material={m.galvanised} />
          <Instances items={parts.machinery} material={m.steelDark} />
          <Instances items={parts.ballast} material={m.kentledge} />

          {/* Cab: a dark box with one faint amber window. */}
          <group position={[1.25, 0.9, 0.7]}>
            <mesh material={m.steelDark}>
              <boxGeometry args={[0.7, 0.85, 1.0]} />
            </mesh>
            <mesh position={[0.36, 0.08, 0.1]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[0.8, 0.5]} />
              <meshStandardMaterial color="#0a1220" emissive={site.lamp.color} emissiveIntensity={0.5} roughness={0.3} />
            </mesh>
          </group>

          <mesh position={[0, APEX + 0.2, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial ref={beacon} color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1} toneMapped={false} />
          </mesh>
          <mesh position={[0, JIB_Y + 0.3, 0.8 + crane.jibLength]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#e8eefb" emissive="#dfe8ff" emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
          {/* Machinery deck lamps: the one warm thing on the crane, and the
              detail that stops the counter jib reading as a bare stick. */}
          {[-0.55, 0.55].map((x) => (
            <mesh key={x} position={[x, JIB_Y + 0.5, -0.8 - crane.counterJibLength * 0.45]}>
              <boxGeometry args={[0.26, 0.2, 0.14]} />
              <meshStandardMaterial color="#20232a" emissive="#ffb765" emissiveIntensity={2.4} toneMapped={false} />
            </mesh>
          ))}
          {/* And the shafts they throw, forward along the jib and down at the work. */}
          <Beam from={lampFrom} to={LAMP_TO} spread={0.11} strength={0.46} color="#ffc078" fade={0.85} />

          <group ref={trolley} position={[0, TROLLEY_Y, crane.trolley]}>
            <mesh material={m.steelDark}>
              <boxGeometry args={[1.05, 0.34, 0.78]} />
            </mesh>
            {/* Two sheaves under the trolley, where the falls actually turn. */}
            {[-0.1, 0.1].map((x) => (
              <mesh key={x} position={[x, -0.2, 0]} rotation={[0, 0, Math.PI / 2]} material={m.galvanised}>
                <cylinderGeometry args={[0.1, 0.1, 0.07, 10]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* World space: ropes, hook block, spreader and the module on the hook. */}
      {[0, 1].map((i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            if (mesh) ropes.current[i] = mesh;
          }}
          material={m.cable}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <group ref={load}>
        <HookBlock />
        <group ref={rig}>
        <group ref={spreader}>
          {/* Bridle: two legs off the hook out to the ends of the beam. */}
          {[0, 1].map((i) => (
            <mesh
              key={`b${i}`}
              ref={(mesh) => {
                bridle.current[i] = mesh;
              }}
              material={m.cable}
            >
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
          ))}
          {/* The spreader itself: a main beam with a cross beam at each end. */}
          <mesh ref={beam} position={[0, BRIDLE_Y, 0]} castShadow material={m.rigging}>
            <boxGeometry args={[1, 0.16, 0.14]} />
          </mesh>
          {[0, 1].map((i) => (
            <mesh
              key={`c${i}`}
              ref={(mesh) => {
                crossBeams.current[i] = mesh;
              }}
              position={[0, BRIDLE_Y, 0]}
              material={m.rigging}
            >
              <boxGeometry args={[0.13, 0.13, 1]} />
            </mesh>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={i}
              ref={(mesh) => {
                if (mesh) slings.current[i] = mesh;
              }}
              material={m.cable}
            >
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
          ))}
        </group>
        {/* A solid precast unit, in the same concrete as the slabs it is being stacked onto. */}
        <group ref={anchors}>
          {[
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ].map(([sx, sz], i) => (
            <mesh
              key={i}
              position={[
                sx * PLANK.width * ANCHOR_X,
                -HOOK_ABOVE_SLAB + SLAB / 2 + 0.03,
                sz * PLANK.depth * ANCHOR_Z,
              ]}
              material={m.galvanised}
            >
              <torusGeometry args={[0.055, 0.017, 6, 12]} />
            </mesh>
          ))}
        </group>
        </group>
      </group>
    </group>
  );
}

/**
 * The hook block: cheek plates with the sheaves between them, a swivel, and
 * the hook itself - a C with a point on it, the one shape in the frame that
 * can only be one object.
 */
function HookBlock() {
  const m = materials();
  return (
    <group>
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, -BLOCK_H / 2 + 0.04, 0]} castShadow material={m.rigging}>
          <boxGeometry args={[0.06, BLOCK_H, 0.3]} />
        </mesh>
      ))}
      {[-0.07, 0.07].map((z) => (
        <mesh key={z} position={[0, -0.08, z]} rotation={[0, 0, Math.PI / 2]} material={m.galvanised}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 12]} />
        </mesh>
      ))}
      {/* Swivel and shank. */}
      <mesh position={[0, -BLOCK_H - 0.05, 0]} material={m.galvanised}>
        <cylinderGeometry args={[0.085, 0.085, 0.12, 10]} />
      </mesh>
      {/* The hook: three quarters of a ring, opening forward. */}
      <mesh position={[0, HOOK_EYE + 0.02, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 2]} material={m.galvanised}>
        <torusGeometry args={[0.15, 0.038, 8, 18, Math.PI * 1.45]} />
      </mesh>
      <mesh position={[0.095, HOOK_EYE - 0.11, 0]} rotation={[0, 0, Math.PI * 0.75]} material={m.galvanised}>
        <coneGeometry args={[0.038, 0.13, 8]} />
      </mesh>
    </group>
  );
}
