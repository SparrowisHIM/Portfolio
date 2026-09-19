"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { HOOK_ABOVE_SLAB, TROLLEY_Y, cranePose } from "@/lib/construction";
import { box, lattice, strut, truss, type Instance, type Vec3 } from "@/lib/geometry";
import { plinth, SLAB } from "@/lib/building";
import { PLANK } from "@/lib/construction";
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
const APEX = 4.6;

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

const UP = new THREE.Vector3(0, 1, 0);

/** The same turn expressed as the shorter of the two ways round. */
function shortTurn(delta: number) {
  return (((delta + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
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
  /*
    How far the base may reach before it runs out of deck.

    The crane stands close to the edge on the side it works from — it has to
    clear the building, and the plinth only carries an apron on the laydown
    side — so a cruciform sized by eye put the kentledge a metre and a
    quarter out in the black. Invisible from the front, where the crane
    always is; not invisible from a free orbit, and not once there is a
    fence along that edge to run through.
  */
  const reach = useMemo(() => {
    const b = plinth(site);
    const room = (c: number, centre: number, half: number) =>
      Math.min(centre + half - c, c - (centre - half));
    const x = room(crane.position[0], b.offsetX, b.width / 2);
    const z = room(crane.position[2], b.offsetZ, b.depth / 2);
    // Back off far enough that the hoarding can pass outside the base as
    // well: its line is set in from the edge and its posts stand proud.
    return Math.max(1.1, Math.min(x, z) - 0.8);
  }, [site, crane]);
  const slew = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);
  const spreader = useRef<THREE.Group>(null);
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
  const jibAt = useRef({ angle: 0, trolley: 0, y: 0, set: false });
  const tmpA = useRef(new THREE.Vector3());
  const tmpB = useRef(new THREE.Vector3());
  const tmpC = useRef(new THREE.Vector3());
  const tmpQ = useRef(new THREE.Quaternion());
  /** Where the trolley is in the world, kept clear of the scratch vectors. */
  const hookTop = useRef(new THREE.Vector3());

  const parts = useMemo(() => {
    const mast = lattice({ x: 0, z: 0, y0: 0.4, y1: crane.mastHeight, width: MAST, panel: PANEL, chord: 0.11, brace: 0.05 });
    // Cruciform base: the pedestal, the two cross girders, and the feet
    // they bear on. A tower crane is held down by weight, not by the deck.
    const arm = reach;
    const base: Instance[] = [
      box([0, 0.2, 0], [MAST + 0.9, 0.5, MAST + 0.9]),
      box([0, 0.14, 0], [arm * 2, 0.3, 0.34]),
      box([0, 0.14, 0], [0.34, 0.3, arm * 2]),
    ];
    const foot = Math.min(0.8, arm * 0.7);
    for (const [fx, fz] of [
      [arm - foot / 2, 0],
      [-(arm - foot / 2), 0],
      [0, arm - foot / 2],
      [0, -(arm - foot / 2)],
    ]) {
      base.push(box([fx, 0.09, fz], [foot, 0.18, foot]));
    }
    // Kentledge: four cast blocks on the feet. The single cheapest thing
    // that stops the mast reading as a stick pushed into the deck.
    /*
      Kentledge on the four feet, sized to whatever deck is left. It is what
      holds a tower crane down, and the cheapest thing that stops the mast
      reading as a stick pushed into the deck — but only while it is on the
      deck.
    */
    const kentledge: Instance[] = [];
    const kd = Math.min(0.9, arm * 0.62);
    const kw = Math.min(2.2, arm * 1.5);
    const kc = arm - kd / 2;
    for (const [kx, kz, w, d] of [
      [kc, 0, kd, kw],
      [-kc, 0, kd, kw],
      [0, kc, kw, kd],
      [0, -kc, kw, kd],
    ]) {
      kentledge.push(box([kx, 0.42, kz], [w, 0.48, d]));
      kentledge.push(box([kx, 0.88, kz], [w * 0.94, 0.44, d * 0.94]));
    }

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

    /*
      The ladder, and a rest platform every few lifts.

      A tower crane is a thing people climb, and the ladder is the detail
      that says so — it runs the full height inside one face of the mast,
      which is also why it reads: a second, finer rhythm inside the lattice
      that the bracing alone does not give.
    */
    const access: Instance[] = [];
    const lx = h * 0.34;
    const lz = -h + 0.12;
    access.push(strut([-lx, 0.5, lz], [-lx, crane.mastHeight - 0.3, lz], 0.035));
    access.push(strut([lx, 0.5, lz], [lx, crane.mastHeight - 0.3, lz], 0.035));
    for (let y = 0.9; y < crane.mastHeight - 0.4; y += 0.34) {
      access.push(strut([-lx, y, lz], [lx, y, lz], 0.022));
    }
    for (let y = 3.2; y < crane.mastHeight - 1.2; y += PANEL * 3) {
      access.push(box([0, y, 0], [MAST + 0.34, 0.06, MAST + 0.34]));
      for (const [gx, gz] of [
        [0, (MAST + 0.34) / 2],
        [0, -(MAST + 0.34) / 2],
      ]) {
        access.push(box([gx, y + 0.42, gz], [MAST + 0.34, 0.04, 0.04]));
      }
    }

    /*
      Machinery on the counter jib: the hoist drum, its motor, and a walkway
      with a handrail along the deck. The counter jib was a bare truss with
      three ballast blocks on the end, which is the half of the crane that
      does the work and looked like the half that does nothing.
    */
    const machinery: Instance[] = [];
    const deckZ = -0.8 - crane.counterJibLength * 0.42;
    machinery.push(box([0, JIB_Y + 0.5, deckZ], [1.5, 0.66, 1.5]));
    machinery.push(box([0, JIB_Y + 0.42, deckZ + 1.15], [1.1, 0.5, 0.8]));
    for (const side of [-1, 1]) {
      machinery.push(
        strut(
          [side * 0.78, JIB_Y + 0.28, -0.8],
          [side * 0.78, JIB_Y + 0.28, -0.8 - crane.counterJibLength],
          0.05,
        ),
      );
      machinery.push(
        strut(
          [side * 0.78, JIB_Y + 0.92, -0.8],
          [side * 0.78, JIB_Y + 0.92, -0.8 - crane.counterJibLength],
          0.035,
        ),
      );
    }
    // The jib tip: a sheave case, so the jib ends in something.
    machinery.push(box([0, JIB_Y + 0.12, 0.8 + crane.jibLength - 0.2], [0.34, 0.5, 0.6]));

    return {
      mast: [...mast.chords, ...mast.braces],
      base,
      kentledge,
      access,
      machinery,
      towerTop: [...towerTop, ...jib.chords, ...jib.braces, ...counter.chords, ...counter.braces],
      pendants,
      ballast,
      lights,
    };
  }, [crane, reach]);

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

    /*
      The jib eases to its pose; it is never cut to it.

      The timeline hands over between states in a single frame, and two of
      those hand-overs move the crane a long way: the tenth of a section
      between one floor finishing and the next beginning, and the moment the
      site tops out and the crane goes to standing by with a plate held over
      the roof. That last one slews half a radian, runs the trolley out three
      metres and lifts the hook twenty. Applied raw, the whole crane jumps.
    */
    const jib = jibAt.current;
    if (!jib.set) {
      jib.angle = pose.angle;
      jib.trolley = pose.trolley;
      jib.y = pose.hook[1];
      jib.set = true;
    }
    const ease = animate && !playing ? 1 - Math.exp(-7 * dt) : 1;
    jib.angle += shortTurn(pose.angle - jib.angle) * ease;
    jib.trolley += (pose.trolley - jib.trolley) * ease;
    jib.y += (pose.hook[1] - jib.y) * ease;

    if (slew.current) slew.current.rotation.y = jib.angle;
    if (trolley.current) trolley.current.position.z = jib.trolley;

    // Pendulum: the load chases the hook with a spring and damper, and the
    // wind leans on it. The vertical spring is what gives the overshoot and
    // snap when the frame lands.
    // The hook hangs under the trolley, so it chases the eased pose the jib
    // is drawn from rather than the raw one — otherwise the rope leans away
    // from the trolley for as long as the two disagree.
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
    // The module hides the moment it locks; the structure takes over. That
    // moment sends a pulse through the building.
    if (frame.current) {
      frame.current.visible = pose.loaded && !playing;
      // Cut to the plate it is carrying. The unit box is already one slab
      // thick, so only the plan dimensions scale.
      frame.current.scale.set(pose.slab.width, 1, pose.slab.depth);
      frame.current.rotation.y = pose.rotation ?? 0;
    }
    /*
      The rigging shows from the moment the slings go on, not from the
      moment the weight moves. Before that change the plate simply appeared
      on the hook with its gear already attached; now the empty hook comes
      down on the pile, the spreader lands on it, and the lift starts.
    */
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

    /*
      Four slings, from the ends of the cross beams down to anchors cast
      into the plate.

      They used to run from a short bar near the hook out to the plate
      corners, which over a seven metre plate is a couple of degrees off
      horizontal — they read as scratches lying on the concrete rather than
      as anything holding it. Hung from a beam that is itself two thirds of
      the plate wide, they are near vertical, which is both what a spreader
      is for and the thing that makes the lift legible.
    */
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
        {/*
          The hook block.

          It was a box, a disc and a stub of cylinder — honest about mass and
          silent about what it was. A block is cheek plates with the sheaves
          turning between them, a swivel under that, and then the hook: a C
          with a point on it. The C is the whole thing. At this distance it
          is five or six pixels, and it is still the only shape in the frame
          that can only be one object.
        */}
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
        {/*
          Lifting anchors, cast into the plate's top face. Four small loops
          for the slings to end on — without them the slings stop in mid air
          a hair above the concrete and nothing is holding anything.
        */}
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
              rotation={[0, 0, 0]}
              material={m.galvanised}
            >
              <torusGeometry args={[0.055, 0.017, 6, 12]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
