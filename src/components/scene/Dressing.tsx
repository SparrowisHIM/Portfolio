"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Side, Site } from "@/lib/site-generator";
import { SIDE_ANGLE, onSide } from "@/lib/site-generator";
import { box, chain, hSection, post, strut, type Instance, type Vec3 } from "@/lib/geometry";
import { bannerTexture, fenceTexture } from "@/lib/textures";
import { Cloth } from "./Cloth";
import { Instances } from "./Instances";
import { materials, palette } from "./materials";

type DressingProps = {
  site: Site;
  /** Lines printed on the hoarding banner. */
  banner: string[];
  animate: boolean;
  /** Extra lights on the cabin and street. Off on small screens. */
  lights: boolean;
};

const CONE = new THREE.ConeGeometry(0.19, 0.58, 10);

/**
 * Everything on site that is not the tower or the crane: the hoarding with a
 * printed banner, the site cabin, the generator, a skip, steel laydown,
 * pallets, cones, puddles and the street lights outside the fence.
 */
export function Dressing({ site, banner, animate, lights }: DressingProps) {
  const m = materials();
  const { hoarding } = site;

  const fence = useMemo(() => {
    const panels: Instance[] = [];
    const posts: Instance[] = [];
    const rails: Instance[] = [];
    const gate: Instance[] = [];
    for (const side of ["+x", "-x", "+z", "-z"] as Side[]) {
      const horizontal = side === "+z" || side === "-z";
      const halfAlong = horizontal ? hoarding.halfWidth : hoarding.halfDepth;
      const out = horizontal ? hoarding.halfDepth : hoarding.halfWidth;
      const count = Math.ceil((halfAlong * 2) / hoarding.panel);
      const width = (halfAlong * 2) / count;
      const angle = SIDE_ANGLE[side];
      const gateHere = side === hoarding.gateSide;
      for (let i = 0; i < count; i++) {
        const a = -halfAlong + (i + 0.5) * width;
        const isGate = gateHere && Math.abs(a) < width;
        const p = onSide(side, a, out, hoarding.height / 2);
        if (isGate) {
          gate.push({ position: p, scale: [width - 0.1, hoarding.height - 0.15, 0.03], rotationY: angle + (a < 0 ? 0.35 : -0.35) });
          continue;
        }
        panels.push({ position: p, scale: [width, hoarding.height, 0.05], rotationY: angle });
        posts.push(post(onSide(side, a - width / 2, out + 0.05, 0), hoarding.height + 0.15, 0.08));
      }
      rails.push(strut(onSide(side, -halfAlong, out + 0.04, hoarding.height + 0.05), onSide(side, halfAlong, out + 0.04, hoarding.height + 0.05), 0.06));
      rails.push(strut(onSide(side, -halfAlong, out + 0.04, 0.35), onSide(side, halfAlong, out + 0.04, 0.35), 0.05));
    }
    return { panels, posts, rails, gate };
  }, [hoarding]);

  const fenceMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: fenceTexture(), transparent: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, alphaTest: 0.3 }),
    [],
  );

  const bannerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: bannerTexture(banner, palette.safety),
        side: THREE.DoubleSide,
        roughness: 0.85,
      }),
    [banner],
  );
  const bannerSheet = useMemo(() => {
    const side = hoarding.bannerSide;
    const horizontal = side === "+z" || side === "-z";
    const out = (horizontal ? hoarding.halfDepth : hoarding.halfWidth) + 0.09;
    const width = hoarding.panel * 3.2;
    const along = hoarding.bannerAlong;
    const a = onSide(side, along - width / 2, out, hoarding.height - 0.12);
    const b = onSide(side, along + width / 2, out, hoarding.height - 0.12);
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    return {
      origin: a,
      u: [(b[0] - a[0]) / len, 0, (b[2] - a[2]) / len] as Vec3,
      v: [0, -1, 0] as Vec3,
      width,
      height: width * 0.5 * 0.5,
      pin: { top: true, every: 2 },
    };
  }, [hoarding]);

  const cabinParts = useMemo(() => {
    const { position, rotationY } = site.cabin;
    const steps: Instance[] = [
      box([0, 0.12, 1.6], [1.0, 0.24, 0.5], 0),
      box([0, 0.3, 1.35], [1.0, 0.12, 0.3], 0),
    ];
    const frame: Instance[] = [
      box([0, 1.5, 0], [6.2, 0.1, 2.7]),
      box([0, 0.2, 0], [6.1, 0.12, 2.6]),
      ...[-2.95, 2.95].map((x) => box([x, 1.28, 0], [0.08, 2.4, 2.6])),
      box([2.6, 1.85, -1.4], [0.8, 0.5, 0.35]),
    ];
    return { position, rotationY, steps, frame };
  }, [site.cabin]);

  const cable = useMemo(() => {
    const g = site.generator.position;
    const c = site.crane.position;
    const mid: Vec3 = [(g[0] + c[0]) / 2 + 1.2, 0.04, (g[2] + c[2]) / 2 - 0.8];
    return chain([[g[0], 0.4, g[2]], [g[0] + 0.6, 0.05, g[2] + 0.4], mid, [c[0] + 1.0, 0.05, c[2] + 1.2], [c[0] + 0.9, 0.6, c[2] + 0.9]], 0.045);
  }, [site.generator, site.crane]);

  const laydown = useMemo(() => {
    const rods: Instance[] = [];
    const bearers: Instance[] = [];
    const beams: Instance[] = [];
    for (let i = 0; i < 14; i++) {
      const row = Math.floor(i / 7);
      const col = i % 7;
      rods.push(box([-0.36 + col * 0.12 + (row % 2) * 0.06, 0.28 + row * 0.11, 0], [0.05, 0.05, 6]));
    }
    for (const z of [-2.2, 2.2]) bearers.push(box([0, 0.12, z], [1.1, 0.24, 0.24]));
    for (let i = 0; i < 4; i++) {
      beams.push(...hSection([-1.4 + i * 0.5, 0.45, -3], [-1.4 + i * 0.5, 0.45, 3], 0.42, 0.2, 0.035, [0, 1, 0]));
    }
    for (const z of [-2.4, 2.4]) bearers.push(box([-0.65, 0.12, z], [2.4, 0.24, 0.24]));
    return { rods, bearers, beams };
  }, []);

  const cones = useMemo<Instance[]>(
    () => site.cones.map((c) => ({ position: [c[0], 0.29, c[2]] as Vec3, scale: [1, 1, 1] as Vec3 })),
    [site.cones],
  );
  const coneBases = useMemo<Instance[]>(
    () => site.cones.map((c) => box([c[0], 0.02, c[2]], [0.4, 0.04, 0.4])),
    [site.cones],
  );
  const coneBands = useMemo<Instance[]>(
    () => site.cones.map((c) => ({ position: [c[0], 0.36, c[2]] as Vec3, scale: [0.72, 0.16, 0.72] as Vec3 })),
    [site.cones],
  );

  const puddle = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0a1524", metalness: 0.95, roughness: 0.1, transparent: true, opacity: 0.85 }),
    [],
  );

  const streetPoles = useMemo(() => {
    const items: Instance[] = [];
    for (const p of site.streetLights) {
      items.push(post(p, 8, 0.14));
      items.push(strut([p[0], 8, p[2]], [p[0], 8.2, p[2]], 0.1));
    }
    return items;
  }, [site.streetLights]);

  const toSite = (p: Vec3) => Math.atan2(-p[0], -p[2]);

  return (
    <group>
      {/* Hoarding. */}
      <Instances items={fence.panels} material={m.hoarding} />
      <Instances items={fence.posts} material={m.steelDark} />
      <Instances items={fence.rails} material={m.galvanised} />
      <Instances items={fence.gate} material={fenceMaterial} />
      <Cloth
        origin={bannerSheet.origin}
        u={bannerSheet.u}
        v={bannerSheet.v}
        width={bannerSheet.width}
        height={bannerSheet.height}
        nx={30}
        ny={9}
        pin={bannerSheet.pin}
        material={bannerMaterial}
        windScale={1.2}
        gravity={3}
        animate={animate}
      />

      {/* Site cabin. */}
      <group position={cabinParts.position} rotation={[0, cabinParts.rotationY, 0]}>
        <mesh position={[0, 1.3, 0]} material={m.cabin}>
          <boxGeometry args={[6, 2.4, 2.5]} />
        </mesh>
        <Instances items={cabinParts.frame} material={m.steelDark} />
        <Instances items={cabinParts.steps} material={m.galvanised} />
        {[-1.9, -0.6, 1.4].map((x) => (
          <mesh key={x} position={[x, 1.45, 1.26]}>
            <planeGeometry args={[0.9, 0.8]} />
            <meshStandardMaterial color="#fff2d6" emissive="#ffe0a8" emissiveIntensity={1.6} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0.5, 1.15, 1.26]}>
          <planeGeometry args={[0.8, 1.9]} />
          <meshStandardMaterial color="#26303c" roughness={0.9} />
        </mesh>
        <mesh position={[0.5, 2.28, 1.35]}>
          <boxGeometry args={[0.3, 0.1, 0.16]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffe8c0" emissiveIntensity={3} toneMapped={false} />
        </mesh>
        {lights && <pointLight position={[0.5, 2.1, 1.9]} color="#ffe0a8" intensity={14} distance={9} decay={2} />}
      </group>

      {/* Generator and its cable to the crane. */}
      <group position={site.generator.position} rotation={[0, site.generator.rotationY, 0]}>
        <mesh position={[0, 0.65, 0]} material={m.crane}>
          <boxGeometry args={[1.9, 1.25, 0.95]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} material={m.steelDark}>
          <boxGeometry args={[2.1, 0.12, 1.1]} />
        </mesh>
        <mesh position={[0.6, 1.5, -0.2]} material={m.steelDark}>
          <cylinderGeometry args={[0.06, 0.06, 0.6, 8]} />
        </mesh>
        <mesh position={[-0.6, 0.85, 0.48]}>
          <boxGeometry args={[0.5, 0.4, 0.03]} />
          <meshStandardMaterial color="#1a2028" roughness={0.6} />
        </mesh>
        <mesh position={[-0.75, 0.95, 0.5]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#3ddc84" emissive="#3ddc84" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </group>
      <Instances items={cable} material={m.rubber} />

      {/* Skip with hazard ends, half full of rubble. */}
      <group position={site.skip.position} rotation={[0, site.skip.rotationY, 0]}>
        <mesh position={[0, 0.7, 0]} material={m.crane}>
          <boxGeometry args={[3.2, 1.3, 1.7]} />
        </mesh>
        {[-1.61, 1.61].map((x) => (
          <mesh key={x} position={[x, 0.7, 0]} rotation={[0, Math.PI / 2, 0]} material={m.hazard}>
            <planeGeometry args={[1.7, 1.3]} />
          </mesh>
        ))}
        <mesh position={[0, 1.3, 0]} material={m.concreteDark}>
          <boxGeometry args={[2.9, 0.2, 1.4]} />
        </mesh>
        <mesh position={[0.5, 1.45, 0.2]} rotation={[0.3, 0.5, 0.2]} material={m.plank}>
          <boxGeometry args={[1.2, 0.1, 0.3]} />
        </mesh>
        <mesh position={[-0.6, 1.5, -0.3]} rotation={[0.2, -0.4, 0.5]} material={m.concrete}>
          <boxGeometry args={[0.6, 0.3, 0.5]} />
        </mesh>
      </group>

      {/* Steel laydown: rebar bundle and a few beams on bearers. */}
      <group position={site.rebar.position} rotation={[0, site.rebar.rotationY, 0]}>
        <Instances items={laydown.rods} material={m.rebar} />
        <Instances items={laydown.bearers} material={m.plank} />
        <Instances items={laydown.beams} material={m.steel} />
      </group>

      {/* Pallets of blocks. */}
      {site.pallets.map((p, i) => (
        <group key={i} position={p.position} rotation={[0, p.rotationY, 0]}>
          <mesh position={[0, 0.07, 0]} material={m.plank}>
            <boxGeometry args={[1.2, 0.14, 1.0]} />
          </mesh>
          <mesh position={[0, 0.6, 0]} material={m.concreteDark}>
            <boxGeometry args={[1.1, 0.9, 0.9]} />
          </mesh>
        </group>
      ))}

      {/* Cones. */}
      <Instances items={cones} material={m.safety} geometry={CONE} />
      <Instances items={coneBases} material={m.rubber} />
      <Instances items={coneBands} material={m.reflective} geometry={CONE} />

      {/* Puddles catching the lights. */}
      {site.puddles.map((p, i) => (
        <mesh key={i} position={p.position} rotation={[-Math.PI / 2, 0, 0]} material={puddle}>
          <circleGeometry args={[p.radius, 24]} />
        </mesh>
      ))}

      {/* Street lights outside the hoarding: cool LED against the warm site. */}
      <Instances items={streetPoles} material={m.galvanised} />
      {site.streetLights.map((p, i) => {
        const angle = toSite(p);
        return (
          <group key={i} position={[p[0], 8, p[2]]} rotation={[0, angle, 0]}>
            <mesh position={[0, 0.1, 1.0]} material={m.steelDark}>
              <boxGeometry args={[0.1, 0.1, 2.0]} />
            </mesh>
            <mesh position={[0, 0.02, 2.0]}>
              <boxGeometry args={[0.35, 0.12, 0.7]} />
              <meshStandardMaterial color="#e6f0ff" emissive="#d7e6ff" emissiveIntensity={3} toneMapped={false} />
            </mesh>
            {lights && (
              <spotLight position={[0, -0.2, 2.0]} target-position={[0, -8, 2.0]} color="#cfe0ff" intensity={90} angle={0.75} penumbra={0.7} distance={20} decay={2} />
            )}
          </group>
        );
      })}
    </group>
  );
}
