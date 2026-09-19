"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { cranePose } from "@/lib/construction";
import { box, lattice, strut, truss, type Instance, type Vec3 } from "@/lib/geometry";
import { plinth, SLAB } from "@/lib/building";
import { wind } from "@/lib/wind";
import { game } from "@/lib/stack-game";
import { emitBurst, emitPulse, workHue } from "@/lib/pulses";
import { Instances } from "./Instances";
import { materials } from "./materials";

type CraneProps = {
  site: Site;
  /** Construction time: 0 ground, 1..N floors, N+1 roof. Stops at topping out. */
  build: RefObject<number>;
  animate: boolean;
};

const MAST = 1.6;
const PANEL = 1.9;
const JIB_Y = 0.9;
const TROLLEY_Y = 0.66;
const HOOK_ABOVE_SLAB = 1.25;
const APEX = 4.6;

const UP = new THREE.Vector3(0, 1, 0);

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
  const slew = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);
  const spreader = useRef<THREE.Group>(null);
  const ropes = useRef<THREE.Mesh[]>([]);
  const slings = useRef<THREE.Mesh[]>([]);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const wasLoaded = useRef(false);
  const loadPos = useRef(new THREE.Vector3());
  const loadVel = useRef(new THREE.Vector3());
  const settled = useRef(false);
  const tmpA = useRef(new THREE.Vector3());
  const tmpB = useRef(new THREE.Vector3());
  const tmpC = useRef(new THREE.Vector3());
  const tmpQ = useRef(new THREE.Quaternion());
  /** Where the trolley is in the world, kept clear of the scratch vectors. */
  const hookTop = useRef(new THREE.Vector3());

  const parts = useMemo(() => {
    const mast = lattice({ x: 0, z: 0, y0: 0.4, y1: crane.mastHeight, width: MAST, panel: PANEL, chord: 0.11, brace: 0.05 });
    const base: Instance[] = [box([0, 0.2, 0], [MAST + 0.9, 0.5, MAST + 0.9]), box([0, 0.06, 0], [4.4, 0.16, 0.26]), box([0, 0.06, 0], [0.26, 0.16, 4.4])];

    const towerTop: Instance[] = [];
    const h = MAST / 2;
    const apex: Vec3 = [0, APEX, 0];
    for (const [dx, dz] of [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ]) {
      towerTop.push(strut([dx, 0.5, dz], apex, 0.085));
    }
    for (let i = 0; i < 3; i++) {
      const y = 1.5 + i * 1.05;
      const s = h * (1 - y / APEX) * 0.95;
      towerTop.push(strut([-s, y, -s], [s, y, -s], 0.042), strut([s, y, -s], [s, y, s], 0.042), strut([s, y, s], [-s, y, s], 0.042), strut([-s, y, s], [-s, y, -s], 0.042));
    }
    const jib = truss({ origin: [0, JIB_Y, 0.8], dir: [0, 0, 1], length: crane.jibLength, width: 0.95, height: 0.95, panel: 1.7, chord: 0.082, brace: 0.042, taper: true });
    const counter = truss({ origin: [0, JIB_Y, -0.8], dir: [0, 0, -1], length: crane.counterJibLength, width: 1.15, height: 0.5, panel: 1.4, chord: 0.082, brace: 0.042 });
    const pendants: Instance[] = [
      strut(apex, [0, JIB_Y + 0.3, 0.8 + crane.jibLength * 0.62], 0.032),
      strut(apex, [0, JIB_Y + 0.22, 0.8 + crane.jibLength * 0.3], 0.028),
      strut(apex, [0, JIB_Y + 0.34, -0.8 - crane.counterJibLength + 0.5], 0.032),
    ];
    const ballast: Instance[] = [0, 1, 2].map((i) => box([0, JIB_Y - 0.5, -0.8 - crane.counterJibLength + 0.9 + i * 0.4], [1.7, 1.25, 0.34]));

    // Node lights: one every few panels up the mast, and at the jib tip.
    const lights: Vec3[] = [];
    const panels = Math.floor((crane.mastHeight - 0.4) / PANEL);
    for (let p = 3; p < panels; p += 5) lights.push([h, 0.4 + p * PANEL, h]);

    return { mast: [...mast.chords, ...mast.braces], base, towerTop: [...towerTop, ...jib.chords, ...jib.braces, ...counter.chords, ...counter.braces], pendants, ballast, lights };
  }, [crane]);

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

    if (slew.current) slew.current.rotation.y = pose.angle;
    if (trolley.current) trolley.current.position.z = pose.trolley;

    // Pendulum: the load chases the hook with a spring and damper, and the
    // wind leans on it. The vertical spring is what gives the overshoot and
    // snap when the frame lands.
    const target = tmpA.current.set(pose.hook[0], pose.hook[1], pose.hook[2]);
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
    // The module hides the moment it locks; the structure takes over. That
    // moment sends a pulse through the building.
    if (frame.current) {
      frame.current.visible = pose.loaded && !playing;
      // Cut to the plate it is carrying. The unit box is already one slab
      // thick, so only the plan dimensions scale.
      frame.current.scale.set(pose.slab.width, 1, pose.slab.depth);
      frame.current.rotation.y = pose.rotation ?? 0;
    }
    if (spreader.current) spreader.current.visible = pose.loaded;
    if (wasLoaded.current && !pose.loaded && animate && !playing) {
      emitPulse(pos.x, pos.y - HOOK_ABOVE_SLAB, pos.z, workHue());
      emitBurst(pos.x, pos.y - HOOK_ABOVE_SLAB, pos.z, "amber", 16);
    }
    wasLoaded.current = pose.loaded;

    // Hoist ropes: two falls from the trolley down to the hook block. The
    // trolley position is kept in its own vector — aim() uses its scratch
    // argument as working space and would otherwise overwrite it.
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

    // Slings from the spreader to the module corners.
    if (pose.loaded) {
      const w = pose.slab.width * 0.46;
      const d = pose.slab.depth * 0.46;
      const corners = [
        [-w, -d],
        [w, -d],
        [-w, d],
        [w, d],
      ];
      corners.forEach(([cx, cz], i) => {
        const sling = slings.current[i];
        if (!sling) return;
        sling.visible = true;
        tmpA.current.set(Math.sign(cx) * 1.05, -0.5, 0);
        tmpB.current.set(cx, -HOOK_ABOVE_SLAB, cz);
        aim(sling, tmpA.current, tmpB.current, 0.035, tmpC.current, tmpQ.current);
      });
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
        <Instances items={parts.mast} material={m.crane} />
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
          <Instances items={parts.ballast} material={m.steelDark} />

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

          <group ref={trolley} position={[0, TROLLEY_Y, crane.trolley]}>
            <mesh material={m.steelDark}>
              <boxGeometry args={[1.05, 0.34, 0.78]} />
            </mesh>
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
        {/* Hook block: sheaves, cheek plates and the hook itself. Small
            enough to be honest, big enough to read at this distance. */}
        <mesh position={[0, 0.06, 0]} castShadow material={m.steelDark}>
          <boxGeometry args={[0.46, 0.52, 0.22]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]} material={m.galvanised}>
          <cylinderGeometry args={[0.17, 0.17, 0.26, 12]} />
        </mesh>
        <mesh position={[0, -0.34, 0]} material={m.galvanised}>
          <cylinderGeometry args={[0.055, 0.055, 0.34, 8]} />
        </mesh>
        <group ref={spreader}>
          <mesh position={[0, -0.5, 0]} material={m.steelDark}>
            <boxGeometry args={[2.4, 0.11, 0.14]} />
          </mesh>
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
        {/*
          A solid precast unit, in the same concrete as the slabs it is being
          stacked onto. It used to be a glowing wireframe outline, which was
          the single loudest thing still saying "diagram" once the building
          underneath it went solid.
        */}
        <group ref={frame}>
          <mesh position={[0, -HOOK_ABOVE_SLAB, 0]} material={m.precast} castShadow>
            <boxGeometry args={[1, SLAB, 1]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
