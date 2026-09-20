"use client";

import { useMemo } from "react";
import * as THREE from "three";

const vertex = /* glsl */ `
varying float vAlong;
varying vec3 vNormal;
varying vec3 vView;
uniform float uLength;
void main() {
  // The cone's apex is at +h/2 and its base at -h/2, so this runs 0 at the
  // far end to 1 at the lamp.
  vAlong = clamp(position.y / uLength + 0.5, 0.0, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vView = -view.xyz;
  gl_Position = projectionMatrix * view;
}
`;

/*
  A beam of lit air.

  There is no haze in this scene to scatter in and adding some would mean
  shading every pixel of the frame for it, so the beam is the cone itself:
  additive, never writing depth, and faded on two axes.

  Along its length it falls off from the lamp, so the shaft is brightest at
  the source and gone by the time it reaches whatever it is pointed at —
  which also disposes of the ellipse the cone would otherwise cut where it
  meets a surface.

  Across it, brightness follows how squarely the surface faces the camera.
  That one is worth being careful about: the reflex is the rim-light term,
  one minus the dot, and it is exactly wrong here. A cone seen from the
  side is thickest along its own axis, so the middle should be the
  brightest part of the shaft. Inverted you get a hollow tube with two
  bright edges, which reads as a cone-shaped object rather than as light.
*/
const fragment = /* glsl */ `
varying float vAlong;
varying vec3 vNormal;
varying vec3 vView;
uniform vec3 uColor;
uniform float uStrength;
uniform float uFade;
void main() {
  float lengthFade = pow(vAlong, uFade);
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  gl_FragColor = vec4(uColor, lengthFade * pow(facing, 1.3) * uStrength);
}
`;

type BeamProps = {
  /** The lamp, in the parent's space. */
  from: THREE.Vector3;
  /** What it is pointed at, in the parent's space. */
  to: THREE.Vector3;
  /** Half-angle of the shaft, as a fraction of its length. */
  spread: number;
  strength?: number;
  color?: string;
  /**
   * How fast it dies away from the lamp. A short shaft wants a steep
   * falloff so it is gone before it lands; a long one tuned the same way
   * never reaches anything and hangs in the air as a cone with no end.
   */
  fade?: number;
};

/** The shaft from one lamp head, aimed at a point. */
export function Beam({ from, to, spread, strength = 0.6, color = "#ffca8c", fade = 1.7 }: BeamProps) {
  const { position, quaternion, length, material } = useMemo(() => {
    const axis = new THREE.Vector3().subVectors(from, to);
    const len = axis.length();
    return {
      position: new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        axis.clone().normalize(),
      ),
      length: len,
      material: new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        /*
          Back faces only. Drawing both walls of the cone shades the shaft
          twice over and doubles it against itself down the middle; the far
          wall on its own gives the same gradient for half the fill.
        */
        side: THREE.BackSide,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uStrength: { value: strength },
          uLength: { value: len },
          uFade: { value: fade },
        },
      }),
    };
  }, [from, to, strength, color, fade]);

  return (
    <mesh position={position} quaternion={quaternion} material={material} renderOrder={2}>
      <coneGeometry args={[length * spread, length, 22, 1, true]} />
    </mesh>
  );
}
