"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { cursor } from "@/lib/pulses";
import { stepWind, wind } from "@/lib/wind";

type PointerProps = {
  site: Site;
  animate: boolean;
};

/**
 * Where the visitor is pointing, in the world. The ray is tested against a
 * box round the building (so the x-ray lands on its surface) and, failing
 * that, a plane through the axis facing the camera. Position and velocity
 * are damped so the field the cursor exerts feels heavy rather than twitchy.
 * A fast sweep is also a gust of wind.
 */
export function Pointer({ site, animate }: PointerProps) {
  const bounds = useMemo(() => {
    let hx = 0;
    let hz = 0;
    for (const f of site.floors) {
      hx = Math.max(hx, f.width / 2 + Math.max(f.extend[0], f.extend[1], 0) + Math.abs(f.offset[0]));
      hz = Math.max(hz, f.depth / 2 + Math.max(f.extend[2], f.extend[3], 0) + Math.abs(f.offset[1]));
    }
    return new THREE.Box3(new THREE.Vector3(-hx - 0.3, 0, -hz - 0.3), new THREE.Vector3(hx + 0.3, site.totalHeight, hz + 0.3));
  }, [site]);
  const plane = useMemo(() => new THREE.Plane(), []);
  const hit = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3(0, site.totalHeight * 0.4, 0));
  const pos = useRef(new THREE.Vector3(0, site.totalHeight * 0.4, 0));
  const prev = useRef(new THREE.Vector3());
  const normal = useRef(new THREE.Vector3());
  const centre = useRef(new THREE.Vector3());
  const seen = useRef(false);

  useFrame((state, delta) => {
    const { camera, pointer, raycaster } = state;
    stepWind(delta);
    raycaster.setFromCamera(pointer, camera);
    const onBuilding = raycaster.ray.intersectBox(bounds, hit.current) !== null;
    if (!onBuilding) {
      centre.current.set(0, site.totalHeight * 0.4, 0);
      camera.getWorldDirection(normal.current).negate();
      plane.setFromNormalAndCoplanarPoint(normal.current, centre.current);
      if (!raycaster.ray.intersectPlane(plane, hit.current)) return;
    }
    target.current.copy(hit.current);
    const dt = Math.max(delta, 1 / 120);
    prev.current.copy(pos.current);
    const k = animate ? 1 - Math.exp(-14 * delta) : 1;
    pos.current.lerp(target.current, k);
    const vx = (pos.current.x - prev.current.x) / dt;
    const vy = (pos.current.y - prev.current.y) / dt;
    const vz = (pos.current.z - prev.current.z) / dt;
    const speed = Math.hypot(vx, vy, vz);
    if (seen.current && animate && speed > 18) wind.gust = Math.min(1.6, wind.gust + (speed - 18) * 0.003);
    seen.current = true;

    cursor.x = pos.current.x;
    cursor.y = pos.current.y;
    cursor.z = pos.current.z;
    cursor.vx = THREE.MathUtils.damp(cursor.vx, vx, 8, delta);
    cursor.vy = THREE.MathUtils.damp(cursor.vy, vy, 8, delta);
    cursor.vz = THREE.MathUtils.damp(cursor.vz, vz, 8, delta);
    cursor.active = THREE.MathUtils.damp(cursor.active, animate ? 1 : 0, 4, delta);
    cursor.onBuilding = THREE.MathUtils.damp(cursor.onBuilding, onBuilding ? 1 : 0, 6, delta);
    wind.stir.x = cursor.x;
    wind.stir.y = cursor.y;
    wind.stir.z = cursor.z;
    wind.stir.vx = cursor.vx;
    wind.stir.vy = cursor.vy;
    wind.stir.vz = cursor.vz;
    wind.stir.strength = Math.min(1, speed / 40);
  });

  return null;
}
