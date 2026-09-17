"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { Instance } from "@/lib/geometry";

type InstancesProps = {
  items: Instance[];
  material: THREE.Material;
  /** Unit geometry to instance; a unit box by default. */
  geometry?: THREE.BufferGeometry;
  children?: ReactNode;
  frustumCulled?: boolean;
};

/** One draw call for many placed members: chords, braces, rails, boards. */
export function Instances({ items, material, geometry, children, frustumCulled = true }: InstancesProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((item, i) => {
      dummy.position.set(item.position[0], item.position[1], item.position[2]);
      if (item.quaternion) {
        dummy.quaternion.set(item.quaternion[0], item.quaternion[1], item.quaternion[2], item.quaternion[3]);
      } else {
        dummy.quaternion.identity();
        if (item.rotationY) dummy.rotation.set(0, item.rotationY, 0);
      }
      dummy.scale.set(item.scale[0], item.scale[1], item.scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, dummy, material, geometry]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[geometry, material, Math.max(1, items.length)]}
      frustumCulled={frustumCulled}
    >
      {!geometry && <boxGeometry args={[1, 1, 1]} />}
      {children}
    </instancedMesh>
  );
}
