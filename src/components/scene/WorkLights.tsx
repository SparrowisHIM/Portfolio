"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { builtHeight } from "@/lib/construction";
import { box, post, type Instance } from "@/lib/geometry";
import { Instances } from "./Instances";
import { materials } from "./materials";

/**
 * Tower lights on the site boundary.
 *
 * Until now every glow in this scene came from nowhere — the lines simply
 * were bright. These are the first lights with a position: masts standing on
 * the ground, heads aimed at whatever floor is being built, a cone of lit
 * haze between the two and a pool of spill at the foot of each mast. They
 * follow the work up as the stack grows, so the building is always being
 * looked at by something.
 */

/** Three towers at different heights, so one is always above the work. */
const MASTS = [12.5, 8.4, 15.5];
/** The cone geometry runs from its apex down its own -Y. */
const DOWN = new THREE.Vector3(0, -1, 0);
/** Half-angle of the beam. */
const SPREAD = 0.105;

const coneVertex = /* glsl */ `
varying float vT;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  // Apex sits at the origin, base a unit down; vT runs 0 at the lamp to 1 at the throw.
  vT = clamp(-position.y, 0.0, 1.0);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const coneFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying float vT;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  // Brightest at the lamp, thinning down the throw.
  float a = pow(1.0 - vT, 2.5);
  // A shell only reads as a volume if it fades out at its own silhouette;
  // giving it a floor was what made it look like a sheet of brown paper.
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vWorld);
  a *= smoothstep(0.02, 0.5, max(dot(n, v), 0.0));
  // And it must not smear across the lens when the camera is inside it.
  a *= smoothstep(2.5, 13.0, distance(cameraPosition, vWorld));
  // Dust crossing the beam.
  a *= 0.86 + 0.14 * sin(uTime * 1.7 + vT * 9.0 + vWorld.y * 0.6);
  gl_FragColor = vec4(uColor, a * uIntensity);
}
`;

const poolVertex = /* glsl */ `
varying vec2 vXy;
void main() {
  vXy = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const poolFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uRadius;
varying vec2 vXy;
void main() {
  float d = length(vXy) / uRadius;
  float a = pow(max(0.0, 1.0 - d), 3.2) * uIntensity;
  gl_FragColor = vec4(uColor, a);
}
`;

export function WorkLights({ site, section, animate }: { site: Site; section: RefObject<number>; animate: boolean }) {
  const m = materials();
  const cones = useRef<THREE.Mesh[]>([]);
  const heads = useRef<THREE.Mesh[]>([]);
  const aim = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const level = useRef(0);

  // Three masts set round the open face, far enough out to rake across the
  // frame rather than stand in front of it.
  const placed = useMemo(() => {
    const reach = Math.max(site.floors[0].width, site.floors[0].depth) * 0.5 + 7.5;
    return [-1.55, 1.15, 2.85].map((offset) => {
      const a = site.viewAngle + offset;
      return [Math.sin(a) * reach, 0, Math.cos(a) * reach] as [number, number, number];
    });
  }, [site]);

  const structure = useMemo(() => {
    const tubes: Instance[] = [];
    placed.forEach(([x, , z], i) => {
      tubes.push(post([x, 0, z], MASTS[i], 0.075));
      tubes.push(box([x, 0.12, z], [0.9, 0.26, 0.9]));
      // A stay each side, so a fifteen metre pole reads as a tower.
      tubes.push(post([x + 0.55, 0, z], MASTS[i] * 0.42, 0.04));
      tubes.push(post([x - 0.55, 0, z], MASTS[i] * 0.42, 0.04));
    });
    return tubes;
  }, [placed]);

  const coneGeometry = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 22, 1, false);
    // Apex to the origin so the mesh can be aimed and stretched from the lamp.
    g.translate(0, -0.5, 0);
    return g;
  }, []);

  const beams = useMemo(
    () =>
      placed.map(() => {
        const uniforms = {
          uColor: { value: new THREE.Color(site.lamp.color).lerp(new THREE.Color("#ffffff"), 0.22) },
          uIntensity: { value: 0 },
          uTime: { value: 0 },
        };
        const material = new THREE.ShaderMaterial({
          vertexShader: coneVertex,
          fragmentShader: coneFragment,
          uniforms,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          fog: false,
        });
        return { uniforms, material };
      }),
    [placed, site.lamp.color],
  );

  const pools = useMemo(
    () =>
      placed.map(
        () =>
          new THREE.ShaderMaterial({
            vertexShader: poolVertex,
            fragmentShader: poolFragment,
            uniforms: {
              uColor: { value: new THREE.Color(site.lamp.color) },
              uIntensity: { value: 0.95 },
              uRadius: { value: 4.2 },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
          }),
      ),
    [placed, site.lamp.color],
  );

  useEffect(
    () => () => {
      for (const b of beams) b.material.dispose();
      for (const p of pools) p.dispose();
    },
    [beams, pools],
  );

  useFrame(({ clock }, delta) => {
    const now = clock.getElapsedTime();
    const s = section.current ?? 0;
    // The lamps look at whatever is being built, easing up with the stack.
    const wanted = builtHeight(site, s) + 1.2;
    level.current = animate ? THREE.MathUtils.damp(level.current, wanted, 3.5, Math.min(delta, 1 / 30)) : wanted;
    aim.current.set(0, level.current, 0);

    placed.forEach((p, i) => {
      const cone = cones.current[i];
      const u = beams[i].uniforms;
      if (!cone) return;
      const head = MASTS[i];
      dir.current.set(aim.current.x - p[0], aim.current.y - head, aim.current.z - p[2]);
      const length = Math.max(2, dir.current.length());
      dir.current.normalize();
      cone.position.set(p[0], head, p[2]);
      cone.quaternion.setFromUnitVectors(DOWN, dir.current);
      cone.scale.set(length * SPREAD, length, length * SPREAD);
      u.uTime.value = now;
      // A lamp flickers awake rather than snapping on.
      const warm = THREE.MathUtils.clamp(level.current / 3, 0, 1);
      u.uIntensity.value = 0.24 * warm * (0.92 + 0.08 * Math.sin(now * 1.3 + i * 2.1));

      const lamp = heads.current[i];
      if (lamp) {
        lamp.position.set(p[0], head, p[2]);
        lamp.quaternion.copy(cone.quaternion);
      }
    });

  });

  return (
    <group>
      <Instances items={structure} material={m.steelDark} />
      {placed.map((p, i) => (
        <group key={i}>
          <mesh
            ref={(mesh) => {
              if (mesh) cones.current[i] = mesh;
            }}
            geometry={coneGeometry}
            material={beams[i].material}
            renderOrder={1}
            frustumCulled={false}
          />
          <mesh
            ref={(mesh) => {
              if (mesh) heads.current[i] = mesh;
            }}
          >
            <boxGeometry args={[0.34, 0.2, 0.1]} />
            <meshStandardMaterial color="#1b1e26" emissive={site.lamp.color} emissiveIntensity={1.7} toneMapped={false} />
          </mesh>
          <mesh position={[p[0], 0.03, p[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1} material={pools[i]}>
            <circleGeometry args={[4.2, 40]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
