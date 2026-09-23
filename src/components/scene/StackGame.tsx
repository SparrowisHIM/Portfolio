"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { blockPose, drop, game, GAME_SLAB_HEIGHT, landingTarget, movingPose, snapshot, stepGame, subscribe, towerPose, type Block } from "@/lib/stack-game";
import { floorParts, type Finish, type FloorPart } from "@/lib/game-floor";
import { gameWindowTexture } from "@/lib/game-window-texture";
import { boardConcreteTexture, siteDeckTexture } from "@/lib/textures";
import { hover } from "@/lib/hover";

const VISIBLE_FLOORS = 32;
const CAPACITY = 2048;
const SPARKS = 24;
const FINISHES: Finish[] = ["concrete", "steel", "window", "light", "interior"];
const emptyCounts = (): Record<Finish, number> => ({ concrete: 0, steel: 0, window: 0, light: 0, interior: 0 });
type Meshes = Partial<Record<Finish, THREE.InstancedMesh>>;

type StackGameProps = { site: Site; animate: boolean };

// Scratch objects, reused every frame.
const scratch = new THREE.Object3D();
const color = new THREE.Color();
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function setBox(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, w: number, h: number, d: number) {
  scratch.position.set(x, y, z);
  scratch.rotation.set(0, 0, 0);
  scratch.scale.set(w, h, d);
  scratch.updateMatrix();
  mesh.setMatrixAt(index, scratch.matrix);
}

/** A thin box from `from` to `to`, for slings and hoist rope. */
function setStrut(mesh: THREE.InstancedMesh, index: number, size: number, tint: string) {
  scratch.position.copy(from).add(to).multiplyScalar(0.5);
  scratch.scale.set(size, from.distanceTo(to), size);
  scratch.quaternion.setFromUnitVectors(UP, to.sub(from).normalize());
  scratch.updateMatrix();
  mesh.setMatrixAt(index, scratch.matrix);
  mesh.setColorAt(index, color.set(tint));
}

/** Four slings, a spreader, a hook block and the hoist rope, travelling with the swinging floor. */
function updateRig(rig: THREE.InstancedMesh) {
  const swinging = game.moving && game.phase === "swinging" ? game.moving : null;
  rig.count = swinging ? 7 : 0;
  if (!swinging) return;
  const pose = movingPose()!;
  const c = Math.cos(pose.rotationZ);
  const s = Math.sin(pose.rotationZ);
  const y = pose.y + GAME_SLAB_HEIGHT * c;
  const x = pose.x - GAME_SLAB_HEIGHT * s;
  const { width, depth, z } = swinging;
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1;
    const sz = i < 2 ? 1 : -1;
    from.set(x + sx * width * 0.38 * c, y + sx * width * 0.38 * s + 0.04, z + sz * depth * 0.38);
    to.set(x + sx * width * 0.16, y + 1.05, z);
    setStrut(rig, i, 0.025, "#627585");
  }
  setBox(rig, 4, x, y + 1.09, z, Math.max(0.1, width * 0.44), 0.11, 0.13);
  rig.setColorAt(4, color.set("#ce9140"));
  setBox(rig, 5, x, y + 1.25, z, 0.13, 0.24, 0.13);
  rig.setColorAt(5, color.set("#a3b3bf"));
  from.set(x, y + 1.37, z);
  to.set(...game.hook);
  setStrut(rig, 6, 0.026, "#5d6c79");
  rig.instanceMatrix.needsUpdate = true;
  if (rig.instanceColor) rig.instanceColor.needsUpdate = true;
}

/** Welding sparks thrown off both edges of the floor that just landed. */
function updateSparks(sparks: THREE.InstancedMesh, top: Block, age: number, on: boolean) {
  const placed = blockPose(top);
  sparks.count = on ? SPARKS : 0;
  for (let i = 0; i < sparks.count; i++) {
    const theta = i * 2.39996;
    const velocity = 1.1 + (i % 5) * 0.28;
    setBox(sparks, i,
      placed.x + (i % 2 ? 1 : -1) * top.width / 2 + Math.cos(theta) * age * velocity,
      placed.y + 0.16 + age * (1.5 + i % 3) - 6 * age * age,
      placed.z + (i % 4 < 2 ? 1 : -1) * top.depth / 2 + Math.sin(theta) * age * velocity,
      0.025, 0.055 * (1 - age), 0.025);
  }
  sparks.instanceMatrix.needsUpdate = true;
}

/** While a shift is on, the canvas takes focus and the drop input: click, tap, Space or Enter. */
function useShiftControls(active: boolean, element: HTMLCanvasElement) {
  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousTabIndex = element.getAttribute("tabindex");
    const { touchAction, cursor } = element.style;
    element.tabIndex = 0;
    element.style.touchAction = "none";
    element.style.cursor = "crosshair";
    element.setAttribute("aria-label", "Night Shift. Press Space to release the floor. Centre your landings to steady the tower. Escape to leave.");
    element.focus({ preventScroll: true });
    const onPointer = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      element.focus({ preventScroll: true });
      drop();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      if (event.target instanceof HTMLElement && event.target.closest("button, a, input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      if (!event.repeat) drop();
    };
    element.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      element.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      if (previousTabIndex === null) element.removeAttribute("tabindex");
      else element.setAttribute("tabindex", previousTabIndex);
      element.removeAttribute("aria-label");
      Object.assign(element.style, { touchAction, cursor });
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [active, element]);
}

function FloorBatch({ meshes, concrete, windows, capacity }: {
  meshes: { current: Meshes }; concrete: THREE.Texture; windows: THREE.Texture; capacity: number;
}) {
  return FINISHES.map((finish) => (
    <instancedMesh key={finish}
      ref={(mesh) => { if (mesh) meshes.current[finish] = mesh; else delete meshes.current[finish]; }}
      args={[undefined, undefined, capacity]} frustumCulled={false}
      castShadow={finish === "concrete"} receiveShadow={finish !== "light"}>
      <boxGeometry />
      {finish === "concrete" && <meshStandardMaterial map={concrete} roughness={0.78} metalness={0.05} />}
      {finish === "steel" && <meshStandardMaterial color="#23333f" roughness={0.38} metalness={0.75} />}
      {finish === "window" && <meshStandardMaterial map={windows} emissiveMap={windows} emissive="#ead8b3" emissiveIntensity={0.22} roughness={0.27} metalness={0.28} envMapIntensity={0.55} />}
      {finish === "light" && <meshBasicMaterial toneMapped={false} />}
      {finish === "interior" && <meshStandardMaterial roughness={0.95} />}
    </instancedMesh>
  ));
}

/** Architecture stays batched; the engine's rigid tower transform supplies the actual lean. */
export function StackGame({ site, animate }: StackGameProps) {
  const version = useSyncExternalStore(subscribe, snapshot, snapshot);
  const active = game.active;
  const gl = useThree((state) => state.gl);
  const meshes = useRef<Meshes>({});
  const airborne = useRef<Meshes>({});
  const tower = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const rig = useRef<THREE.InstancedMesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const illumination = useRef<THREE.Group>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const keyTarget = useMemo(() => new THREE.Object3D(), []);
  const parent = useMemo(() => new THREE.Object3D(), []);
  const world = useMemo(() => new THREE.Matrix4(), []);
  const concrete = useMemo(() => boardConcreteTexture(site.seed), [site.seed]);
  const deck = useMemo(() => siteDeckTexture(site.seed), [site.seed]);
  const windowMap = useMemo(() => gameWindowTexture(), []);
  const geometry = useRef(new WeakMap<Block, FloorPart[]>());
  const staticBatch = useRef({ version: -1, counts: emptyCounts() });

  useEffect(() => () => windowMap.dispose(), [windowMap]);

  useShiftControls(active, gl.domElement);

  useEffect(() => {
    if (game.active && game.score === 0 && !game.over) gl.domElement.focus({ preventScroll: true });
  }, [version, gl]);

  useFrame((_, delta) => {
    if (!game.active || FINISHES.some((finish) => !meshes.current[finish] || !airborne.current[finish])) return;
    hover.index = -1;
    // Cache an airborne section's architectural details before its height changes.
    for (const piece of game.debris) {
      if (!geometry.current.has(piece)) geometry.current.set(piece, floorParts(piece));
    }
    stepGame(delta);
    const top = game.blocks[game.blocks.length - 1];
    const age = Math.max(0, game.time - game.lastLanding);
    const pulse = animate && !game.over ? Math.exp(-age * 14) : 0;
    const counts = emptyCounts();
    const renderFloor = (block: Block, destination: Meshes, falling = false, moving = false) => {
      let parts = geometry.current.get(block);
      if (!parts) {
        parts = floorParts(block);
        geometry.current.set(block, parts);
      }
      parent.position.set(block.x, block.y, block.z);
      parent.rotation.set(0, 0, 0);
      if (moving) {
        const pose = movingPose();
        if (pose) {
          parent.position.set(pose.x, pose.y, pose.z);
          parent.rotation.z = pose.rotationZ;
        }
      }
      if (falling && "life" in block) {
        const piece = block as (typeof game.debris)[number];
        parent.rotation.z = piece.rotationZ;
      }
      parent.updateMatrix();
      for (const part of parts) {
        const mesh = destination[part.finish]!;
        const index = counts[part.finish]++;
        scratch.position.set(part.x, part.y, part.z);
        scratch.rotation.set(0, 0, 0);
        scratch.scale.set(part.width, part.height, part.depth);
        scratch.updateMatrix();
        world.multiplyMatrices(parent.matrix, scratch.matrix);
        mesh.setMatrixAt(index, world);
        color.set(part.tint);
        if (part.finish === "light") color.multiplyScalar(moving ? 1.5 : falling ? 0.05 : 0.65);
        if (part.finish === "window" && moving) color.multiplyScalar(1.12);
        mesh.setColorAt(index, color);
      }
    };

    const rebuild = staticBatch.current.version !== game.version;
    if (rebuild) {
      const first = Math.max(0, game.blocks.length - VISIBLE_FLOORS);
      for (let i = first; i < game.blocks.length; i++) renderFloor(game.blocks[i], meshes.current);
      staticBatch.current = { version: game.version, counts: { ...counts } };
      for (const finish of FINISHES) {
        const mesh = meshes.current[finish]!;
        mesh.count = counts[finish];
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    const pose = towerPose();
    if (tower.current) {
      tower.current.position.set(pose.x, pose.y, pose.z);
      tower.current.rotation.z = pose.rotationZ;
    }
    Object.assign(counts, emptyCounts());
    if (game.moving) renderFloor(game.moving, airborne.current, false, true);
    for (const piece of game.debris) renderFloor(piece, airborne.current, true);
    for (const finish of FINISHES) {
      const mesh = airborne.current[finish]!;
      mesh.count = counts[finish];
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, counts[finish] * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0, counts[finish] * 3);
        mesh.instanceColor.needsUpdate = true;
      }
    }

    if (rig.current) updateRig(rig.current);
    if (sparks.current) updateSparks(sparks.current, top, age, animate && !game.over && age < 0.65 && game.score > 0);
    if (light.current) {
      const placed = blockPose(top);
      light.current.position.set(placed.x, placed.y + 0.7, placed.z);
      light.current.intensity = pulse * (game.lastPerfect ? 24 : 10);
    }
    const target = landingTarget();
    if (illumination.current) illumination.current.position.y = target.y;
    if (key.current) {
      key.current.position.set(-8, target.y + 12, 10);
      keyTarget.position.set(0, target.y - 2, 0);
      keyTarget.updateMatrixWorld();
    }
  }, -1);

  if (!active) return null;

  return (
    <group>
      {/* The entrance leans with the tower, so it lives in the tower's group. */}
      <group ref={tower}>
        <FloorBatch meshes={meshes} concrete={concrete} windows={windowMap} capacity={CAPACITY} />
        <Entrance windows={windowMap} />
      </group>
      <FloorBatch meshes={airborne} concrete={concrete} windows={windowMap} capacity={640} />
      <instancedMesh ref={rig} args={[undefined, undefined, 7]} frustumCulled={false}>
        <boxGeometry /><meshStandardMaterial roughness={0.42} metalness={0.7} />
      </instancedMesh>
      <instancedMesh ref={sparks} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
        <boxGeometry /><meshBasicMaterial color="#ffc16a" toneMapped={false} />
      </instancedMesh>
      <pointLight ref={light} color="#c1ddff" intensity={0} distance={11} decay={2} />
      <group ref={illumination}>
        <pointLight position={[-7, 5, -4]} color="#ffd39a" intensity={45} distance={26} decay={2} />
        <pointLight position={[6, 6, 8]} color="#bad6ed" intensity={40} distance={24} decay={2} />
      </group>
      <primitive object={keyTarget} />
      <directionalLight ref={key} target={keyTarget} intensity={1.7} color="#bed9ed" castShadow
        shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} shadow-normalBias={0.035}
        shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={10} shadow-camera-bottom={-14}
        shadow-camera-near={1} shadow-camera-far={45} />
      <ShiftGround concrete={concrete} deck={deck} />
    </group>
  );
}

/** Stepped footings and a small paved site datum with two bollard lamps. */
function ShiftGround({ concrete, deck }: { concrete: THREE.Texture; deck: THREE.Texture }) {
  return (
    <>
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[7, 0.3, 7]} /><meshStandardMaterial map={concrete} color="#91a1ad" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.39, 0]} receiveShadow>
        <boxGeometry args={[8, 0.18, 8]} /><meshStandardMaterial map={deck} color="#7e8d97" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.52, 0]} receiveShadow>
        <boxGeometry args={[9.1, 0.1, 9.1]} /><meshStandardMaterial color="#1e2b35" roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 3.8, -0.29, 3.8]}>
          <mesh position={[0, 0.26, 0]}><boxGeometry args={[0.09, 0.5, 0.09]} /><meshStandardMaterial color="#263944" /></mesh>
          <mesh position={[0, 0.47, 0]}><boxGeometry args={[0.1, 0.075, 0.1]} /><meshBasicMaterial color="#d1b683" toneMapped={false} /></mesh>
        </group>
      ))}
    </>
  );
}

/** A lit entrance canopy and glazed door at the foot of the tower. */
function Entrance({ windows }: { windows: THREE.Texture }) {
  return (
    <>
      <mesh position={[0, 1.26, 3.53]} castShadow>
        <boxGeometry args={[2.1, 0.11, 0.85]} /><meshStandardMaterial color="#33434e" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.2, 3.74]}>
        <boxGeometry args={[1.8, 0.025, 0.2]} /><meshBasicMaterial color="#dfb676" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.65, 3.23]}>
        <boxGeometry args={[1.24, 1.12, 0.05]} />
        <meshStandardMaterial map={windows} color="#718999" emissive="#b59c72" emissiveMap={windows} emissiveIntensity={0.35} metalness={0.3} roughness={0.25} />
      </mesh>
      {[-0.64, 0, 0.64].map((x) => (
        <mesh key={x} position={[x, 0.65, 3.27]}>
          <boxGeometry args={[0.035, 1.16, 0.06]} /><meshStandardMaterial color="#2b3e4d" metalness={0.75} roughness={0.3} />
        </mesh>
      ))}
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.65, 3.32]}>
          <boxGeometry args={[0.022, 0.24, 0.025]} /><meshStandardMaterial color="#9ba8ac" metalness={0.85} roughness={0.2} />
        </mesh>
      ))}
    </>
  );
}
