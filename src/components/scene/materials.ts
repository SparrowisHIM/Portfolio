import * as THREE from "three";
import { boardConcreteTexture, concreteTexture, deckTexture } from "@/lib/textures";

const palette = {
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
 * What the crane is painted.
 *
 * Dark, by Efe's eye. It was tried in a works yellow and in a light grey —
 * both read well, and both made the crane a second subject beside the
 * building. Dark keeps the building the subject.
 *
 * It is not quite the near-black it started as. That was #23272d at
 * metalness 0.55, which is about 0.018 in linear — darker than the studio
 * it stands in, and a dark metal in a dark room has nothing to reflect
 * either, so it had no local colour at all. This is a matt dark steel: far
 * enough up to catch the key on the chords and the rest platforms, matt
 * because paint is not metal. On screen the difference from the original is
 * slight; what actually stopped the crane reading as an armature was the
 * geometry that went in with the repaint — the kentledge, the ladder, the
 * platforms and the machinery deck.
 *
 * The lifting gear stays painted. See `rigging`.
 */
const CRANE_PAINT = "#454a53";

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
    crane: new THREE.MeshStandardMaterial({ color: CRANE_PAINT, roughness: 0.62, metalness: 0.22, envMapIntensity: 0.6 }),
    /** Machinery housings and the counter jib deck: unpainted, oily steel. */
    craneDark: new THREE.MeshStandardMaterial({ color: "#2b3038", roughness: 0.5, metalness: 0.7, envMapIntensity: 0.9 }),
    /**
     * The lifting gear: hook block cheek plates and the spreader beam.
     *
     * Painted even though the crane is not, which is both how site lifting
     * gear actually is and the only way it reads: dark steel against the
     * underside of a plate is nothing at all, and the beam is the part that
     * explains the lift. Against a dark crane it is now the one warm thing
     * in the air, which is exactly where the eye should be.
     */
    rigging: new THREE.MeshStandardMaterial({ color: "#dcb864", roughness: 0.6, metalness: 0.12, envMapIntensity: 0.6 }),
    /**
     * The site lighting mast.
     *
     * Its own material, not the crane's. It shared it while the crane was
     * near black and nobody noticed; painted, the mast became a gold post
     * standing in the middle of the laydown.
     */
    lampMast: new THREE.MeshStandardMaterial({ color: "#5a616c", roughness: 0.45, metalness: 0.6, envMapIntensity: 0.9 }),
    /*
      Site hoarding: painted ply on posts.

      Blue, which is what the reference site used and what half the hoarding
      in the country is. It is the one large painted surface in the scene and
      it sits at the boundary rather than in the middle of it, so it frames
      the deck instead of competing with the building — the opposite of what
      happened when the crane was painted.
    */
    hoarding: new THREE.MeshStandardMaterial({ color: "#2f4a66", roughness: 0.82, metalness: 0.04 }),
    hoardingPost: new THREE.MeshStandardMaterial({ color: "#20262e", roughness: 0.62, metalness: 0.35 }),
    /** Warning plates on the outside of the hoarding: small, and the only bright thing on it. */
    hoardingSign: new THREE.MeshStandardMaterial({ color: "#d8d2c4", roughness: 0.7, emissive: "#6a6354", emissiveIntensity: 0.25 }),
    /** Cast ballast: the kentledge at the foot and the counterweights. */
    kentledge: new THREE.MeshStandardMaterial({ color: "#8e8a83", map: concreteMap, roughness: 0.95, metalness: 0.02 }),
    /** Hoist rope and slings: thin, taut, catching just enough light to read. */
    cable: new THREE.MeshStandardMaterial({ color: "#b3bcca", emissive: "#8fa0bb", emissiveIntensity: 0.18, roughness: 0.35, metalness: 0.7 }),
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
