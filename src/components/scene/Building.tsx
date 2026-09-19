"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT } from "@/lib/site-generator";
import { floorProgress, smoothstep } from "@/lib/construction";
import { buildParts, plinth, slabTop, storey, CLAD_LAG, SLAB, type Part, type PartKind, type Vec3 } from "@/lib/building";
import { boardConcreteTexture, siteDeckTexture } from "@/lib/textures";
import { hover, resetHover } from "@/lib/hover";
import { orbit } from "@/lib/orbit";
import { projects } from "@/lib/projects";

/**
 * The building: one instanced draw per material, placed from the frame loop.
 *
 * Standard materials rather than a custom shader, deliberately. The thing
 * being built is a solid object with concrete, steel and glass in it, and a
 * lit surface is what makes those read as materials at all. The previous
 * skeletal renderer drew everything as self-lit line work, which is why it
 * came out looking like every other three.js demo.
 *
 * Matrices are written every frame rather than in an effect. r3f rebuilds an
 * instancedMesh whenever its `args` change and hands back an empty matrix
 * buffer, and an effect will not be watching — that is the blank-building bug
 * this project already lost a session to. Writing from the loop cannot miss it,
 * and we need per-frame placement for the settle-in anyway.
 */

type BuildingProps = {
  site: Site;
  /** Clicking a storey jumps to that project. */
  onSelectFloor?: (index: number) => void;
  /** Construction time: the same clock the crane and lights read. */
  build: RefObject<number>;
  animate: boolean;
};

/** How long a part takes to settle once it starts arriving. */
const SETTLE = 0.08;

function easeOutCubic(t: number) {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeOutBack(t: number) {
  const c1 = 1.32;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/** Materials whose instances are worth casting a shadow from. */
const CASTS_SHADOW = new Set(["concrete", "coreConcrete"]);

/** Which material each kind draws with. Kinds sharing one are drawn together. */
const MATERIAL_OF: Record<PartKind, string> = {
  column: "concrete",
  slab: "concrete",
  core: "coreConcrete",
  glass: "glass",
  mullion: "frame",
  ceiling: "lightStrip",
  fitout: "fitout",
  rail: "safety",
  starter: "rebar",
  stack: "timber",
};

/** Transparent groups draw after everything opaque. */
const TRANSPARENT = new Set(["glass"]);

/**
 * How much each material lifts when its storey is hovered, as a multiplier
 * on the instance colour.
 *
 * Multipliers rather than a colour, because the materials start from wildly
 * different places: white concrete takes a warm nudge, while the near-black
 * glass would need a factor of twelve before anything showed. The glass is
 * deliberately left alone — the storey lights up from the inside instead,
 * where the lamp already is, which is what a floor being handed over
 * actually looks like.
 */
const HOVER_TINT: Record<string, [number, number, number]> = {
  concrete: [1.42, 1.24, 0.98],
  coreConcrete: [1.42, 1.24, 0.98],
  lightStrip: [1.15, 1.1, 1.0],
  frame: [1.9, 1.7, 1.3],
  safety: [1.2, 1.12, 1.0],
  fitout: [1.3, 1.2, 1.0],
};

/**
 * Which storey a part stands in, from where it sits.
 *
 * Derived rather than stored, because `Part.floor` is a *timing* field — the
 * floor whose progress places the part — and the two diverge by design:
 * glazing on storey N is placed by floor N + CLAD_LAG. Height does not lie.
 * A slab lands half its own thickness below the next storey line, so it
 * falls to the storey underneath and caps it, which is the band the eye
 * reads as that floor.
 */
function storeyOf(part: Part, levels: number) {
  const i = Math.floor((part.position[1] + SLAB * 0.5) / FLOOR_HEIGHT - 0.001);
  return Math.min(levels - 1, Math.max(0, i));
}

export function Building({ site, build, animate, onSelectFloor }: BuildingProps) {
  const parts = useMemo(() => buildParts(site), [site]);
  const base = useMemo(() => plinth(site), [site]);

  // Grouped once, so each group is a single draw call. Each group carries
  // the storey every one of its instances stands in, so the hover highlight
  // is a lookup in the frame loop rather than a search.
  const groups = useMemo(() => {
    const levels = site.floors.length;
    const by = new Map<string, Part[]>();
    for (const part of parts) {
      const key = MATERIAL_OF[part.kind];
      const list = by.get(key);
      if (list) list.push(part);
      else by.set(key, [part]);
    }
    return [...by.entries()].map(([material, items]) => ({
      material,
      items,
      storeys: items.map((part) => storeyOf(part, levels)),
    }));
  }, [parts, site]);

  const materials = useMemo(() => {
    const map = boardConcreteTexture(5);
    const concrete = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map,
      roughness: 0.94,
      metalness: 0.02,
      // Concrete is not reflective. It takes a trace so the shadow side is
      // not dead, and no more.
      envMapIntensity: 0.22,
    });
    // The core reads a shade deeper so the shaft separates from the plates
    // it passes through, the way board-marked in-situ concrete does against
    // a precast slab.
    const coreConcrete = new THREE.MeshStandardMaterial({
      color: "#b9b4aa",
      map,
      roughness: 0.96,
      metalness: 0.02,
    });
    return {
      concrete,
      coreConcrete,
      /*
        Dark glass. Opaque enough to read as a surface and catch a highlight,
        open enough that the lit ceiling behind it comes through — that glow
        from inside is the whole reason a finished floor looks alive. It does
        not write depth, or the panes on the far side of a storey punch holes
        in the ones in front of them.
      */
      glass: new THREE.MeshPhysicalMaterial({
        color: "#0e141b",
        // Low roughness plus a real environment is what makes a pane read as
        // glass: it has to have something to give back.
        roughness: 0.06,
        metalness: 0.15,
        envMapIntensity: 1.9,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      /** Curtain wall framing: near black, faintly metallic. */
      frame: new THREE.MeshStandardMaterial({ color: "#191c21", roughness: 0.4, metalness: 0.7, envMapIntensity: 1.1 }),
      /*
        Ceiling runs. Unlit and out of the tone mapper so they stay a clean
        warm line however dark the storey around them is.
      */
      lightStrip: new THREE.MeshBasicMaterial({ color: "#ffd9a2", toneMapped: false }),
      fitout: new THREE.MeshStandardMaterial({ color: "#6b6256", roughness: 0.8 }),
      safety: new THREE.MeshStandardMaterial({ color: "#d4632a", roughness: 0.6, metalness: 0.1 }),
      rebar: new THREE.MeshStandardMaterial({ color: "#6a6257", roughness: 0.75, metalness: 0.5 }),
      timber: new THREE.MeshStandardMaterial({ color: "#7d7263", roughness: 0.9 }),
      plinth: new THREE.MeshStandardMaterial({ color: "#14161a", roughness: 0.4, metalness: 0.4, envMapIntensity: 0.7 }),
      /*
        The deck people work on. Textured, because it is the largest surface
        in the hero frame and a flat slab there is the flattest thing in the
        shot; and rough, because a polished plinth under a construction site
        is a showroom floor.
      */
      plinthTop: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        map: siteDeckTexture(17),
        roughness: 0.82,
        metalness: 0.05,
        envMapIntensity: 0.4,
      }),
    };
  }, []);

  return (
    <group>
      <Plinth base={base} materials={materials} />
      <HoverGlow site={site} animate={animate} />
      <FloorPicker site={site} build={build} onSelect={onSelectFloor} />
      <SlabEdge site={site} />
      <FloorTag site={site} />
      {groups.map((group) => (
        <PartGroup
          key={group.material}
          items={group.items}
          storeys={group.storeys}
          tint={HOVER_TINT[group.material]}
          material={materials[group.material as keyof typeof materials]}
          casts={CASTS_SHADOW.has(group.material)}
          order={TRANSPARENT.has(group.material) ? 2 : 0}
          build={build}
          animate={animate}
        />
      ))}
    </group>
  );
}

/**
 * Eases the per-storey highlight, once per frame, before anything reads it.
 *
 * Runs at -9: after the Smoother has advanced construction time and before
 * the default-priority draws that tint themselves from the result, so a
 * storey never lights on one value and outlines on another.
 */
function HoverGlow({ site, animate }: { site: Site; animate: boolean }) {
  const levels = site.floors.length;
  useEffect(() => {
    resetHover(levels);
    return () => resetHover(levels);
  }, [levels, site]);

  useFrame((_, delta) => {
    // Swinging the camera round sweeps the pointer across every storey on
    // the way. Labels firing off behind the drag is noise, not navigation.
    if (orbit.dragging) hover.index = -1;
    const glow = hover.glow;
    for (let i = 0; i < levels; i++) {
      const want = hover.index === i ? 1 : 0;
      const at = glow[i] ?? 0;
      glow[i] = animate ? THREE.MathUtils.damp(at, want, 9, delta) : want;
    }
  }, -9);
  return null;
}

/**
 * One instanced draw for every part sharing a material. Parts that have not
 * arrived yet are collapsed to zero scale rather than skipped, so an instance
 * keeps its slot and the buffer never has to be rebuilt mid-scroll.
 */
function PartGroup({
  items,
  storeys,
  tint,
  material,
  casts,
  order,
  build,
  animate,
}: {
  items: Part[];
  /** Storey each instance stands in, parallel to `items`. */
  storeys: number[];
  /** Instance-colour multiplier at full hover, or undefined to stay put. */
  tint?: [number, number, number];
  material: THREE.Material;
  casts: boolean;
  order: number;
  build: RefObject<number>;
  animate: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const swatch = useMemo(() => new THREE.Color(), []);
  /** Sum of the glows written last frame, so a still building writes nothing. */
  const written = useRef(-1);

  // The instance colours exist from the first frame, all white, so the
  // shader is compiled with USE_INSTANCING_COLOR once at startup. Letting
  // `setColorAt` create the attribute on first hover would instead swap the
  // program for every material in the scene mid-interaction.
  useEffect(() => {
    const target = mesh.current;
    if (!target || !tint) return;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < items.length; i++) target.setColorAt(i, white);
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [items, tint]);

  useFrame(() => {
    const target = mesh.current;
    if (!target) return;
    const f = build.current ?? 0;

    // Hover tint. Skipped entirely while nothing is lit, and skipped again
    // once the ease has settled, so the colour buffer is only uploaded on
    // the frames where it actually changed.
    if (tint) {
      let total = 0;
      for (let s = 0; s < hover.glow.length; s++) total += hover.glow[s];
      if (Math.abs(total - written.current) > 0.0005) {
        written.current = total;
        for (let i = 0; i < items.length; i++) {
          const g = hover.glow[storeys[i]] ?? 0;
          swatch.setRGB(1 + (tint[0] - 1) * g, 1 + (tint[1] - 1) * g, 1 + (tint[2] - 1) * g);
          target.setColorAt(i, swatch);
        }
        if (target.instanceColor) target.instanceColor.needsUpdate = true;
      }
    }

    for (let i = 0; i < items.length; i++) {
      const part = items[i];
      const progress = floorProgress(part.floor, f);
      const span = part.growth ?? SETTLE;
      let t = animate ? (progress - part.at) / span : progress >= part.at ? 1 : 0;

      // Taken away again: edge protection comes off as the glazing goes in.
      if (part.offFloor !== undefined && floorProgress(part.offFloor, f) >= (part.offAt ?? 1)) {
        t = 0;
      }

      if (t <= 0) {
        // Not placed yet. Zero scale is the cheapest way to hide one instance.
        dummy.scale.set(0, 0, 0);
        dummy.position.set(part.position[0], part.position[1], part.position[2]);
        dummy.rotation.set(0, part.rotationY, 0);
        dummy.updateMatrix();
        target.setMatrixAt(i, dummy.matrix);
        continue;
      }

      dummy.rotation.set(0, part.rotationY, 0);

      if (part.growth) {
        // Rises out of its own base: the foot stays put on the slab below and
        // the head climbs, which is what casting a column looks like. Running
        // it backwards as you scroll down retracts it the same way.
        const g = t >= 1 ? 1 : easeOutCubic(t);
        const full = part.scale[1];
        const foot = part.position[1] - full / 2;
        dummy.position.set(part.position[0], foot + (full * g) / 2, part.position[2]);
        dummy.scale.set(part.scale[0], full * g, part.scale[2]);
      } else {
        const e = t >= 1 ? 1 : easeOutBack(t);
        const fall = part.drop * (1 - Math.min(1, t));
        dummy.position.set(part.position[0], part.position[1] + fall, part.position[2]);
        // Come in a touch over size and settle back, so a part lands rather
        // than appears.
        const s = t >= 1 ? 1 : 0.88 + 0.12 * e;
        dummy.scale.set(part.scale[0] * s, part.scale[1] * s, part.scale[2] * s);
      }
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, items.length]}
      castShadow={casts}
      receiveShadow
      renderOrder={order}
      frustumCulled={false}
    />
  );
}

/**
 * Invisible pick volumes, one per storey.
 *
 * The building is drawn as instanced boxes, and an instanced draw gives you
 * one object to raycast rather than one per storey — so picking a floor needs
 * its own volume. These are a box per storey at zero opacity: they still
 * raycast, they cost nothing to draw, and they are the thing a hover state
 * would hang off later.
 *
 * A storey is only pickable once its slab is actually down. Clicking thin air
 * where a floor has not been built yet would be worse than not picking at all.
 */
function FloorPicker({
  site,
  build,
  onSelect,
}: {
  site: Site;
  build: RefObject<number>;
  onSelect?: (index: number) => void;
}) {
  const canvas = useThree((s) => s.gl.domElement);
  const boxes = useMemo(
    () =>
      site.floors.map((floor, i) => {
        const { bottom, top } = storey(i);
        return { i, y: (bottom + top) / 2, h: Math.max(0.2, top - bottom), w: floor.width, d: floor.depth };
      }),
    [site],
  );

  // A storey only answers the pointer once it is genuinely finished. Lighting
  // up thin air where a floor has not been built yet would promise something
  // the click cannot deliver.
  const done = (i: number) => floorProgress(i, build.current ?? 0) >= 1;

  // The canvas asks for a grab cursor so the whole scene reads as draggable.
  // Over a storey that is a lie: there is something to open there.
  const setCursor = (value: string) => {
    canvas.style.cursor = value;
  };

  useEffect(
    () => () => {
      hover.index = -1;
      canvas.style.cursor = "";
    },
    [canvas],
  );

  return (
    <group>
      {boxes.map((b) => (
        <mesh
          key={b.i}
          position={[0, b.y, 0]}
          onPointerOver={(e) => {
            if (!done(b.i) || orbit.dragging) return;
            e.stopPropagation();
            hover.index = b.i;
            setCursor("pointer");
          }}
          onPointerOut={() => {
            if (hover.index !== b.i) return;
            hover.index = -1;
            setCursor("");
          }}
          onClick={(e) => {
            if (!done(b.i)) return;
            e.stopPropagation();
            onSelect?.(b.i);
          }}
        >
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A line of light round the slab that caps the hovered storey.
 *
 * Four thin boxes rather than a wireframe: a one-pixel line is exactly the
 * glowing line work this site was rebuilt to get away from, and it would not
 * survive the bloom threshold. A strip with thickness reads as something
 * fitted to the slab edge, catches the pulse, and holds up close.
 */
function SlabEdge({ site }: { site: Site }) {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffc46a",
        toneMapped: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  const bars = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const node = group.current;
    if (!node) return;
    let lit = 0;
    let index = -1;
    for (let i = 0; i < hover.glow.length; i++) {
      if (hover.glow[i] > lit) {
        lit = hover.glow[i];
        index = i;
      }
    }
    if (index < 0 || lit < 0.004) {
      node.visible = false;
      return;
    }
    node.visible = true;
    // The slab that caps this storey, which is the one the eye reads as its
    // ceiling — and the only horizontal line the storey owns on its own.
    const cap = site.floors[Math.min(index + 1, site.floors.length - 1)];
    const y = slabTop(index + 1) - SLAB / 2;
    const hw = cap.width / 2 + 0.03;
    const hd = cap.depth / 2 + 0.03;
    node.position.y = y;
    const ends = bars.current;
    for (let b = 0; b < 4; b++) {
      const bar = ends[b];
      if (!bar) continue;
      const alongX = b < 2;
      const sign = b % 2 === 0 ? 1 : -1;
      if (alongX) {
        bar.position.set(0, 0, sign * hd);
        bar.scale.set(cap.width + 0.06, 1, 1);
      } else {
        bar.position.set(sign * hw, 0, 0);
        bar.scale.set(1, 1, cap.depth + 0.06);
      }
    }
    // A slow breath rather than a blink: the line is a state, not an alert.
    // Kept well under full, because the strip is unlit and outside the tone
    // mapper — at opacity 1 it stops being a line of light on a slab edge
    // and becomes a highlighter stripe drawn over the elevation.
    const pulse = 0.62 + 0.18 * Math.sin(state.clock.elapsedTime * 2.4);
    material.opacity = lit * pulse;
  });

  return (
    <group ref={group} visible={false}>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          material={material}
          renderOrder={3}
          ref={(node) => {
            bars.current[i] = node;
          }}
        >
          <boxGeometry args={[1, SLAB * 0.2, 1]} />
        </mesh>
      ))}
    </group>
  );
}

/** The four plate corners, as signs. */
const CORNERS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * The project name, pinned to the hovered storey in 3D.
 *
 * Anchored to whichever corner of the plate projects furthest right, worked
 * out per frame. On a convex plate that corner is always on the silhouette,
 * so the label leaves the building along its outline and reads out into the
 * black — the near corner, which is the obvious choice, projects into the
 * middle of the elevation and puts the card over the thing it is naming.
 * Running right also keeps it away from the copy column on the left.
 */
function FloorTag({ site }: { site: Site }) {
  const [tag, setTag] = useState(0);
  const [open, setOpen] = useState(false);
  const group = useRef<THREE.Group>(null);
  const shown = useRef(-1);
  const probe = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const i = hover.index;
    if (i !== shown.current) {
      shown.current = i;
      if (i >= 0) setTag(i);
      setOpen(i >= 0);
    }
    const node = group.current;
    if (!node || i < 0) return;
    const floor = site.floors[i];
    const { bottom, top } = storey(i);
    const y = (bottom + top) / 2;
    const hw = floor.width / 2 + 0.3;
    const hd = floor.depth / 2 + 0.3;
    let best = -Infinity;
    let bx = hw;
    let bz = hd;
    for (const [sx, sz] of CORNERS) {
      probe.set(sx * hw, y, sz * hd).project(camera);
      if (probe.x > best) {
        best = probe.x;
        bx = sx * hw;
        bz = sz * hd;
      }
    }
    node.position.set(bx, y, bz);
  });

  const project = projects[tag];
  if (!project) return null;

  return (
    <group ref={group}>
      {/* Kept mounted and faded rather than mounted on hover, so a sweep up
          the building is not a run of DOM mounts. */}
      <Html zIndexRange={[8, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
        <div
          className={
            "flex -translate-y-1/2 items-center whitespace-nowrap transition-all duration-200 ease-out " +
            (open ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0")
          }
        >
          {/* A tick off the slab corner, so the card is tied to the storey
              rather than floating near it. */}
          <span className="h-px w-8 bg-gradient-to-r from-sodium/70 to-sodium/30" />
          <span className="flex items-center gap-3 rounded-full border border-sodium/35 bg-night-deep/85 py-2 pl-3 pr-4 backdrop-blur">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-sodium font-display text-[16px] font-bold leading-none text-night-deep">
              {tag + 1}
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-bold uppercase tracking-wide text-chalk">
                {project.title}
              </span>
              <span className="block text-[11px] text-chalk-dim">
                {project.finished ? "Handed over" : "Fit-out in progress"} — click to open
              </span>
            </span>
          </span>
        </div>
      </Html>
    </group>
  );
}

/**
 * The plinth.
 *
 * The single most useful thing in the reference: it turns a black background
 * from "nothing is there" into "this is a studio shot of a model". It also
 * gives the site somewhere to stand when it arrives, and the building
 * something to be reflected in.
 */
function Plinth({
  base,
  materials,
}: {
  base: ReturnType<typeof plinth>;
  materials: Record<string, THREE.Material>;
}) {
  const { width, depth, height, lip, top, offsetX, offsetZ } = base;
  return (
    <group position={[offsetX, 0, offsetZ]}>
      {/* Lower step, wider, catching the uplights. */}
      <mesh position={[0, top - height - 0.16, 0]} receiveShadow material={materials.plinth}>
        <boxGeometry args={[width + lip * 2, 0.32, depth + lip * 2]} />
      </mesh>
      {/* Upper step, the deck the building stands on. */}
      <mesh position={[0, top - height / 2, 0]} receiveShadow material={materials.plinthTop}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
    </group>
  );
}

/** Small warm uplights set into the plinth, washing the underside of the base slab. */
export function PlinthLights({ site }: { site: Site }) {
  const base = useMemo(() => plinth(site), [site]);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    const hw = base.width / 2 - 0.5;
    const hd = base.depth / 2 - 0.5;
    // Two, not four. Every point light is evaluated for every lit fragment in
    // a forward renderer, and the uplights are a grace note on the base — the
    // emissive discs below carry most of the look on their own.
    out.push([hw, hd]);
    out.push([-hw, hd]);
    return out;
  }, [base]);

  // Eight lit discs round the edge, but only two of them are real lights.
  const discs = useMemo(() => {
    const out: [number, number][] = [];
    const hw = base.width / 2 - 0.5;
    const hd = base.depth / 2 - 0.5;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push([sx * hw, sz * hd]);
        out.push([sx * hw * 0.34, sz * hd]);
      }
    }
    return out;
  }, [base]);

  return (
    <group position={[base.offsetX, 0, base.offsetZ]}>
      {spots.map(([x, z], i) => (
        <pointLight
          key={i}
          position={[x, base.top + 0.12, z]}
          color="#ffb765"
          intensity={1.5}
          distance={4.2}
          decay={2}
        />
      ))}
      {discs.map(([x, z], i) => (
        <mesh key={`l${i}`} position={[x, base.top + 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.13, 12]} />
          <meshBasicMaterial color="#ffcd91" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One warm lamp inside each storey that gets glazed.
 *
 * The emissive ceiling runs give the glow you see through the glass, but they
 * light nothing — without these the fit-out and the core inside a finished
 * floor are black shapes behind a bright line. Intensity follows the glazing
 * in, so a floor warms up as it is handed over rather than snapping on.
 */
export function InteriorLights({ site, build }: { site: Site; build: RefObject<number> }) {
  const lamps = useMemo(() => {
    const out: { key: number; cladBy: number; position: Vec3 }[] = [];
    const levels = site.floors.length;
    for (let index = 0; index < levels; index++) {
      const cladBy = index + CLAD_LAG;
      if (cladBy > levels) continue;
      const { bottom, top } = storey(index);
      out.push({ key: index, cladBy, position: [0, bottom + (top - bottom) * 0.62, 0] });
    }
    return out;
  }, [site]);

  const refs = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(() => {
    const f = build.current ?? 0;
    for (let i = 0; i < lamps.length; i++) {
      const light = refs.current[i];
      if (!light) continue;
      // Pointing at a storey turns its lights up. The glass is left alone —
      // brightening a near-black pane by any sane factor shows nothing, and
      // a floor lit from inside is what being handed over actually looks
      // like through glazing.
      const lit = 1 + 0.75 * (hover.glow[lamps[i].key] ?? 0);
      light.intensity = 26 * lit * smoothstep(0.34, 0.72, floorProgress(lamps[i].cladBy, f));
    }
  });

  return (
    <group>
      {lamps.map((lamp, i) => (
        <pointLight
          key={lamp.key}
          ref={(node) => {
            refs.current[i] = node;
          }}
          position={lamp.position}
          color="#ffc47d"
          intensity={0}
          distance={13}
          decay={2}
        />
      ))}
    </group>
  );
}

export { smoothstep };
