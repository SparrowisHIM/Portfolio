"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type BoxInstance = {
  position: [number, number, number];
  scale: [number, number, number];
  rotationY?: number;
};

type InstancedBoxesProps = {
  items: BoxInstance[];
  material: THREE.Material;
};

/** One draw call for many boxes: scaffold poles, ledgers, planks. */
export function InstancedBoxes({ items, material }: InstancedBoxesProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((item, i) => {
      dummy.position.set(...item.position);
      dummy.rotation.set(0, item.rotationY ?? 0, 0);
      dummy.scale.set(...item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, dummy]);

  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[undefined, undefined, Math.max(1, items.length)]}
      material={material}
      castShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}
