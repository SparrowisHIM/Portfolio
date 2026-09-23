"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { COLUMN, slabTop, weldLevel, weldSpots } from "@/lib/building";
import { PLACED_AT, floorProgress } from "@/lib/construction";

/**
 * Welding at the connections.
 *
 * The single most watchable thing on a real site is the moment two pieces of
 * steel become one, and it is also exactly what the scroll is doing — so the
 * arc goes where the frame is currently being joined, at the top of a column
 * on the level being built.
 *
 * What sells it is not the bright dot, it is everything around it:
 *
 *  - the arc flickers rather than burning steady, in bursts with gaps, the
 *    way a stick weld actually runs;
 *  - it throws real light on the concrete near it, so the flash has a source
 *    instead of floating;
 *  - sparks fall, bounce once off the slab below and die;
 *  - the joint keeps glowing after the arc stops, cooling white to orange to
 *    nothing over a couple of seconds.
 *
 * Everything is pooled: one Points buffer for the sparks, one light, one
 * flash quad. Nothing is allocated per frame.
 */

const SPARKS = 200;
const GRAVITY = -13;
/** How long the connections at a newly landed plate are burned off for. */
const FIXING = 2.6;
/** Seconds of arc, then seconds of pause. Re-rolled each cycle. */
const BURST = [0.6, 1.5] as const;
const GAP = [0.35, 1.1] as const;

type Spark = {
  life: number;
  max: number;
  vx: number;
  vy: number;
  vz: number;
  bounced: boolean;
};

const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** Wake one dead spark at (x, y, z). Returns false when the pool is full. */
function emitSpark(pool: Spark[], positions: Float32Array, x: number, y: number, z: number, life: [number, number], speed: [number, number], lift: [number, number]) {
  const i = pool.findIndex((sp) => sp.life <= 0);
  if (i < 0) return false;
  const sp = pool[i];
  sp.max = sp.life = between(...life);
  sp.bounced = false;
  const a = Math.random() * Math.PI * 2;
  const v = between(...speed);
  sp.vx = Math.cos(a) * v;
  sp.vz = Math.sin(a) * v;
  sp.vy = between(...lift);
  positions.set([x, y, z], i * 3);
  return true;
}

/** Fall, bounce once off the slab below, cool and die. */
function stepSparks(pool: Spark[], positions: Float32Array, shades: Float32Array, delta: number, floor: number) {
  pool.forEach((sp, i) => {
    if (sp.life > 0) sp.life -= delta;
    if (sp.life <= 0) {
      shades[i] = 0;
      return;
    }
    sp.vy += GRAVITY * delta;
    const o = i * 3;
    positions[o] += sp.vx * delta;
    positions[o + 1] += sp.vy * delta;
    positions[o + 2] += sp.vz * delta;
    if (!sp.bounced && positions[o + 1] < floor && sp.vy < 0) {
      positions[o + 1] = floor;
      sp.vy *= -0.32;
      sp.vx *= 0.55;
      sp.vz *= 0.55;
      sp.bounced = true;
    }
    shades[i] = sp.life / sp.max;
  });
}

/** Round additive points that shrink and cool from white-hot to orange. */
function createSparkMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aShade;
      varying float vShade;
      void main() {
        vShade = aShade;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (3.4 * aShade + 0.8) * (34.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vShade;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d, d);
        if (r > 0.25) discard;
        vec3 col = mix(vec3(1.0, 0.36, 0.06), vec3(1.0, 0.96, 0.86), vShade * vShade);
        gl_FragColor = vec4(col * (0.6 + vShade), (1.0 - r * 4.0) * vShade);
      }
    `,
  });
}

export function Welding({
  site,
  build,
  animate,
}: {
  site: Site;
  build: RefObject<number>;
  animate: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const flash = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const glow = useRef<THREE.Mesh>(null);

  const positions = useMemo(() => new Float32Array(SPARKS * 3), []);
  const shades = useMemo(() => new Float32Array(SPARKS), []);
  const pool = useMemo<Spark[]>(
    () => Array.from({ length: SPARKS }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, bounced: false })),
    [],
  );

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aShade", new THREE.BufferAttribute(shades, 1));
    return g;
  }, [positions, shades]);

  const sparkMaterial = useMemo(() => createSparkMaterial(), []);

  const spots = useMemo(
    () => weldSpots(site).map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    [site],
  );

  const corners = useRef<(THREE.Mesh | null)[]>([]);
  /** Clock time each plate landed, or -1. Re-arms when you scroll back up. */
  const placed = useRef<number[]>([]);
  const arc = useRef({ on: false, until: 0.6, level: -1, heat: 0, flicker: 1 });
  const here = useRef(new THREE.Vector3());
  const clock = useRef(0);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    if (!animate) return;
    clock.current += delta;
    const now = clock.current;
    const f = build.current ?? 0;
    const state = arc.current;

    const level = weldLevel(site, f);

    if (level !== state.level) {
      state.level = level;
      state.on = false;
      state.until = now + 0.2;
    }

    const spot = level >= 0 ? spots[Math.min(level, spots.length - 1)] : null;
    if (spot) here.current.copy(spot);

    // Arc on/off, in bursts.
    if (spot && now >= state.until) {
      state.on = !state.on;
      const [lo, hi] = state.on ? BURST : GAP;
      state.until = now + lo + Math.random() * (hi - lo);
    }
    const burning = !!spot && state.on;

    // Flicker: an arc is never steady, and the irregularity is most of why
    // it reads as a weld rather than as a lamp.
    state.flicker = burning ? 0.45 + Math.random() * 0.55 : 0;
    // The joint keeps its heat after the arc stops.
    state.heat = burning ? 1 : Math.max(0, state.heat - delta * 0.55);

    if (light.current) {
      // Never toggle `visible` on a light. three bakes the count of active
      // lights into every shader program, so flipping one on and off makes
      // the whole scene recompile — and an arc that flickers several times a
      // second recompiles it several times a second. That is what took the
      // site to one frame a second. Intensity zero costs a few instructions;
      // a rebuild costs everything.
      if (spot) light.current.position.copy(spot);
      light.current.intensity = 55 * state.flicker + 6 * state.heat * state.heat;
    }
    if (flash.current) {
      flash.current.visible = state.flicker > 0;
      if (spot) flash.current.position.copy(spot);
      const s = 0.16 + 0.1 * state.flicker;
      flash.current.scale.setScalar(s);
    }
    if (glow.current) {
      glow.current.visible = state.heat > 0.02;
      if (spot) glow.current.position.copy(spot);
      glow.current.scale.setScalar(COLUMN * (0.5 + 0.25 * state.heat));
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = state.heat * 0.8;
      m.color.setRGB(1, 0.28 + 0.6 * state.heat * state.heat, 0.08 + 0.6 * Math.pow(state.heat, 4));
    }

    // ---- fixing the plate down ----------------------------------------
    // A plate is not placed when it is released, it is placed when it is
    // welded off. The four corners burning for a couple of seconds is what
    // makes the drop land rather than just stop.
    const levels = site.floors.length;
    let fixing: { y: number; hw: number; hd: number; age: number } | null = null;
    for (let i = 0; i <= levels; i++) {
      const p = floorProgress(i, f);
      if (p >= PLACED_AT) {
        if ((placed.current[i] ?? -1) < 0) placed.current[i] = now;
      } else {
        placed.current[i] = -1;
      }
      const at = placed.current[i] ?? -1;
      if (at >= 0 && now - at < FIXING) {
        const floor = site.floors[Math.min(i, levels - 1)];
        fixing = {
          y: slabTop(i),
          hw: floor.width / 2 - 0.55,
          hd: floor.depth / 2 - 0.55,
          age: now - at,
        };
      }
    }

    const fade = fixing ? 1 - fixing.age / FIXING : 0;
    for (let c = 0; c < 4; c++) {
      const mesh = corners.current[c];
      if (!mesh) continue;
      if (!fixing) {
        mesh.visible = false;
        continue;
      }
      const sx = c === 0 || c === 3 ? -1 : 1;
      const sz = c < 2 ? -1 : 1;
      const cx = sx * fixing.hw;
      const cz = sz * fixing.hd;
      // Each corner runs on its own stutter, so they do not blink together.
      const beat = 0.5 + 0.5 * Math.sin(now * (23 + c * 5) + c * 2.1);
      const on = beat > 0.35 ? beat : 0;
      mesh.visible = on > 0 && fade > 0;
      mesh.position.set(cx, fixing.y + 0.06, cz);
      mesh.scale.setScalar(0.11 * on * fade + 0.03);

      // Sparks off the corner being burned.
      if (on > 0.5 && fade > 0) {
        for (let n = 0; n < 2; n++) emitSpark(pool, positions, cx, fixing.y + 0.06, cz, [0.32, 0.82], [1.1, 3.7], [1.0, 3.0]);
      }
    }
    if (fixing && light.current) {
      // Lift the arc lamp a little while the corners burn, so the plate is
      // lit by its own fixing rather than by nothing.
      light.current.intensity += 14 * fade;
    }

    // Spawn while burning: mostly sideways and down off the joint, a few thrown up.
    if (burning && spot) {
      const want = 3 + Math.floor(Math.random() * 4);
      for (let n = 0; n < want; n++) {
        if (!emitSpark(pool, positions, spot.x, spot.y, spot.z, [0.5, 1.35], [1.4, 4.8], [1.6, 4.2])) break;
      }
    }

    stepSparks(pool, positions, shades, delta, fixing ? fixing.y : spot ? spot.y - 0.42 : -999);

    if (points.current) {
      const g = points.current.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.aShade.needsUpdate = true;
    }
  });

  return (
    <group>
      <points ref={points} geometry={geometry} material={sparkMaterial} frustumCulled={false} />
      {/* The arc itself: small, and far brighter than anything else on site. */}
      <mesh ref={flash} visible={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#dceaff" toneMapped={false} />
      </mesh>
      {/* The joint, still cooling after the arc stops. */}
      <mesh ref={glow} visible={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#ff7a20" toneMapped={false} transparent opacity={0} />
      </mesh>
      {/* The four connections being burned off as a plate lands. */}
      {[0, 1, 2, 3].map((c) => (
        <mesh
          key={c}
          ref={(mesh) => {
            corners.current[c] = mesh;
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#e6f0ff" toneMapped={false} />
        </mesh>
      ))}
      {/* What makes it a light source rather than a sticker. */}
      <pointLight ref={light} color="#cfe0ff" intensity={0} distance={11} decay={2} />
    </group>
  );
}
