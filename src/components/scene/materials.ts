import * as THREE from "three";

export const palette = {
  night: "#0d1b2e",
  nightDeep: "#071120",
  fog: "#16263a",
  concrete: "#5f6a78",
  concreteDark: "#3d4a5c",
  steel: "#8a94a4",
  glass: "#1b3a5a",
  sodium: "#f5b043",
  safety: "#ff6a2b",
  chalk: "#f1ece3",
} as const;

export const concrete = new THREE.MeshStandardMaterial({
  color: palette.concrete,
  roughness: 0.92,
  metalness: 0.02,
});

export const concreteDark = new THREE.MeshStandardMaterial({
  color: palette.concreteDark,
  roughness: 0.95,
});

export const steel = new THREE.MeshStandardMaterial({
  color: palette.steel,
  roughness: 0.45,
  metalness: 0.7,
});

export const safety = new THREE.MeshStandardMaterial({
  color: palette.safety,
  roughness: 0.55,
  metalness: 0.2,
});

export const plank = new THREE.MeshStandardMaterial({
  color: "#8c7351",
  roughness: 0.9,
});

export function createGlass() {
  return new THREE.MeshStandardMaterial({
    color: palette.glass,
    emissive: new THREE.Color(palette.sodium),
    emissiveIntensity: 0,
    roughness: 0.15,
    metalness: 0.4,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
}
