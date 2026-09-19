"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A studio environment, built in code.
 *
 * The glass had nothing to reflect. A dark pane with a low roughness in a
 * scene with no environment is just a dark pane — it can catch a specular dot
 * off a light, and that is all, which is why the curtain wall read as flat
 * panels rather than as glass.
 *
 * Rather than download an HDR, this builds a handful of emissive panels in an
 * off-screen scene and pre-filters them into a cube map: a big warm key high
 * on the light side, a cool rim behind, a warm band low down standing in for
 * the lit floors bouncing back off the deck, and a faint cold sky. It is the
 * same rig a photographer would put round a model, and it costs one GPU pass
 * at mount and nothing per frame.
 *
 * `scene.environment` reaches every standard material, so each one carries an
 * `envMapIntensity` to say how much of it it wants. Concrete takes very
 * little; glass and steel take most of it.
 */

type Panel = {
  color: string;
  power: number;
  size: [number, number];
  position: [number, number, number];
  rotation: [number, number, number];
};

const RIG: Panel[] = [
  // Key: high, on the side the directional light comes from.
  { color: "#fff2dd", power: 7, size: [16, 11], position: [11, 14, 10], rotation: [-0.85, 0.72, 0] },
  // Cool rim, behind and opposite, so edges get a cold line.
  { color: "#93b4e6", power: 2.6, size: [18, 13], position: [-12, 8, -11], rotation: [-0.3, -2.45, 0] },
  // The warm band: the lit floors and the plinth uplights bouncing back.
  { color: "#ffbe76", power: 1.6, size: [26, 5], position: [0, 1.2, 12], rotation: [0.32, 0, 0] },
  { color: "#ffbe76", power: 1.1, size: [26, 5], position: [0, 1.2, -12], rotation: [-0.32, Math.PI, 0] },
  // A faint cold ceiling, so upward-facing surfaces are not dead black.
  { color: "#4a5a74", power: 0.9, size: [30, 30], position: [0, 24, 0], rotation: [Math.PI / 2, 0, 0] },
];

export function StudioEnvironment({ intensity = 1 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();

    const rig = new THREE.Scene();
    // Not pure black: a studio has a floor and walls, and a pure black
    // surround makes the glass read as holes rather than as dark glass.
    rig.background = new THREE.Color("#0a0d12");

    const made: THREE.Mesh[] = [];
    for (const p of RIG) {
      const colour = new THREE.Color(p.color).multiplyScalar(p.power * intensity);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(p.size[0], p.size[1]),
        new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }),
      );
      mesh.position.set(...p.position);
      mesh.rotation.set(...p.rotation);
      rig.add(mesh);
      made.push(mesh);
    }

    // A little blur, so reflections read as a lit room rather than as the
    // panels themselves.
    const target = pmrem.fromScene(rig, 0.05, 0.1, 120);
    scene.environment = target.texture;

    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      for (const mesh of made) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    };
  }, [gl, scene, intensity]);

  return null;
}
