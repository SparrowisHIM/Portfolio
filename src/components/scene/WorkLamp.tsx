"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { stepWind, wind } from "@/lib/wind";

type WorkLampProps = {
  site: Site;
  animate: boolean;
};

/**
 * The visitor holds a work lamp. A spotlight sits just beside the camera and
 * aims wherever the pointer is, so moving the mouse sweeps light across the
 * site and picks details out of the dark. A fast sweep also stirs the air:
 * the netting and the banner flap, dust scatters and the load swings.
 */
export function WorkLamp({ site, animate }: WorkLampProps) {
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const aim = useRef(new THREE.Vector3(0, site.totalHeight * 0.4, 0));
  const plane = useMemo(() => new THREE.Plane(), []);
  const hit = useRef(new THREE.Vector3());
  const lastHit = useRef(new THREE.Vector3());
  const hasLast = useRef(false);
  const normal = useRef(new THREE.Vector3());
  const centre = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const { camera, pointer, raycaster } = state;
    stepWind(delta);
    // A plane facing the camera through the middle of the site catches the pointer.
    centre.current.set(0, site.totalHeight * 0.4, 0);
    camera.getWorldDirection(normal.current).negate();
    plane.setFromNormalAndCoplanarPoint(normal.current, centre.current);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane, hit.current)) {
      const k = animate ? 1 - Math.exp(-7 * delta) : 1;
      aim.current.lerp(hit.current, k);
      if (hasLast.current && animate) {
        const speed = lastHit.current.distanceTo(hit.current) / Math.max(delta, 1 / 120);
        // Sweeping fast is a gust across the whole site.
        if (speed > 18) wind.gust = Math.min(1.6, wind.gust + (speed - 18) * 0.004);
        wind.stir.vx = (hit.current.x - lastHit.current.x) / Math.max(delta, 1 / 120);
        wind.stir.vy = (hit.current.y - lastHit.current.y) / Math.max(delta, 1 / 120);
        wind.stir.vz = (hit.current.z - lastHit.current.z) / Math.max(delta, 1 / 120);
        wind.stir.strength = Math.min(1, speed / 40);
      }
      wind.stir.x = hit.current.x;
      wind.stir.y = hit.current.y;
      wind.stir.z = hit.current.z;
      lastHit.current.copy(hit.current);
      hasLast.current = true;
    }
    target.position.copy(aim.current);
    target.updateMatrixWorld();

    if (light.current) {
      // Held low and to the right of the eye, like a torch in one hand.
      right.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
      light.current.position.copy(camera.position).addScaledVector(right.current, 3).y -= 2;
      // Same brightness on whatever it lands on, near or far.
      const dist = Math.max(8, light.current.position.distanceTo(aim.current));
      light.current.intensity = 2600 * Math.pow(dist / 40, 1.6);
    }
  });

  return (
    <>
      <spotLight
        ref={light}
        target={target}
        color="#ffe2b8"
        intensity={2600}
        angle={0.26}
        penumbra={0.7}
        distance={140}
        decay={1.6}
      />
      <primitive object={target} />
    </>
  );
}
