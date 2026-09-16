"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { SLAB_THICKNESS } from "@/lib/site-generator";
import { cranePose } from "@/lib/construction";
import { concrete, palette, safety, steel } from "./materials";

type CraneProps = {
  site: Site;
  /** Section value from scroll: 0 ground, 1..N floors, N+1 roof. */
  section: RefObject<number>;
  animate: boolean;
};

const MAST = 0.7;
const JIB_Y = 0.9;
const TROLLEY_Y = 0.72;
const HOOK_ABOVE_SLAB = 1.25;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The tower crane does the building. Its slew, trolley and hook follow the
 * construction timeline, and the slab on the hook hangs as a damped pendulum
 * so it lags and swings when the crane moves.
 */
export function Crane({ site, section, animate }: CraneProps) {
  const { crane } = site;
  const slew = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const slab = useRef<THREE.Mesh>(null);
  const cable = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);

  const loadPos = useRef(new THREE.Vector3());
  const loadVel = useRef(new THREE.Vector3());
  const settled = useRef(false);

  const tmpA = useRef(new THREE.Vector3());
  const tmpB = useRef(new THREE.Vector3());
  const tmpQ = useRef(new THREE.Quaternion());

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const pose = cranePose(site, section.current ?? 0);

    // Slew and trolley snap to the timeline; the load is what lags.
    if (slew.current) slew.current.rotation.y = pose.angle;
    if (trolley.current) trolley.current.position.z = pose.trolley;

    // Pendulum: the load chases the hook horizontally with a spring and damper.
    const target = tmpA.current.set(pose.hook[0], pose.hook[1], pose.hook[2]);
    const pos = loadPos.current;
    const vel = loadVel.current;
    if (!settled.current) {
      pos.copy(target);
      vel.set(0, 0, 0);
      settled.current = true;
    }
    const stiffness = animate ? 26 : 400;
    const damping = animate ? 4.2 : 40;
    vel.x += ((target.x - pos.x) * stiffness - vel.x * damping) * dt;
    vel.z += ((target.z - pos.z) * stiffness - vel.z * damping) * dt;
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y = THREE.MathUtils.damp(pos.y, target.y, animate ? 10 : 200, dt);

    if (load.current) {
      load.current.position.copy(pos);
      // Tilt the load slightly into its swing.
      load.current.rotation.z = -vel.x * 0.02;
      load.current.rotation.x = vel.z * 0.02;
    }
    if (slab.current) {
      slab.current.visible = pose.loaded;
      slab.current.scale.set(pose.slab.width, 1, pose.slab.depth);
    }

    // Cable: from the trolley on the jib down to the hook.
    if (cable.current && trolley.current) {
      const top = trolley.current.getWorldPosition(tmpB.current);
      const dir = tmpA.current.copy(pos).sub(top);
      const length = Math.max(0.01, dir.length());
      cable.current.position.copy(top).addScaledVector(dir, 0.5);
      cable.current.quaternion.copy(tmpQ.current.setFromUnitVectors(UP, dir.normalize()));
      cable.current.scale.y = length;
    }

    // Aircraft warning beacon on the mast.
    if (beacon.current) {
      const blink = animate ? (Math.sin(clock.getElapsedTime() * 2.2) > 0.6 ? 4 : 0.2) : 2;
      beacon.current.emissiveIntensity = blink;
    }
  });

  const mastSegments = Math.floor(crane.mastHeight / 1.6);

  return (
    <group>
      <group position={crane.position}>
        <mesh position={[0, 0.25, 0]} material={concrete}>
          <boxGeometry args={[2.4, 0.5, 2.4]} />
        </mesh>
        <mesh position={[0, crane.mastHeight / 2, 0]} material={safety}>
          <boxGeometry args={[MAST, crane.mastHeight, MAST]} />
        </mesh>
        {Array.from({ length: mastSegments }, (_, i) => (
          <mesh key={i} position={[0, (i + 0.5) * 1.6, 0]} material={steel}>
            <boxGeometry args={[MAST + 0.16, 0.05, MAST + 0.16]} />
          </mesh>
        ))}
        <group ref={slew} position={[0, crane.mastHeight, 0]}>
          <mesh position={[0, 0.4, 0]} material={safety}>
            <boxGeometry args={[1.1, 0.8, 1.1]} />
          </mesh>
          <mesh position={[0.8, 0.25, 0]}>
            <boxGeometry args={[0.7, 0.7, 0.8]} />
            <meshStandardMaterial
              color={palette.glass}
              emissive={palette.sodium}
              emissiveIntensity={1.4}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, JIB_Y, crane.jibLength / 2]} material={safety}>
            <boxGeometry args={[0.35, 0.35, crane.jibLength]} />
          </mesh>
          <mesh position={[0, JIB_Y, -crane.counterJibLength / 2]} material={safety}>
            <boxGeometry args={[0.35, 0.35, crane.counterJibLength]} />
          </mesh>
          <mesh position={[0, 0.4, -crane.counterJibLength + 0.6]} material={concrete}>
            <boxGeometry args={[1, 1.1, 1.4]} />
          </mesh>
          <mesh position={[0, 2.4, 0]} material={safety}>
            <boxGeometry args={[0.2, 3, 0.2]} />
          </mesh>
          <mesh position={[0, 4, 0]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial
              ref={beacon}
              color="#ff2a2a"
              emissive="#ff2a2a"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
          <Pendant from={[0, 3.9, 0]} to={[0, JIB_Y + 0.15, crane.jibLength * 0.75]} />
          <Pendant from={[0, 3.9, 0]} to={[0, JIB_Y + 0.15, -crane.counterJibLength + 0.4]} />
          <group ref={trolley} position={[0, TROLLEY_Y, crane.trolley]}>
            <mesh material={steel}>
              <boxGeometry args={[0.5, 0.3, 0.6]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* World-space: the cable and whatever hangs from it. */}
      <mesh ref={cable}>
        <boxGeometry args={[0.03, 1, 0.03]} />
        <meshStandardMaterial color={palette.steel} metalness={0.9} roughness={0.3} />
      </mesh>
      <group ref={load}>
        <mesh position={[0, -0.15, 0]} material={steel}>
          <boxGeometry args={[0.25, 0.3, 0.12]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 0.6, -0.65, 0]}
            rotation={[0, 0, s * 0.62]}
            material={steel}
          >
            <boxGeometry args={[0.02, 1.35, 0.02]} />
          </mesh>
        ))}
        <mesh ref={slab} position={[0, -HOOK_ABOVE_SLAB + SLAB_THICKNESS / 2, 0]} material={concrete}>
          <boxGeometry args={[1, SLAB_THICKNESS, 1]} />
        </mesh>
      </group>
    </group>
  );
}

function Pendant({
  from,
  to,
}: {
  from: [number, number, number];
  to: [number, number, number];
}) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const length = dir.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  return (
    <mesh position={mid} quaternion={quaternion} material={steel}>
      <boxGeometry args={[0.03, length, 0.03]} />
    </mesh>
  );
}
