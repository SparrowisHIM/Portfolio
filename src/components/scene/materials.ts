import * as THREE from "three";
import { concreteTexture, deckTexture } from "@/lib/textures";

export const palette = {
  night: "#0d1b2e",
  nightDeep: "#071120",
  void: "#05080f",
  fog: "#070c16",
  graphite: "#2a3140",
  steel: "#3a4352",
  steelDark: "#1e2430",
  glass: "#0a1220",
  sodium: "#f5b043",
  safety: "#ff6a2b",
  chalk: "#f1ece3",
} as const;

/**
 * Shared materials for the parts that still use the standard pipeline: the
 * crane, the scaffold and the game's stacked storeys. Dark, low-key, so the
 * only light in the scene is the light that means something.
 */
function create() {
  const concreteMap = concreteTexture(7);
  return {
    concrete: new THREE.MeshStandardMaterial({ color: "#3c4552", map: concreteMap, roughness: 0.92, metalness: 0.05 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: "#252c38", map: concreteMap, roughness: 0.95 }),
    deck: new THREE.MeshStandardMaterial({ map: deckTexture(), color: "#4a5262", roughness: 0.6, metalness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: palette.steel, roughness: 0.45, metalness: 0.7 }),
    steelDark: new THREE.MeshStandardMaterial({ color: palette.steelDark, roughness: 0.4, metalness: 0.75 }),
    galvanised: new THREE.MeshStandardMaterial({ color: "#4b5566", roughness: 0.35, metalness: 0.85 }),
    /** Crane structure: dark metal with a cold sheen. */
    crane: new THREE.MeshStandardMaterial({ color: "#262d3a", roughness: 0.35, metalness: 0.8 }),
  };
}

let shared: ReturnType<typeof create> | null = null;

export function materials() {
  if (!shared) shared = create();
  return shared;
}
