import * as THREE from "three";
import { concreteTexture, deckTexture, hazardTexture, hoardingTexture } from "@/lib/textures";

export const palette = {
  night: "#0d1b2e",
  nightDeep: "#071120",
  fog: "#16263a",
  concrete: "#5f6a78",
  concreteDark: "#3d4a5c",
  steel: "#8a94a4",
  steelDark: "#4c5563",
  glass: "#1b3a5a",
  sodium: "#f5b043",
  safety: "#ff6a2b",
  crane: "#e9b62c",
  chalk: "#f1ece3",
  hiVis: "#ff8a1f",
} as const;

/**
 * Shared materials. Textures are drawn on canvases, so this is only ever
 * called on the client, and only once.
 */
function create() {
  const concreteMap = concreteTexture(7);
  return {
    concrete: new THREE.MeshStandardMaterial({
      color: "#7c8694",
      map: concreteMap,
      roughness: 0.92,
      metalness: 0.02,
    }),
    concreteDark: new THREE.MeshStandardMaterial({
      color: "#4d5867",
      map: concreteMap,
      roughness: 0.95,
    }),
    deck: new THREE.MeshStandardMaterial({
      map: deckTexture(),
      roughness: 0.6,
      metalness: 0.6,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: palette.steel,
      roughness: 0.45,
      metalness: 0.7,
    }),
    steelDark: new THREE.MeshStandardMaterial({
      color: palette.steelDark,
      roughness: 0.55,
      metalness: 0.65,
    }),
    galvanised: new THREE.MeshStandardMaterial({
      color: "#aeb6c2",
      roughness: 0.38,
      metalness: 0.8,
    }),
    crane: new THREE.MeshStandardMaterial({
      color: palette.crane,
      roughness: 0.5,
      metalness: 0.35,
    }),
    safety: new THREE.MeshStandardMaterial({
      color: palette.safety,
      roughness: 0.55,
      metalness: 0.2,
    }),
    hazard: new THREE.MeshStandardMaterial({
      map: hazardTexture(),
      roughness: 0.6,
      metalness: 0.2,
    }),
    plank: new THREE.MeshStandardMaterial({
      color: "#8c7351",
      roughness: 0.9,
    }),
    hoarding: new THREE.MeshStandardMaterial({
      map: hoardingTexture(11),
      roughness: 0.85,
    }),
    rebar: new THREE.MeshStandardMaterial({
      color: "#6b4a3a",
      roughness: 0.8,
      metalness: 0.4,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: "#15181d",
      roughness: 0.95,
    }),
    cabin: new THREE.MeshStandardMaterial({
      color: "#c9cfd6",
      roughness: 0.7,
      metalness: 0.2,
    }),
    hiVis: new THREE.MeshStandardMaterial({
      color: palette.hiVis,
      roughness: 0.7,
    }),
    reflective: new THREE.MeshStandardMaterial({
      color: "#e8ecf0",
      emissive: "#dfe6ee",
      emissiveIntensity: 0.7,
      roughness: 0.4,
    }),
    hardHat: new THREE.MeshStandardMaterial({
      color: "#f2d02a",
      roughness: 0.4,
    }),
    hardHatWhite: new THREE.MeshStandardMaterial({
      color: "#e9ecef",
      roughness: 0.4,
    }),
    skin: new THREE.MeshStandardMaterial({
      color: "#8a5a3c",
      roughness: 0.8,
    }),
    denim: new THREE.MeshStandardMaterial({
      color: "#2b3a52",
      roughness: 0.9,
    }),
  };
}

let shared: ReturnType<typeof create> | null = null;

export function materials() {
  if (!shared) shared = create();
  return shared;
}
