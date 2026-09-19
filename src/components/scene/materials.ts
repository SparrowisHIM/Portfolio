import * as THREE from "three";
import { boardConcreteTexture, concreteTexture, deckTexture } from "@/lib/textures";

export const palette = {
  night: "#0d1b2e",
  nightDeep: "#071120",
  void: "#040609",
  fog: "#050710",
  graphite: "#2a3140",
  steel: "#3a4352",
  steelDark: "#1e2430",
  glass: "#0a1220",
  sodium: "#f5b043",
  safety: "#ff6a2b",
  chalk: "#f1ece3",
  hiVis: "#ff8a1f",
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
    steel: new THREE.MeshStandardMaterial({ color: palette.steel, roughness: 0.4, metalness: 0.75, envMapIntensity: 1.0 }),
    steelDark: new THREE.MeshStandardMaterial({ color: palette.steelDark, roughness: 0.38, metalness: 0.8, envMapIntensity: 0.9 }),
    galvanised: new THREE.MeshStandardMaterial({ color: "#4b5566", roughness: 0.3, metalness: 0.9, envMapIntensity: 1.2 }),
    /**
     * Crane structure: painted steel, lit.
     *
     * It used to carry an emissive term so it read as drawn line work against
     * the void. Beside a solid building that is exactly wrong — a glowing
     * crane next to lit concrete is the one thing in frame that still looks
     * like a wireframe. Let the key light model it like everything else.
     */
    crane: new THREE.MeshStandardMaterial({ color: "#23272d", roughness: 0.62, metalness: 0.55, envMapIntensity: 0.85 }),
    /** Hoist rope and slings: thin, taut, catching just enough light to read. */
    cable: new THREE.MeshStandardMaterial({ color: "#8d96a5", emissive: "#8fa0bb", emissiveIntensity: 0.12, roughness: 0.35, metalness: 0.7 }),
    /* ---- the crew ----------------------------------------------------
       Two figures is all the reference has, and it is enough: at this
       distance they are a silhouette and a flash of orange, and what they
       buy is the scale of everything around them. */
    hiVis: new THREE.MeshStandardMaterial({ color: palette.hiVis, roughness: 0.7 }),
    /** The bands on the vest, which is what actually catches the eye at distance. */
    reflective: new THREE.MeshStandardMaterial({
      color: "#e8ecf0",
      emissive: "#dfe6ee",
      emissiveIntensity: 0.7,
      roughness: 0.4,
    }),
    hardHat: new THREE.MeshStandardMaterial({ color: "#f2d02a", roughness: 0.4 }),
    /* ---- site dressing ---- */
    cabin: new THREE.MeshStandardMaterial({ color: "#8a8f96", roughness: 0.6, metalness: 0.35, envMapIntensity: 0.8 }),
    skip: new THREE.MeshStandardMaterial({ color: "#8a4a22", roughness: 0.78, metalness: 0.2 }),
    rebar: new THREE.MeshStandardMaterial({ color: "#6a6257", roughness: 0.72, metalness: 0.45 }),
    timber: new THREE.MeshStandardMaterial({ color: "#7d7263", roughness: 0.9 }),
    hardHatWhite: new THREE.MeshStandardMaterial({ color: "#e9ecef", roughness: 0.4 }),
    skin: new THREE.MeshStandardMaterial({ color: "#8a5a3c", roughness: 0.8 }),
    denim: new THREE.MeshStandardMaterial({ color: "#2b3a52", roughness: 0.9 }),
    /** The precast unit on the hook, matching the slabs it is being stacked onto. */
    precast: new THREE.MeshStandardMaterial({ color: "#ffffff", map: boardConcreteTexture(9), roughness: 0.92, metalness: 0.02, envMapIntensity: 0.22 }),
  };
}

let shared: ReturnType<typeof create> | null = null;

export function materials() {
  if (!shared) shared = create();
  return shared;
}
