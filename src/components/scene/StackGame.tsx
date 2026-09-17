"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, SLAB_THICKNESS } from "@/lib/site-generator";
import { drop, game, snapshot, stepGame, subscribe, type Block } from "@/lib/stack-game";
import { ceilingTexture } from "@/lib/textures";
import { materials, palette } from "./materials";

type StackGameProps = {
  site: Site;
  animate: boolean;
};

const WALL = FLOOR_HEIGHT - SLAB_THICKNESS;

/** One stacked floor: slab, a lit glass box and a soffit. */
function Storey({ block, glass, ceiling, flash }: { block: Block; glass: THREE.Material; ceiling: THREE.Material; flash: number }) {
  const m = materials();
  const light = useRef<THREE.PointLight>(null);
  useFrame((_, delta) => {
    if (light.current) light.current.intensity = THREE.MathUtils.damp(light.current.intensity, 5 + flash * 30, 4, delta);
  });
  return (
    <group position={[block.x, block.y, block.z]}>
      <mesh position={[0, SLAB_THICKNESS / 2, 0]} material={m.concrete}>
        <boxGeometry args={[block.width, SLAB_THICKNESS, block.depth]} />
      </mesh>
      <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]} material={ceiling}>
        <planeGeometry args={[block.width - 0.1, block.depth - 0.1]} />
      </mesh>
      <mesh position={[0, SLAB_THICKNESS + WALL / 2, 0]} material={glass}>
        <boxGeometry args={[block.width - 0.06, WALL, block.depth - 0.06]} />
      </mesh>
      {/* Corner columns so the box reads as a frame. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (block.width - 0.4)) / 2, SLAB_THICKNESS + WALL / 2, (sz * (block.depth - 0.4)) / 2]} material={m.steel}>
            <boxGeometry args={[0.24, WALL, 0.24]} />
          </mesh>
        )),
      )}
      <pointLight ref={light} position={[0, FLOOR_HEIGHT * 0.6, 0]} color={palette.sodium} intensity={0} distance={12} decay={2} />
    </group>
  );
}

/**
 * The stacking game inside the site. Placed floors are React state; the
 * sliding slab and the falling offcuts are moved every frame.
 */
export function StackGame({ site, animate }: StackGameProps) {
  const m = materials();
  const version = useSyncExternalStore(subscribe, snapshot, snapshot);
  const moving = useRef<THREE.Group>(null);
  const hookLight = useRef<THREE.PointLight>(null);
  const debris = useRef<THREE.Group>(null);
  const domElement = useThree((s) => s.gl.domElement);

  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.glass,
        emissive: site.lamp.color,
        emissiveIntensity: 0.07,
        roughness: 0.12,
        metalness: 0.5,
        transparent: true,
        opacity: 0.42,
      }),
    [site.lamp.color],
  );
  const perfectGlass = useMemo(() => {
    const mat = glass.clone();
    mat.emissiveIntensity = 0.22;
    return mat;
  }, [glass]);
  const ceiling = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: ceilingTexture(site.lamp.color),
        emissiveMap: ceilingTexture(site.lamp.color),
        emissive: "#ffffff",
        emissiveIntensity: 1.2,
        roughness: 0.8,
      }),
    [site.lamp.color],
  );

  // Drop on click, tap, space or enter.
  useEffect(() => {
    if (!game.active) return;
    const onPointer = (e: PointerEvent) => {
      if (e.button === 0) drop();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        drop();
      }
    };
    domElement.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      domElement.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [domElement, version]);

  useFrame((_, delta) => {
    stepGame(Math.min(delta, 1 / 30));
    const mv = game.moving;
    if (moving.current) {
      moving.current.visible = !!mv && game.active;
      if (mv) {
        moving.current.position.set(mv.x, mv.y, mv.z);
        moving.current.scale.set(mv.width, 1, mv.depth);
      }
      if (hookLight.current) {
        hookLight.current.visible = !!mv && game.active;
        if (mv) hookLight.current.position.set(mv.x, mv.y + 1.4, mv.z);
        hookLight.current.intensity = mv ? 24 : 0;
      }
    }
    if (debris.current) {
      const children = debris.current.children;
      for (let i = 0; i < children.length; i++) {
        const d = game.debris[i];
        const mesh = children[i];
        mesh.visible = !!d;
        if (!d) continue;
        mesh.position.set(d.x, d.y, d.z);
        mesh.scale.set(d.width, 1, d.depth);
        mesh.rotation.z = (4 - d.life) * d.spin * (d.vx !== 0 ? 1 : 0);
        mesh.rotation.x = (4 - d.life) * d.spin * (d.vz !== 0 ? -1 : 0);
      }
    }
  });

  if (!game.active) return null;
  const blocks = game.blocks.slice(1);
  const recentFlash = animate && game.time - game.lastDrop < 0.6 ? 1 - (game.time - game.lastDrop) / 0.6 : 0;

  return (
    <group>
      {blocks.map((block, i) => (
        <Storey
          key={i}
          block={block}
          glass={block.perfect ? perfectGlass : glass}
          ceiling={ceiling}
          flash={i === blocks.length - 1 && game.lastPerfect ? recentFlash : 0}
        />
      ))}
      {/* The slab on the hook. */}
      <group ref={moving}>
        <mesh position={[0, SLAB_THICKNESS / 2, 0]} material={m.concrete}>
          <boxGeometry args={[1, SLAB_THICKNESS, 1]} />
        </mesh>
        <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.deck}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      </group>
      {/* A work light rides on the spreader so the slab reads against the sky. */}
      <pointLight ref={hookLight} color={site.lamp.color} intensity={0} distance={9} decay={2} />
      {/* Offcuts, at most a handful in the air at once. */}
      <group ref={debris}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[0, SLAB_THICKNESS / 2, 0]} material={m.concreteDark} visible={false}>
            <boxGeometry args={[1, SLAB_THICKNESS, 1]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
