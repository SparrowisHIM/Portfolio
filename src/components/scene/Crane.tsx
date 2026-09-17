"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { SLAB_THICKNESS } from "@/lib/site-generator";
import { cranePose } from "@/lib/construction";
import { box, lattice, strut, truss, type Instance, type Vec3 } from "@/lib/geometry";
import { wind } from "@/lib/wind";
import { game } from "@/lib/stack-game";
import { Instances } from "./Instances";
import { materials, palette } from "./materials";

type CraneProps = {
  site: Site;
  /** Section value from scroll: 0 ground, 1..N floors, N+1 roof. */
  section: RefObject<number>;
  animate: boolean;
};

const MAST = 1.3;
const PANEL = 1.6;
const JIB_Y = 0.95;
const TROLLEY_Y = 0.7;
const HOOK_ABOVE_SLAB = 1.25;
const APEX = 4.2;

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
 * The tower crane does the building. A braced lattice mast, a slewing unit,
 * an A-frame tower top with pendants holding a tapered jib and a counter-jib
 * with concrete ballast. Slew, trolley and hook follow the construction
 * timeline; the load hangs as a damped pendulum so it lags and swings.
 */
export function Crane({ site, section, animate }: CraneProps) {
  const { crane } = site;
  const m = materials();
  const slew = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const slab = useRef<THREE.Group>(null);
  const spreader = useRef<THREE.Group>(null);
  const ropes = useRef<THREE.Mesh[]>([]);
  const slings = useRef<THREE.Mesh[]>([]);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);

  const loadPos = useRef(new THREE.Vector3());
  const loadVel = useRef(new THREE.Vector3());
  const settled = useRef(false);
  const tmpA = useRef(new THREE.Vector3());
  const tmpB = useRef(new THREE.Vector3());
  const tmpC = useRef(new THREE.Vector3());
  const tmpQ = useRef(new THREE.Quaternion());

  const parts = useMemo(() => {
    const mast = lattice({
      x: 0,
      z: 0,
      y0: 0.6,
      y1: crane.mastHeight,
      width: MAST,
      panel: PANEL,
      chord: 0.1,
      brace: 0.05,
    });
    // Ladder inside the mast, with hoops.
    const ladder: Instance[] = [];
    const rungs = Math.floor((crane.mastHeight - 1) / 0.32);
    for (let i = 0; i < rungs; i++) {
      ladder.push(box([0.12, 0.8 + i * 0.32, -0.4], [0.02, 0.02, 0.28]));
    }
    ladder.push(strut([0.12, 0.7, -0.55], [0.12, crane.mastHeight - 0.4, -0.55], 0.03));
    ladder.push(strut([0.12, 0.7, -0.25], [0.12, crane.mastHeight - 0.4, -0.25], 0.03));

    // Base: concrete ballast blocks on a cruciform steel base.
    const base: Instance[] = [];
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) base.push(box([dx * 1.25, 0.35, dz * 1.25], [1.4, 0.7, 1.4]));
    const baseSteel: Instance[] = [
      box([0, 0.5, 0], [4.2, 0.22, 0.3]),
      box([0, 0.5, 0], [0.3, 0.22, 4.2]),
      box([0, 0.3, 0], [MAST + 0.4, 0.6, MAST + 0.4]),
    ];

    // Slewing unit and tower top (local to the slew group, origin at mast top).
    const towerTop: Instance[] = [];
    const h = MAST / 2;
    const apex: Vec3 = [0, APEX, 0];
    for (const [dx, dz] of [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ]) {
      towerTop.push(strut([dx, 0.7, dz], apex, 0.09));
    }
    for (let i = 0; i < 4; i++) {
      const y = 1.4 + i * 0.85;
      const s = h * (1 - y / APEX) * 0.95;
      towerTop.push(strut([-s, y, -s], [s, y, -s], 0.04));
      towerTop.push(strut([s, y, -s], [s, y, s], 0.04));
      towerTop.push(strut([s, y, s], [-s, y, s], 0.04));
      towerTop.push(strut([-s, y, s], [-s, y, -s], 0.04));
    }

    // Jib: tapered triangular truss running out along +z.
    const jib = truss({
      origin: [0, JIB_Y, 0.9],
      dir: [0, 0, 1],
      length: crane.jibLength,
      width: 0.8,
      height: 0.8,
      panel: 1.45,
      chord: 0.075,
      brace: 0.04,
      taper: true,
    });
    // Counter-jib: a flatter truss running back along -z.
    const counter = truss({
      origin: [0, JIB_Y, -0.9],
      dir: [0, 0, -1],
      length: crane.counterJibLength,
      width: 1.1,
      height: 0.42,
      panel: 1.3,
      chord: 0.075,
      brace: 0.04,
    });
    const pendants: Instance[] = [
      strut(apex, [0, JIB_Y + 0.35, 0.9 + crane.jibLength * 0.62], 0.035),
      strut(apex, [0, JIB_Y + 0.25, 0.9 + crane.jibLength * 0.3], 0.03),
      strut(apex, [0, JIB_Y + 0.4, -0.9 - crane.counterJibLength + 0.5], 0.035),
    ];
    // Counterweights: concrete slabs hung at the back.
    const ballast: Instance[] = [0, 1, 2, 3].map((i) =>
      box([0, JIB_Y - 0.55 - i * 0.02, -0.9 - crane.counterJibLength + 0.9 + i * 0.36], [1.5, 1.1, 0.32]),
    );
    // Machinery: hoist winch drum and motor on the counter-jib deck.
    const machinery: Instance[] = [
      box([0, JIB_Y + 0.42, -0.9 - crane.counterJibLength * 0.4], [0.9, 0.5, 1.1]),
      box([-0.55, JIB_Y + 0.38, -0.9 - crane.counterJibLength * 0.4], [0.35, 0.4, 0.5]),
    ];
    // Walkway handrail along the counter-jib.
    const rails: Instance[] = [];
    for (const s of [-1, 1]) {
      rails.push(strut([s * 0.55, JIB_Y + 0.2, -0.9], [s * 0.55, JIB_Y + 1.1, -0.9], 0.025));
      rails.push(strut([s * 0.55, JIB_Y + 0.2, -0.9 - crane.counterJibLength + 0.2], [s * 0.55, JIB_Y + 1.1, -0.9 - crane.counterJibLength + 0.2], 0.025));
      rails.push(strut([s * 0.55, JIB_Y + 1.1, -0.9], [s * 0.55, JIB_Y + 1.1, -0.9 - crane.counterJibLength + 0.2], 0.025));
      rails.push(strut([s * 0.55, JIB_Y + 0.65, -0.9], [s * 0.55, JIB_Y + 0.65, -0.9 - crane.counterJibLength + 0.2], 0.02));
    }

    return {
      mast: [...mast.chords, ...mast.braces],
      ladder,
      base,
      baseSteel,
      towerTop: [...towerTop, ...jib.chords, ...jib.braces, ...counter.chords, ...counter.braces],
      pendants,
      ballast,
      machinery,
      rails,
    };
  }, [crane]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 30);
    let pose = cranePose(site, section.current ?? 0);
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

    // Pendulum: the load chases the hook horizontally with a spring and damper,
    // and the wind leans on it.
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
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y = THREE.MathUtils.damp(pos.y, target.y, animate ? 10 : 200, dt);

    if (load.current) {
      load.current.position.copy(pos);
      load.current.rotation.z = -vel.x * 0.02;
      load.current.rotation.x = vel.z * 0.02;
      // The slab turns to face the tower as it comes in.
      load.current.rotation.y = THREE.MathUtils.damp(load.current.rotation.y, 0, 2, dt);
    }
    if (slab.current) {
      // The game draws its own slab on the hook.
      slab.current.visible = pose.loaded && !playing;
      slab.current.scale.set(pose.slab.width, 1, pose.slab.depth);
    }
    if (spreader.current) spreader.current.visible = pose.loaded;

    // Hoist ropes: two falls from the trolley down to the hook block.
    if (trolley.current) {
      const top = trolley.current.getWorldPosition(tmpB.current);
      for (let i = 0; i < 2; i++) {
        const rope = ropes.current[i];
        if (!rope) continue;
        const off = (i === 0 ? -1 : 1) * 0.12;
        tmpC.current.set(pos.x + off, pos.y + 0.2, pos.z);
        const from = tmpA.current.set(top.x + off, top.y - 0.25, top.z);
        aim(rope, from, tmpC.current, 0.022, tmpB.current, tmpQ.current);
      }
    }

    // Slings from the spreader beam to the slab corners.
    if (pose.loaded) {
      const w = pose.slab.width * 0.42;
      const d = pose.slab.depth * 0.42;
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
        tmpA.current.set(Math.sign(cx) * 0.9, -0.55, 0);
        tmpB.current.set(cx, -HOOK_ABOVE_SLAB + SLAB_THICKNESS, cz);
        aim(sling, tmpA.current, tmpB.current, 0.03, tmpC.current, tmpQ.current);
      });
    } else {
      for (const sling of slings.current) if (sling) sling.visible = false;
    }

    if (beacon.current) {
      const t = clock.getElapsedTime();
      beacon.current.emissiveIntensity = animate ? (Math.sin(t * 2.2) > 0.6 ? 5 : 0.25) : 2.5;
    }
  });

  return (
    <group>
      <group position={crane.position}>
        <Instances items={parts.base} material={m.concrete} />
        <Instances items={parts.baseSteel} material={m.steelDark} />
        <Instances items={parts.mast} material={m.crane} />
        <Instances items={parts.ladder} material={m.galvanised} />

        <group ref={slew} position={[0, crane.mastHeight, 0]}>
          {/* Slewing ring and machinery deck. */}
          <mesh position={[0, 0.2, 0]} material={m.steelDark}>
            <cylinderGeometry args={[1.05, 1.05, 0.4, 24]} />
          </mesh>
          <mesh position={[0, 0.55, 0]} material={m.crane}>
            <boxGeometry args={[1.7, 0.3, 2.4]} />
          </mesh>
          <Instances items={parts.towerTop} material={m.crane} />
          <Instances items={parts.pendants} material={m.galvanised} />
          <Instances items={parts.ballast} material={m.concreteDark} />
          <Instances items={parts.machinery} material={m.steelDark} />
          <Instances items={parts.rails} material={m.galvanised} />

          {/* Operator cab, hung off the front corner, lit. */}
          <group position={[1.05, 1.05, 0.55]}>
            <mesh material={m.cabin}>
              <boxGeometry args={[0.85, 1.05, 1.25]} />
            </mesh>
            <mesh position={[0.43, 0.08, 0.1]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[1.0, 0.7]} />
              <meshStandardMaterial color={palette.glass} emissive={palette.sodium} emissiveIntensity={1.1} roughness={0.25} />
            </mesh>
            <mesh position={[0.1, 0.08, 0.63]}>
              <planeGeometry args={[0.6, 0.7]} />
              <meshStandardMaterial color={palette.glass} emissive={palette.sodium} emissiveIntensity={1.1} roughness={0.25} />
            </mesh>
            <pointLight color={palette.sodium} intensity={3} distance={5} decay={2} />
          </group>

          {/* Aircraft warning beacon at the apex, obstruction light at the tip. */}
          <mesh position={[0, APEX + 0.25, 0]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial ref={beacon} color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={2} toneMapped={false} />
          </mesh>
          <mesh position={[0, JIB_Y + 0.35, 0.9 + crane.jibLength]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          {/* Hazard-striped jib tip. */}
          <mesh position={[0, JIB_Y, 0.9 + crane.jibLength - 0.5]} material={m.hazard}>
            <boxGeometry args={[0.9, 0.12, 1.0]} />
          </mesh>

          <group ref={trolley} position={[0, TROLLEY_Y, crane.trolley]}>
            <mesh material={m.hazard}>
              <boxGeometry args={[0.95, 0.3, 0.7]} />
            </mesh>
            {[-0.4, 0.4].map((x) => (
              <mesh key={x} position={[x, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} material={m.steelDark}>
                <cylinderGeometry args={[0.12, 0.12, 0.08, 12]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* World space: ropes, hook block, spreader and whatever hangs from it. */}
      {[0, 1].map((i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            if (mesh) ropes.current[i] = mesh;
          }}
          material={m.galvanised}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <group ref={load}>
        {/* Hook block: sheave housing and the hook itself. */}
        <mesh position={[0, 0.02, 0]} material={m.hazard}>
          <boxGeometry args={[0.36, 0.42, 0.18]} />
        </mesh>
        <mesh position={[0, -0.3, 0]} material={m.steelDark}>
          <cylinderGeometry args={[0.05, 0.05, 0.22, 8]} />
        </mesh>
        <mesh position={[0, -0.45, 0]} rotation={[0, 0, Math.PI]} material={m.steelDark}>
          <torusGeometry args={[0.12, 0.035, 8, 12, Math.PI * 1.5]} />
        </mesh>
        <group ref={spreader}>
          <mesh position={[0, -0.55, 0]} material={m.crane}>
            <boxGeometry args={[2.0, 0.12, 0.14]} />
          </mesh>
          <mesh position={[0, -0.42, 0]} material={m.galvanised}>
            <boxGeometry args={[0.04, 0.26, 0.04]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={i}
              ref={(mesh) => {
                if (mesh) slings.current[i] = mesh;
              }}
              material={m.galvanised}
            >
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
          ))}
        </group>
        <group ref={slab} position={[0, -HOOK_ABOVE_SLAB + SLAB_THICKNESS / 2, 0]}>
          <mesh material={m.concrete}>
            <boxGeometry args={[1, SLAB_THICKNESS, 1]} />
          </mesh>
          <mesh position={[0, -SLAB_THICKNESS / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.deck}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
