"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ScaffoldRun, Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, LIFT, SLAB_THICKNESS, onSide } from "@/lib/site-generator";
import { PLACED_AT, builtHeight, cranePose, craneJob, floorProgress, lerp, smoothstep } from "@/lib/construction";
import { createRandom } from "@/lib/random";
import { materials } from "./materials";

type WorkersProps = {
  site: Site;
  section: RefObject<number>;
  animate: boolean;
};

type Role = "welder" | "banksman" | "walker" | "ground";

type Worker = {
  role: Role;
  /** Path the walker patrols, world space. */
  path: [number, number, number][];
  /** Progress along the path and direction. */
  t: number;
  dir: 1 | -1;
  speed: number;
  pos: THREE.Vector3;
  heading: number;
  bob: number;
  /** Bent over at the work (welders). */
  crouch: number;
  whiteHat: boolean;
  /** Walkers: the scaffold run they patrol. */
  run?: ScaffoldRun;
};

const WALL = FLOOR_HEIGHT - SLAB_THICKNESS;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * The crew. Low-poly figures in hi-vis and hard hats: a welder at whichever
 * column is being raised, a banksman waiting for the slab, walkers on the
 * scaffold boards and someone by the cabin. They walk, bob and turn to face
 * where they are going.
 */
export function Workers({ site, section, animate }: WorkersProps) {
  const m = materials();
  const group = useRef<THREE.Group>(null);
  const count = 7;

  const workers = useMemo<Worker[]>(() => {
    const rnd = createRandom(site.seed ^ 0x51ed);
    const list: Worker[] = [];
    const make = (role: Role, path: [number, number, number][], speed = 0.6): Worker => ({
      role,
      path,
      t: rnd.range(0, 1),
      dir: rnd.chance(0.5) ? 1 : -1,
      speed,
      pos: new THREE.Vector3(...path[0]),
      heading: 0,
      bob: rnd.range(0, Math.PI * 2),
      crouch: 0,
      whiteHat: rnd.chance(0.3),
    });
    list.push(make("welder", [[0, 0, 0]]));
    list.push(make("banksman", [[0, 0, 0]]));
    // Walkers on the boarded lifts of the scaffolding.
    for (const run of site.scaffolds) {
      if (!run.boarded.length || list.length >= count - 1) continue;
      const lift = run.boarded[Math.floor(run.boarded.length / 2)];
      const y = lift * LIFT + 0.09;
      const path: [number, number, number][] = [
        onSide(run.side, -run.span / 2 + 0.8, run.offset + 0.45, y),
        onSide(run.side, run.span / 2 - 0.8, run.offset + 0.45, y),
      ];
      const walker = make("walker", path, rnd.range(0.45, 0.7));
      walker.run = run;
      list.push(walker);
    }
    // On the ground, between the cabin and the gate.
    const cabin = site.cabin.position;
    list.push(
      make(
        "ground",
        [
          [cabin[0], 0, cabin[2]],
          [cabin[0] * 0.5, 0, cabin[2] * 0.5],
          [site.generator.position[0], 0, site.generator.position[2]],
        ],
        0.5,
      ),
    );
    while (list.length < count) {
      const a = rnd.range(0, Math.PI * 2);
      const r = rnd.range(7, 10);
      list.push(make("ground", [[Math.cos(a) * r, 0, Math.sin(a) * r], [Math.cos(a + 0.6) * r, 0, Math.sin(a + 0.6) * r]], 0.4));
    }
    return list;
  }, [site]);

  const parts = useMemo(() => {
    const dummy = new THREE.Object3D();
    return { dummy };
  }, []);

  const meshes = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const tmp = useRef(new THREE.Vector3());
  const hatColor = useMemo(() => {
    const c = new Float32Array(count * 3);
    workers.forEach((w, i) => {
      const col = w.whiteHat ? new THREE.Color("#e9ecef") : new THREE.Color("#f2d02a");
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
    });
    return c;
  }, [workers]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = clock.getElapsedTime();
    const f = section.current ?? 0;
    const job = craneJob(site, f);
    const pose = cranePose(site, f);
    const { dummy } = parts;

    workers.forEach((w, i) => {
      let moving = false;
      if (w.role === "welder") {
        // At the top of the column being raised, or waiting on the last placed slab.
        const level = Math.min(job.index, site.floors.length);
        const isTop = level >= site.floors.length;
        const floor = isTop ? site.topLevel : site.floors[level];
        const t = floorProgress(level, f);
        const rise = t === 0 ? 0.06 : lerp(0.06, 1, smoothstep(0, 0.3, t));
        const welding = t > 0.02 && t < 0.3;
        const columns = floor.columns;
        const col = columns[Math.floor(time / 4) % Math.max(1, columns.length)] ?? [0, 0];
        const baseY = (isTop ? site.topLevel.y : floor.y) - WALL + SLAB_THICKNESS;
        const target = tmp.current.set(col[0] + 0.55, welding ? baseY + Math.max(0, WALL * rise - 0.9) : baseY, col[1] + 0.35);
        if (!welding) target.set(floor.width / 2 - 0.9, baseY, -floor.depth / 2 + 0.9);
        moving = w.pos.distanceToSquared(target) > 0.01;
        w.pos.lerp(target, 1 - Math.exp(-3 * dt));
        w.heading = THREE.MathUtils.damp(w.heading, Math.atan2(col[0] - w.pos.x, col[1] - w.pos.z), 4, dt);
        w.crouch = THREE.MathUtils.damp(w.crouch, welding ? 0.55 : 0, 3, dt);
      } else if (w.role === "banksman") {
        // Stands on the highest placed slab, watching the load come in.
        let top = 0;
        for (let k = 0; k < site.floors.length; k++) if (floorProgress(k, f) >= PLACED_AT) top = k;
        const floor = site.floors[top];
        const target = tmp.current.set(-floor.width / 2 + 1.1, floor.y + SLAB_THICKNESS, floor.depth / 2 - 1.1);
        moving = w.pos.distanceToSquared(target) > 0.01;
        w.pos.lerp(target, 1 - Math.exp(-3 * dt));
        const look = pose.loaded ? Math.atan2(pose.hook[0] - w.pos.x, pose.hook[2] - w.pos.z) : Math.atan2(-w.pos.x, -w.pos.z) + Math.PI;
        w.heading = THREE.MathUtils.damp(w.heading, look, 3, dt);
      } else {
        // Walkers stay on the highest boarded lift the scaffold has reached.
        if (w.run) {
          const top = builtHeight(site, f) + 1.6;
          let lift = 0;
          for (const l of w.run.boarded) if (l * LIFT + 0.4 < top && l > lift) lift = l;
          const y = lift * LIFT + 0.09;
          w.path[0][1] = y;
          w.path[1][1] = y;
        }
        // Patrol the path, pausing at the ends.
        if (animate) {
          w.t += (w.dir * w.speed * dt) / Math.max(1, w.path.length - 1);
          if (w.t > 1.15) w.dir = -1;
          if (w.t < -0.15) w.dir = 1;
        }
        const u = THREE.MathUtils.clamp(w.t, 0, 1) * (w.path.length - 1);
        const k = Math.min(w.path.length - 2, Math.floor(u));
        const s = u - k;
        const a = w.path[k];
        const b = w.path[k + 1];
        const x = lerp(a[0], b[0], s);
        const y = lerp(a[1], b[1], s);
        const z = lerp(a[2], b[2], s);
        moving = w.t >= 0 && w.t <= 1;
        const heading = Math.atan2((b[0] - a[0]) * w.dir, (b[2] - a[2]) * w.dir);
        w.heading = THREE.MathUtils.damp(w.heading, heading, 5, dt);
        w.pos.set(x, y, z);
      }
      if (animate && moving) w.bob += dt * 9;

      const bob = moving ? Math.abs(Math.sin(w.bob)) * 0.05 : 0;
      const swing = moving ? Math.sin(w.bob) * 0.5 : 0;
      const lean = w.crouch;
      const set = (key: string, px: number, py: number, pz: number, sx: number, sy: number, sz: number, rx = 0) => {
        const mesh = meshes.current[key];
        if (!mesh) return;
        dummy.position.set(w.pos.x, w.pos.y + py + bob, w.pos.z);
        dummy.rotation.set(0, w.heading, 0);
        dummy.updateMatrix();
        // Offset in the figure's own frame.
        const local = tmp.current.set(px, 0, pz).applyAxisAngle(UP, w.heading);
        dummy.position.x += local.x;
        dummy.position.z += local.z;
        dummy.rotation.set(rx, w.heading, 0);
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      };
      // Legs, torso (leaning when crouched), head, hat with brim, strips.
      set("legL", -0.09, 0.4, 0, 0.13, 0.8, 0.16, swing * 0.6);
      set("legR", 0.09, 0.4, 0, 0.13, 0.8, 0.16, -swing * 0.6);
      set("torso", 0, 1.13 - lean * 0.18, lean * 0.22, 0.42, 0.62, 0.26, lean);
      set("stripTop", 0, 1.3 - lean * 0.22, lean * 0.3, 0.43, 0.06, 0.27, lean);
      set("stripLow", 0, 0.98 - lean * 0.1, lean * 0.1, 0.43, 0.06, 0.27, lean);
      set("armL", -0.27, 1.1 - lean * 0.15, lean * 0.25, 0.1, 0.55, 0.12, lean + swing * 0.4);
      set("armR", 0.27, 1.1 - lean * 0.15, lean * 0.25, 0.1, 0.55, 0.12, lean - swing * 0.4);
      set("head", 0, 1.62 - lean * 0.4, lean * 0.45, 0.22, 0.24, 0.22, lean);
      set("hat", 0, 1.76 - lean * 0.45, lean * 0.5, 0.29, 0.13, 0.31, lean);
      set("brim", 0, 1.7 - lean * 0.45, lean * 0.5 + 0.08, 0.32, 0.03, 0.4, lean);
    });
    for (const key in meshes.current) {
      const mesh = meshes.current[key];
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  const part = (key: string, material: THREE.Material, geometry?: "sphere") => (
    <instancedMesh
      key={key}
      ref={(mesh) => {
        meshes.current[key] = mesh;
        if (mesh && key === "hat" && !mesh.instanceColor) {
          mesh.instanceColor = new THREE.InstancedBufferAttribute(hatColor, 3);
        }
      }}
      args={[undefined, material, count]}
      frustumCulled={false}
    >
      {geometry === "sphere" ? <sphereGeometry args={[0.5, 10, 8]} /> : <boxGeometry args={[1, 1, 1]} />}
    </instancedMesh>
  );

  return (
    <group ref={group}>
      {part("legL", m.denim)}
      {part("legR", m.denim)}
      {part("torso", m.hiVis)}
      {part("stripTop", m.reflective)}
      {part("stripLow", m.reflective)}
      {part("armL", m.hiVis)}
      {part("armR", m.hiVis)}
      {part("head", m.skin, "sphere")}
      {part("hat", m.hardHatWhite, "sphere")}
      {part("brim", m.hardHat)}
    </group>
  );
}
