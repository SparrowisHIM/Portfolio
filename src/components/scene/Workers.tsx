"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { PLACED_AT, cranePose, floorProgress } from "@/lib/construction";
import { slabTop, weldLevel, weldSpots } from "@/lib/building";
import { scaffoldStand, workingLift } from "./Scaffold";
import { createRandom } from "@/lib/random";
import { materials } from "./materials";

/**
 * The crew.
 *
 * They are the whole reason the building reads as a building rather than a
 * model of one. At this distance a figure is a silhouette and a flash of
 * orange — what it buys is the size of everything around it, because a
 * viewer measures a storey against a person without being asked to.
 *
 * One welds, at the same connection the arc is running on, so the light has
 * someone making it. One banks the crane in from the highest slab that is
 * down, arm up while the load is on the hook and down once it is released.
 * The rest are on the scaffold, riding the working lift up as it is erected
 * — which is where most of the people on a real site are, and the thing
 * that stops a scaffold reading as a prop stood next to the building.
 *
 * Every part is an instanced draw shared across the crew, so the whole crew
 * costs ten draw calls however many of them there are.
 */

type Role = "welder" | "banksman" | "scaffolder";

type Worker = {
  role: Role;
  pos: THREE.Vector3;
  heading: number;
  /** Bent over the work. */
  crouch: number;
  /** Signalling arm, 0 down and 1 straight up. */
  signal: number;
  whiteHat: boolean;
  /** Scaffolders only: which run they are on, which bay, how far down it. */
  run?: number;
  bay?: number;
  drop?: number;
  /** Phase of their working motion, so they are not all moving as one. */
  phase?: number;
};

const UP = new THREE.Vector3(0, 1, 0);

export function Workers({
  site,
  build,
  animate,
}: {
  site: Site;
  build: RefObject<number>;
  animate: boolean;
}) {
  const m = materials();
  const spots = useMemo(() => weldSpots(site), [site]);

  const workers = useMemo<Worker[]>(() => {
    const crew: Worker[] = [
      { role: "welder", pos: new THREE.Vector3(), heading: 0, crouch: 0.55, signal: 0, whiteHat: false },
      { role: "banksman", pos: new THREE.Vector3(), heading: 0, crouch: 0, signal: 0, whiteHat: true },
    ];
    /*
      Two to a run: one at the leading edge where the scaffold is being
      built, one a couple of lifts below on something else. Spread across
      the bays and given different phases, because four figures moving in
      step read as a mechanism rather than as people.
    */
    const rnd = createRandom(site.seed ^ 0x3c2e);
    site.scaffolds.forEach((run, r) => {
      for (let k = 0; k < 2; k++) {
        crew.push({
          role: "scaffolder",
          pos: new THREE.Vector3(),
          heading: 0,
          crouch: 0,
          signal: 0,
          whiteHat: rnd.chance(0.35),
          run: r,
          bay: Math.min(run.bays - 1, Math.floor(rnd.range(0, run.bays))),
          drop: k === 0 ? 0 : 1 + Math.floor(rnd.range(0, 2)),
          phase: rnd.range(0, Math.PI * 2),
        });
      }
    });
    return crew;
  }, [site]);
  const count = workers.length;

  const meshes = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());

  const hatColour = useMemo(() => {
    const c = new Float32Array(count * 3);
    workers.forEach((w, i) => {
      const col = new THREE.Color(w.whiteHat ? "#e9ecef" : "#f2d02a");
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
    });
    return c;
  }, [workers, count]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const f = build.current ?? 0;
    const pose = cranePose(site, f);
    const level = weldLevel(site, f);
    const clock = state.clock.elapsedTime;

    workers.forEach((w, i) => {
      if (w.role === "welder") {
        // Beside the joint, never on top of it, and turned to face it.
        const at = spots[Math.max(0, Math.min(level, spots.length - 1))];
        const away = 0.72;
        const nx = Math.sin(site.viewAngle);
        const nz = Math.cos(site.viewAngle);
        target.current.set(at[0] + nx * away, slabTop(Math.max(0, level)), at[2] + nz * away);
        // Off site entirely when nothing is being joined.
        const working = level >= 0;
        w.pos.lerp(target.current, animate ? 1 - Math.exp(-4 * dt) : 1);
        w.heading = THREE.MathUtils.damp(
          w.heading,
          Math.atan2(at[0] - w.pos.x, at[2] - w.pos.z),
          5,
          dt,
        );
        w.crouch = THREE.MathUtils.damp(w.crouch, working ? 0.62 : 0, 3, dt);
      } else if (w.role === "scaffolder") {
        /*
          On the boards of a run, riding the working lift as it goes up.
          The lift is worked out from the same expression the scaffold's
          own clip plane uses, so nobody is ever standing on boards that
          have not been erected yet.
        */
        const run = site.scaffolds[w.run ?? 0];
        const lift = Math.max(1, workingLift(site, run, f) - (w.drop ?? 0));
        const at = scaffoldStand(run, w.bay ?? 0, lift);
        target.current.set(at[0], at[1], at[2]);
        w.pos.lerp(target.current, animate ? 1 - Math.exp(-2.2 * dt) : 1);
        // Turned in to the building, which is what they are working on.
        w.heading = THREE.MathUtils.damp(w.heading, Math.atan2(-w.pos.x, -w.pos.z), 4, dt);
        // A slow bend over the work, out of step with the others.
        const swing = animate ? 0.5 + 0.5 * Math.sin(clock * 0.55 + (w.phase ?? 0)) : 0.5;
        w.crouch = THREE.MathUtils.damp(w.crouch, 0.12 + swing * 0.34, 2.5, dt);
      } else {
        // On the highest slab that is actually down, at the corner nearest
        // the crane, watching the load come in.
        let top = 0;
        for (let k = 0; k <= site.floors.length; k++) {
          if (floorProgress(k, f) >= PLACED_AT) top = k;
        }
        const floor = site.floors[Math.min(top, site.floors.length - 1)];
        const cx = Math.sign(site.crane.position[0] || 1) * (floor.width / 2 - 1.15);
        const cz = Math.sign(site.crane.position[2] || 1) * (floor.depth / 2 - 1.15);
        target.current.set(cx, slabTop(top) + (top === 0 ? 0 : 0), cz);
        w.pos.lerp(target.current, animate ? 1 - Math.exp(-2.5 * dt) : 1);
        const look = pose.loaded
          ? Math.atan2(pose.hook[0] - w.pos.x, pose.hook[2] - w.pos.z)
          : Math.atan2(-w.pos.x, -w.pos.z);
        w.heading = THREE.MathUtils.damp(w.heading, look, 3, dt);
        // Arm up while the slab is on the hook: that is the whole job.
        w.signal = THREE.MathUtils.damp(w.signal, pose.loaded ? 1 : 0, 4, dt);
      }

      const lean = w.crouch;
      const sig = w.signal;
      const set = (
        key: string,
        px: number,
        py: number,
        pz: number,
        sx: number,
        sy: number,
        sz: number,
        rx = 0,
        rz = 0,
      ) => {
        const mesh = meshes.current[key];
        if (!mesh) return;
        const local = tmp.current.set(px, 0, pz).applyAxisAngle(UP, w.heading);
        dummy.position.set(w.pos.x + local.x, w.pos.y + py, w.pos.z + local.z);
        dummy.rotation.set(rx, w.heading, rz);
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      };

      // A figure is about 1.8m: legs to 0.8, torso to 1.45, hat at 1.8.
      set("legL", -0.09, 0.4, 0, 0.13, 0.8, 0.16);
      set("legR", 0.09, 0.4, 0, 0.13, 0.8, 0.16);
      set("torso", 0, 1.13 - lean * 0.18, lean * 0.22, 0.42, 0.62, 0.26, lean);
      set("stripTop", 0, 1.3 - lean * 0.22, lean * 0.3, 0.43, 0.06, 0.27, lean);
      set("stripLow", 0, 0.98 - lean * 0.1, lean * 0.1, 0.43, 0.06, 0.27, lean);
      // The signalling arm swings up and out; the other stays down.
      set("armL", -0.27, 1.1 - lean * 0.15 + sig * 0.42, lean * 0.25, 0.1, 0.55, 0.12, lean, sig * 1.5);
      set("armR", 0.27, 1.1 - lean * 0.15, lean * 0.25, 0.1, 0.55, 0.12, lean);
      set("head", 0, 1.62 - lean * 0.4, lean * 0.45, 0.22, 0.24, 0.22, lean);
      set("hat", 0, 1.76 - lean * 0.45, lean * 0.5, 0.29, 0.13, 0.31, lean);
      set("brim", 0, 1.7 - lean * 0.45, lean * 0.5 + 0.08, 0.32, 0.03, 0.4, lean);
    });

    for (const key in meshes.current) {
      const mesh = meshes.current[key];
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  /*
    Only the body casts. A figure is about forty pixels tall at this
    distance and its shadow is a smudge; the hat, the brim, the head and
    the two reflective strips were each costing their own draw in the
    shadow pass for something nobody can resolve. The torso and legs are
    the silhouette, and they are enough to land the figure on the boards.
  */
  const part = (key: string, material: THREE.Material, round = false, casts = false) => (
    <instancedMesh
      key={key}
      ref={(mesh) => {
        meshes.current[key] = mesh;
        if (mesh && key === "hat" && !mesh.instanceColor) {
          mesh.instanceColor = new THREE.InstancedBufferAttribute(hatColour, 3);
        }
      }}
      args={[undefined, material, count]}
      castShadow={casts}
      frustumCulled={false}
    >
      {round ? <sphereGeometry args={[0.5, 10, 8]} /> : <boxGeometry args={[1, 1, 1]} />}
    </instancedMesh>
  );

  return (
    <group>
      {part("legL", m.denim, false, true)}
      {part("legR", m.denim, false, true)}
      {part("torso", m.hiVis, false, true)}
      {part("stripTop", m.reflective)}
      {part("stripLow", m.reflective)}
      {part("armL", m.hiVis)}
      {part("armR", m.hiVis)}
      {part("head", m.skin, true)}
      {part("hat", m.hardHatWhite, true)}
      {part("brim", m.hardHat)}
    </group>
  );
}
