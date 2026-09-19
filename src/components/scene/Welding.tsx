"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { COLUMN, weldLevel, weldSpots } from "@/lib/building";

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

  const sparkMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {},
        vertexShader: /* glsl */ `
          attribute float aShade;
          varying float vShade;
          void main() {
            vShade = aShade;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // Hold roughly constant on screen, smaller as it cools.
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
            // A spark cools as it falls: white hot, then orange, then out.
            vec3 hot = vec3(1.0, 0.96, 0.86);
            vec3 cool = vec3(1.0, 0.36, 0.06);
            vec3 col = mix(cool, hot, vShade * vShade);
            float a = (1.0 - r * 4.0) * vShade;
            gl_FragColor = vec4(col * (0.6 + vShade), a);
          }
        `,
      }),
    [],
  );

  const spots = useMemo(
    () => weldSpots(site).map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    [site],
  );

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

    // Spawn while burning.
    if (burning && spot) {
      const want = 3 + Math.floor(Math.random() * 4);
      let spawned = 0;
      for (let i = 0; i < SPARKS && spawned < want; i++) {
        const s = pool[i];
        if (s.life > 0) continue;
        s.max = 0.5 + Math.random() * 0.85;
        s.life = s.max;
        s.bounced = false;
        // Mostly sideways and down off the joint, a few thrown up.
        const a = Math.random() * Math.PI * 2;
        const speed = 1.4 + Math.random() * 3.4;
        s.vx = Math.cos(a) * speed;
        s.vz = Math.sin(a) * speed;
        s.vy = 1.6 + Math.random() * 2.6;
        positions[i * 3] = spot.x;
        positions[i * 3 + 1] = spot.y;
        positions[i * 3 + 2] = spot.z;
        spawned++;
      }
    }

    // Integrate.
    const slabBelow = spot ? spot.y - 0.42 : -999;
    for (let i = 0; i < SPARKS; i++) {
      const s = pool[i];
      if (s.life <= 0) {
        shades[i] = 0;
        continue;
      }
      s.life -= delta;
      if (s.life <= 0) {
        shades[i] = 0;
        continue;
      }
      s.vy += GRAVITY * delta;
      const o = i * 3;
      positions[o] += s.vx * delta;
      positions[o + 1] += s.vy * delta;
      positions[o + 2] += s.vz * delta;
      // One bounce off the slab it lands on, which is what makes the sparks
      // read as being in a place rather than falling through it.
      if (!s.bounced && positions[o + 1] < slabBelow && s.vy < 0) {
        positions[o + 1] = slabBelow;
        s.vy = -s.vy * 0.32;
        s.vx *= 0.55;
        s.vz *= 0.55;
        s.bounced = true;
      }
      shades[i] = Math.max(0, s.life / s.max);
    }

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
      {/* What makes it a light source rather than a sticker. */}
      <pointLight ref={light} color="#cfe0ff" intensity={0} distance={11} decay={2} />
    </group>
  );
}
