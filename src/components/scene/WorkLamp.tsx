"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";

type WorkLampProps = {
  site: Site;
  animate: boolean;
};

/**
 * The visitor holds a work lamp. A spotlight sits just beside the camera and
 * aims wherever the pointer is, so moving the mouse sweeps light across the
 * site and picks details out of the dark.
 */
export function WorkLamp({ site, animate }: WorkLampProps) {
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const aim = useRef(new THREE.Vector3(0, site.totalHeight * 0.4, 0));
  const plane = useMemo(() => new THREE.Plane(), []);
  const hit = useRef(new THREE.Vector3());
  const normal = useRef(new THREE.Vector3());
  const centre = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const { camera, pointer, raycaster } = state;
    // A plane facing the camera through the middle of the site catches the pointer.
    centre.current.set(0, site.totalHeight * 0.4, 0);
    camera.getWorldDirection(normal.current).negate();
    plane.setFromNormalAndCoplanarPoint(normal.current, centre.current);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane, hit.current)) {
      const k = animate ? 1 - Math.exp(-7 * delta) : 1;
      aim.current.lerp(hit.current, k);
    }
    target.position.copy(aim.current);
    target.updateMatrixWorld();

    if (light.current) {
      // Held low and to the right of the eye, like a torch in one hand.
      right.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
      light.current.position.copy(camera.position).addScaledVector(right.current, 3).y -= 2;
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
