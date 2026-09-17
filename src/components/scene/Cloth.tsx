"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { wind, windAt } from "@/lib/wind";

type ClothProps = {
  /** Top-left corner of the sheet in world space. */
  origin: [number, number, number];
  /** Unit direction along the width. */
  u: [number, number, number];
  /** Unit direction along the height (usually down). */
  v: [number, number, number];
  width: number;
  height: number;
  /** Nodes across and down. */
  nx?: number;
  ny?: number;
  /** Which edges are pinned to whatever the sheet hangs from. */
  pin?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean; every?: number };
  material: THREE.Material;
  /** How hard the wind pushes this sheet. */
  windScale?: number;
  gravity?: number;
  animate: boolean;
  /** Y of the clipping plane, so scaffold netting climbs with the tower. */
  clipAbove?: React.RefObject<number>;
};

/**
 * A hanging sheet: debris netting, a printed banner, a tarpaulin. Verlet
 * integration with distance constraints, pushed by the wind and by the
 * visitor. Moving the pointer over the sheet pushes it away; a fast pass
 * sends a ripple through it.
 */
export function Cloth({
  origin,
  u,
  v,
  width,
  height,
  nx = 22,
  ny = 14,
  pin = { top: true },
  material,
  windScale = 1,
  gravity = 2.4,
  animate,
  clipAbove,
}: ClothProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const plane = useMemo(() => new THREE.Plane(), []);
  const normal = useMemo(() => new THREE.Vector3(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const lastHit = useRef<THREE.Vector3 | null>(null);
  const clip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000), []);

  const sim = useMemo(() => {
    const count = nx * ny;
    const pos = new Float32Array(count * 3);
    const prev = new Float32Array(count * 3);
    const rest = new Float32Array(count * 3);
    const pinned = new Uint8Array(count);
    const uv = new Float32Array(count * 2);
    const phase = new Float32Array(count);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const a = (i / (nx - 1)) * width;
        const b = (j / (ny - 1)) * height;
        pos[k * 3] = origin[0] + u[0] * a + v[0] * b;
        pos[k * 3 + 1] = origin[1] + u[1] * a + v[1] * b;
        pos[k * 3 + 2] = origin[2] + u[2] * a + v[2] * b;
        uv[k * 2] = i / (nx - 1);
        uv[k * 2 + 1] = 1 - j / (ny - 1);
        // A stable pseudo-random phase per node, so flutter is not in step.
        phase[k] = ((k * 2654435761) % 1000) / 1000 * Math.PI * 2;
        const every = pin.every ?? 1;
        if (
          (pin.top && j === 0 && i % every === 0) ||
          (pin.bottom && j === ny - 1 && i % every === 0) ||
          (pin.left && i === 0) ||
          (pin.right && i === nx - 1) ||
          (pin.top && j === 0 && (i === 0 || i === nx - 1))
        ) {
          pinned[k] = 1;
        }
      }
    }
    prev.set(pos);
    rest.set(pos);
    // Structural and shear constraints.
    const a: number[] = [];
    const b: number[] = [];
    const len: number[] = [];
    const link = (p: number, q: number) => {
      a.push(p);
      b.push(q);
      len.push(Math.hypot(pos[p * 3] - pos[q * 3], pos[p * 3 + 1] - pos[q * 3 + 1], pos[p * 3 + 2] - pos[q * 3 + 2]));
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (i < nx - 1) link(k, k + 1);
        if (j < ny - 1) link(k, k + nx);
        if (i < nx - 1 && j < ny - 1) {
          link(k, k + nx + 1);
          link(k + 1, k + nx);
        }
        if (i < nx - 2) link(k, k + 2);
        if (j < ny - 2) link(k, k + 2 * nx);
      }
    }
    const index: number[] = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const k = j * nx + i;
        index.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
      }
    }
    const n = new THREE.Vector3(u[0], u[1], u[2]).cross(new THREE.Vector3(v[0], v[1], v[2])).normalize();
    return {
      count,
      pos,
      prev,
      rest,
      pinned,
      uv,
      phase,
      ca: Int32Array.from(a),
      cb: Int32Array.from(b),
      cl: Float32Array.from(len),
      index,
      normal: [n.x, n.y, n.z] as [number, number, number],
    };
  }, [nx, ny, width, height, origin, u, v, pin]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(sim.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("uv", new THREE.BufferAttribute(sim.uv, 2));
    g.setIndex(sim.index);
    g.computeVertexNormals();
    return g;
  }, [sim]);

  useEffect(() => {
    const mat = material as THREE.MeshStandardMaterial;
    if (clipAbove) mat.clippingPlanes = [clip];
    return () => {
      if (clipAbove) mat.clippingPlanes = null;
    };
  }, [material, clip, clipAbove]);

  const accumulator = useRef(0);

  useFrame(({ camera, pointer, raycaster }, delta) => {
    if (clipAbove) clip.constant = clipAbove.current ?? 1000;
    const { pos, prev, rest, pinned, count, ca, cb, cl, phase } = sim;

    // Where is the visitor? Cast onto the rest plane of the sheet.
    normal.set(sim.normal[0], sim.normal[1], sim.normal[2]);
    plane.setFromNormalAndCoplanarPoint(normal, hit.set(rest[0], rest[1], rest[2]));
    raycaster.setFromCamera(pointer, camera);
    let pointerOn = false;
    let px = 0;
    let py = 0;
    let pz = 0;
    let speed = 0;
    if (animate && raycaster.ray.intersectPlane(plane, hit)) {
      pointerOn = true;
      px = hit.x;
      py = hit.y;
      pz = hit.z;
      if (lastHit.current) speed = lastHit.current.distanceTo(hit) / Math.max(delta, 1 / 120);
      lastHit.current = (lastHit.current ?? new THREE.Vector3()).copy(hit);
    }
    // Push away from the camera, whichever side the sheet faces.
    const toCamera = hit.copy(camera.position).sub(new THREE.Vector3(rest[0], rest[1], rest[2]));
    const facing = toCamera.dot(normal) > 0 ? -1 : 1;

    const step = 1 / 60;
    accumulator.current = Math.min(accumulator.current + delta, step * 3);
    const strength = windAt(wind.time) * windScale;
    const t = wind.time;

    while (accumulator.current >= step) {
      accumulator.current -= step;
      if (!animate) break;
      for (let k = 0; k < count; k++) {
        if (pinned[k]) continue;
        const i = k * 3;
        const x = pos[i];
        const y = pos[i + 1];
        const z = pos[i + 2];
        // Wind: a travelling wave along the wind direction plus flutter.
        const wave = Math.sin(t * 2.6 - (x * wind.dir[0] + z * wind.dir[1]) * 0.9 + phase[k] * 0.3);
        const flutter = Math.sin(t * 9 + phase[k]) * 0.25;
        let fx = wind.dir[0] * strength * (0.6 + wave * 0.5 + flutter);
        let fy = -gravity + strength * 0.25 * flutter;
        let fz = wind.dir[1] * strength * (0.6 + wave * 0.5 + flutter);
        // The visitor: a soft push near the pointer, stronger when moving fast.
        if (pointerOn) {
          const dx = x - px;
          const dy = y - py;
          const dz = z - pz;
          const d2 = dx * dx + dy * dy + dz * dz;
          const radius = 1.4 + Math.min(2, speed * 0.08);
          if (d2 < radius * radius) {
            const fall = 1 - Math.sqrt(d2) / radius;
            const push = (6 + Math.min(30, speed * 1.2)) * fall * fall * facing;
            fx += sim.normal[0] * push;
            fy += sim.normal[1] * push;
            fz += sim.normal[2] * push;
          }
        }
        const vx = (x - prev[i]) * 0.985;
        const vy = (y - prev[i + 1]) * 0.985;
        const vz = (z - prev[i + 2]) * 0.985;
        prev[i] = x;
        prev[i + 1] = y;
        prev[i + 2] = z;
        pos[i] = x + vx + fx * step * step;
        pos[i + 1] = y + vy + fy * step * step;
        pos[i + 2] = z + vz + fz * step * step;
      }
      for (let iter = 0; iter < 5; iter++) {
        for (let c = 0; c < ca.length; c++) {
          const p = ca[c] * 3;
          const q = cb[c] * 3;
          const dx = pos[q] - pos[p];
          const dy = pos[q + 1] - pos[p + 1];
          const dz = pos[q + 2] - pos[p + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
          const diff = (d - cl[c]) / d;
          const wp = pinned[ca[c]] ? 0 : 1;
          const wq = pinned[cb[c]] ? 0 : 1;
          const sum = wp + wq;
          if (!sum) continue;
          const sp = (wp / sum) * diff;
          const sq = (wq / sum) * diff;
          pos[p] += dx * sp;
          pos[p + 1] += dy * sp;
          pos[p + 2] += dz * sp;
          pos[q] -= dx * sq;
          pos[q + 1] -= dy * sq;
          pos[q + 2] -= dz * sq;
        }
      }
    }
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} />;
}
