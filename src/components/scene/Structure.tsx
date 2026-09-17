"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { floorProgress } from "@/lib/construction";
import { wind, windAt } from "@/lib/wind";
import { MAX_FLOORS, type Packed, type Structure as Skeleton } from "@/lib/structure";
import { MAX_PULSES, cursor, emitBurst, emitPulse, events, floorHue, HUES, scene } from "@/lib/pulses";
import { memberDefines, memberFragment, memberVertex } from "./shaders/member";
import { skinDefines, skinFragment, skinVertex } from "./shaders/skin";

type StructureProps = {
  site: Site;
  skeleton: Skeleton;
  /** Smoothed section value: 0 ground, 1..N floors, N+1 roof. */
  section: RefObject<number>;
  animate: boolean;
  /** Cursor force on the lines; off on weak devices. */
  force: boolean;
  onSelectFloor?: (index: number) => void;
};

const BASE = new THREE.Color("#5c6a86");
const NODE_BASE = new THREE.Color("#7f8ca8");
/** Seconds of quiet before the building sends a pulse of its own. */
const IDLE_PULSE = 7.5;

function attr(array: Float32Array, size: number) {
  return new THREE.InstancedBufferAttribute(array, size);
}

/** Geometry with the packed per-instance assembly data attached. */
function memberGeometry(packed: Packed, base: THREE.BufferGeometry) {
  const g = base.clone();
  g.setAttribute("aFloor", attr(packed.floor, 1));
  g.setAttribute("aStart", attr(packed.start, 1));
  g.setAttribute("aDur", attr(packed.dur, 1));
  g.setAttribute("aOrigin", attr(packed.origin, 3));
  g.setAttribute("aSeed", attr(packed.seed, 1));
  g.setAttribute("aHue", attr(packed.hue, 1));
  g.setAttribute("aWeight", attr(packed.weight, 1));
  const lock = new Float32Array(packed.count).fill(-1);
  g.setAttribute("aLock", attr(lock, 1).setUsage(THREE.DynamicDrawUsage));
  return g;
}

function sharedUniforms() {
  return {
    uProgress: { value: new Float32Array(MAX_FLOORS) },
    uTime: { value: 0 },
    uCursor: { value: new THREE.Vector3() },
    uCursorVel: { value: new THREE.Vector3() },
    uCursorOn: { value: 0 },
    uPulses: { value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector4(0, 0, 0, -1)) },
    uPulseHue: { value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector3(1, 0.7, 0.3)) },
    uGlow: { value: scene.glow },
    /** Whole-structure field: scroll shear, wind lean, tear amount, height scale, smoothed section. */
    uShear: { value: new THREE.Vector3() },
    uWind: { value: new THREE.Vector2() },
    uTear: { value: 0 },
    uHeight: { value: 1 },
    /** How much the always-on structural shimmer runs. */
    uLife: { value: 0 },
    /** The colour of each floor, and the colour the scene leans toward at this scroll position. */
    uFloorHue: { value: Array.from({ length: MAX_FLOORS }, (_, i) => new THREE.Vector3(...floorHue(i))) },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
  };
}

/**
 * The building as three instanced draws: members, nodes and skin panels.
 * Assembly, connection flashes, pulses and the cursor field run in the
 * shaders; the CPU only tracks the moment each member locks so it can flash
 * in real time and throw a few particles.
 */
export function Structure({ site, skeleton, section, animate, force, onSelectFloor }: StructureProps) {
  const members = useRef<THREE.InstancedMesh>(null);
  const nodes = useRef<THREE.InstancedMesh>(null);
  const panels = useRef<THREE.InstancedMesh>(null);
  const completed = useRef(new Float32Array(MAX_FLOORS).fill(-1));
  const field = useRef({ prev: -1, vel: 0, shear: new THREE.Vector3(), shearVel: new THREE.Vector3(), tear: 0, right: new THREE.Vector3() });
  /** When the structure last lit up, so a quiet site can send its own pulse. */
  const idle = useRef(0);
  const floorCount = site.floors.length;

  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const octa = useMemo(() => new THREE.OctahedronGeometry(0.5, 0), []);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const geometries = useMemo(() => {
    const m = memberGeometry(skeleton.members, box);
    const n = memberGeometry(skeleton.nodes, octa);
    const p = plane.clone();
    p.setAttribute("aFloor", attr(skeleton.panels.floor, 1));
    p.setAttribute("aPerimeter", attr(skeleton.panels.perimeter, 2));
    p.setAttribute("aMaxSkin", attr(skeleton.panels.maxSkin, 1));
    p.setAttribute("aPlate", attr(skeleton.panels.plate, 1));
    return { m, n, p };
  }, [skeleton, box, octa, plane]);

  const uniforms = useMemo(() => {
    const shared = sharedUniforms();
    const accent = new THREE.Color(site.lamp.color);
    return {
      members: { ...shared, uBase: { value: BASE }, uNode: { value: 0 }, uForce: { value: force ? 1 : 0 } },
      nodes: { ...shared, uBase: { value: NODE_BASE }, uNode: { value: 1 }, uForce: { value: force ? 1 : 0 } },
      panels: {
        ...shared,
        uActive: { value: 0 },
        uXray: { value: 0 },
        uCompleted: { value: completed.current },
        uAccent: { value: new THREE.Vector3(accent.r, accent.g, accent.b) },
      },
    };
  }, [site.lamp.color, force]);

  const materials = useMemo(
    () => ({
      members: new THREE.ShaderMaterial({ vertexShader: memberVertex, fragmentShader: memberFragment, uniforms: uniforms.members, defines: memberDefines, transparent: true }),
      nodes: new THREE.ShaderMaterial({ vertexShader: memberVertex, fragmentShader: memberFragment, uniforms: uniforms.nodes, defines: memberDefines, transparent: true }),
      panels: new THREE.ShaderMaterial({ vertexShader: skinVertex, fragmentShader: skinFragment, uniforms: uniforms.panels, defines: skinDefines, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    }),
    [uniforms],
  );

  // Instance matrices come straight from the packed arrays.
  useEffect(() => {
    const set = (mesh: THREE.InstancedMesh | null, matrix: Float32Array) => {
      if (!mesh) return;
      (mesh.instanceMatrix.array as Float32Array).set(matrix);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    set(members.current, skeleton.members.matrix);
    set(nodes.current, skeleton.nodes.matrix);
    set(panels.current, skeleton.panels.matrix);
    completed.current.fill(-1);
  }, [skeleton]);

  useEffect(() => () => {
    geometries.m.dispose();
    geometries.n.dispose();
    geometries.p.dispose();
  }, [geometries]);

  /** Mark members that just locked (or came apart) and throw particles at the loud ones. */
  const lockPass = (packed: Packed, geometry: THREE.BufferGeometry, progress: Float32Array, now: number, burst: boolean) => {
    const lock = geometry.getAttribute("aLock") as THREE.InstancedBufferAttribute;
    const arr = lock.array as Float32Array;
    let changed = false;
    for (let i = 0; i < packed.count; i++) {
      const p = (progress[packed.floor[i]] - packed.start[i]) / packed.dur[i];
      const locked = p >= 1;
      if (locked && arr[i] < 0) {
        arr[i] = now;
        changed = true;
        if (burst && packed.loud[i] && animate) {
          const c = packed.centre;
          emitBurst(c[i * 3], c[i * 3 + 1], c[i * 3 + 2], packed.hue[i] === 1 ? "blue" : packed.hue[i] === 2 ? "white" : "amber", 6);
        }
      } else if (!locked && arr[i] >= 0) {
        arr[i] = -1;
        changed = true;
      }
    }
    if (changed) lock.needsUpdate = true;
  };

  useFrame(({ clock, camera }, delta) => {
    const now = clock.getElapsedTime();
    events.time = now;
    const s = section.current ?? 0;
    const dt = Math.min(delta, 1 / 30);

    // The field. Scroll velocity becomes a shear the stack lags behind and
    // springs back from; a hard scroll tears the skeleton loose; the wind
    // leans on it. Everything else reads these through the shaders.
    const fd = field.current;
    if (fd.prev < 0) fd.prev = s;
    const rawVel = (s - fd.prev) / Math.max(dt, 1e-3);
    fd.prev = s;
    fd.vel = THREE.MathUtils.damp(fd.vel, animate ? rawVel : 0, 8, dt);
    fd.right.setFromMatrixColumn(camera.matrixWorld, 0);
    const lag = THREE.MathUtils.clamp(-fd.vel * 0.62, -1.8, 1.8);
    const tx = fd.right.x * lag;
    const tz = fd.right.z * lag;
    const ty = THREE.MathUtils.clamp(-fd.vel * 0.22, -0.8, 0.8);
    const sv = fd.shearVel;
    const sh = fd.shear;
    sv.x += ((tx - sh.x) * 40 - sv.x * 5.5) * dt;
    sv.y += ((ty - sh.y) * 40 - sv.y * 5.5) * dt;
    sv.z += ((tz - sh.z) * 40 - sv.z * 5.5) * dt;
    sh.addScaledVector(sv, dt);
    const speed = Math.abs(fd.vel);
    const tearTarget = animate ? THREE.MathUtils.smoothstep(speed, 0.7, 2.8) : 0;
    fd.tear = THREE.MathUtils.damp(fd.tear, tearTarget, tearTarget > fd.tear ? 12 : 1.6, dt);
    const shared = uniforms.members;
    shared.uShear.value.copy(sh);
    const gust = animate ? windAt(now) * 0.3 : 0;
    shared.uWind.value.set(wind.dir[0] * gust, wind.dir[1] * gust);
    shared.uTear.value = fd.tear;
    shared.uHeight.value = site.totalHeight;
    shared.uLife.value = animate ? 1 : 0;
    // The scene tints toward the floor you are on, crossfading between floors.
    const lo = Math.max(0, Math.min(floorCount - 1, Math.floor(s)));
    const hi = Math.min(floorCount - 1, lo + 1);
    const mixT = THREE.MathUtils.clamp(s - lo, 0, 1);
    const a = floorHue(lo);
    const b = floorHue(hi);
    shared.uTint.value.set(a[0] + (b[0] - a[0]) * mixT, a[1] + (b[1] - a[1]) * mixT, a[2] + (b[2] - a[2]) * mixT);
    const progress = uniforms.members.uProgress.value;
    let top = -1;
    for (let i = 0; i <= floorCount && i < MAX_FLOORS; i++) {
      progress[i] = floorProgress(i, s);
      // A floor is complete once its diagonals are in: one pulse round the outline.
      const done = progress[i] >= 0.92;
      if (done && completed.current[i] < 0) {
        completed.current[i] = now;
        idle.current = now;
        if (i > 0 && animate) {
          const f = site.floors[i];
          if (f) emitPulse(f.offset[0], f.y, f.offset[1], floorHue(i));
        }
      } else if (!done && completed.current[i] >= 0) {
        completed.current[i] = -1;
      }
      if (done) top = i;
    }
    // Nothing happening for a while: the highest finished floor sends one
    // slow pulse down the stack, so the site never reads as switched off.
    if (animate && top > 0 && now - idle.current > IDLE_PULSE) {
      idle.current = now;
      const f = site.floors[top];
      if (f) emitPulse(f.offset[0], f.y, f.offset[1], floorHue(top));
    }
    // The uniform arrays are shared between the three materials.
    uniforms.members.uTime.value = now;
    uniforms.members.uCursor.value.set(cursor.x, cursor.y, cursor.z);
    uniforms.members.uCursorVel.value.set(cursor.vx, cursor.vy, cursor.vz);
    uniforms.members.uCursorOn.value = cursor.active;
    uniforms.members.uGlow.value = scene.glow;
    uniforms.panels.uActive.value = s;
    uniforms.panels.uXray.value = cursor.onBuilding * cursor.active;
    const pulses = uniforms.members.uPulses.value;
    const hues = uniforms.members.uPulseHue.value;
    for (let i = 0; i < MAX_PULSES; i++) {
      const p = events.pulses[i];
      if (p && now - p.t0 < 4) {
        pulses[i].set(p.x, p.y, p.z, p.t0);
        const h = Array.isArray(p.hue) ? p.hue : HUES[p.hue];
        hues[i].set(h[0], h[1], h[2]);
      } else {
        pulses[i].w = -1;
      }
    }
    lockPass(skeleton.members, geometries.m, progress, now, true);
    lockPass(skeleton.nodes, geometries.n, progress, now, false);
  });

  return (
    <group
      onClick={(e) => {
        const y = e.point.y;
        const index = Math.min(floorCount - 1, Math.max(0, Math.floor(y / (site.floors[1]?.y ?? 3.2))));
        e.stopPropagation();
        onSelectFloor?.(index);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <instancedMesh ref={members} key={`m${skeleton.members.count}`} args={[geometries.m, materials.members, skeleton.members.count]} frustumCulled={false} />
      <instancedMesh ref={nodes} key={`n${skeleton.nodes.count}`} args={[geometries.n, materials.nodes, skeleton.nodes.count]} frustumCulled={false} />
      <instancedMesh ref={panels} key={`p${skeleton.panels.count}`} args={[geometries.p, materials.panels, skeleton.panels.count]} frustumCulled={false} renderOrder={2} />
    </group>
  );
}
