"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, HERO } from "@/lib/site-generator";
import { floorProgress, smoothstep } from "@/lib/construction";
import { game, stackTop } from "@/lib/stack-game";

type Keyframe = {
  /** Height the camera looks at. */
  lookY: number;
  /** Camera height above the look point. */
  rise: number;
  /** Orbit radius. */
  radius: number;
  /** Orbit angle in radians. */
  angle: number;
  /**
   * How much of the portrait correction this shot wants, 0 to 1. A floor
   * plate is a wide subject and needs the camera back on a narrow screen;
   * the finished tower is tall and barely does.
   */
  fit: number;
};

type CameraRigProps = {
  site: Site;
  /** Smoothed section value: 0 ground, 1..N floors, N+1 roof. */
  section: RefObject<number>;
  sectionCount: number;
  /** When false the camera snaps to its target instead of easing. */
  animate: boolean;
  /** The intro fly-in waits until the loader is gone. */
  started: boolean;
  /**
   * Fraction of the orbit radius to slide the camera sideways, so the tower
   * sits beside the text column instead of behind it.
   */
  shiftX?: number;
  /** Fraction of the orbit radius to slide the camera down, lifting the tower on screen. */
  shiftY?: number;
};

const INTRO_SECONDS = 2.6;

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function buildKeyframes(site: Site): Keyframe[] {
  // Walk round the open face as the stack grows. The swing is wide enough
  // that the massing reads through parallax — setbacks, the cantilever and
  // the twist only show when the silhouette changes as you climb.
  const sweep = 0.95;
  const start = site.viewAngle - sweep / 2;
  const step = sweep / (site.floors.length + 1);
  const frames: Keyframe[] = [
    // Ground level: low and close, the first lines large in the frame.
    { lookY: 3.4, rise: 0.4, radius: HERO.radius, angle: site.viewAngle + HERO.angleOffset, fit: 0.85 },
  ];
  // Floors: from about twenty degrees up at the bottom, flattening as the
  // stack grows so the upper floors read in silhouette rather than plan.
  site.floors.forEach((floor, i) => {
    frames.push({
      lookY: floor.y - FLOOR_HEIGHT * 0.45,
      rise: 8.2 + i * 0.35,
      radius: 25.5 + i * 1.9,
      angle: start + step * (i + 1),
      fit: 1,
    });
  });
  // Roof: the whole thing at last. Back off far enough that the tower reads
  // base to hook — the massing, the crane and the frame still on the line.
  frames.push({
    lookY: site.totalHeight * 0.62,
    rise: 7,
    radius: 52,
    angle: start + sweep + 0.15,
    fit: 1,
  });
  return frames;
}

/**
 * Scroll guides the camera: it starts low, rises with the build, drifts
 * round the open face, comes in on the floor being built and pulls back as
 * that floor completes. Drag adds a little orbit; the pointer adds parallax.
 */
export function CameraRig({ site, section, sectionCount, animate, started, shiftX = 0, shiftY = 0 }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const domElement = useThree((s) => s.gl.domElement);
  const frames = useMemo(() => buildKeyframes(site), [site]);
  const intro = useRef(animate ? 0 : 1);
  const pointer = useRef({ x: 0, y: 0 });
  const current = useRef<Keyframe | null>(null);
  const look = useRef(new THREE.Vector3());
  const drag = useRef({ active: false, lastX: 0, target: 0, value: 0 });

  // Drag sideways to walk round the site a little. Vertical movement stays with scroll.
  useEffect(() => {
    const state = drag.current;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || game.active) return;
      state.active = true;
      state.lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!state.active) return;
      const dx = e.clientX - state.lastX;
      state.lastX = e.clientX;
      state.target = THREE.MathUtils.clamp(state.target - dx * 0.003, -0.45, 0.45);
    };
    const up = () => {
      state.active = false;
    };
    domElement.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      domElement.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [domElement]);

  useFrame((state, delta) => {
    const f = section.current ?? 0;
    const i = Math.min(frames.length - 2, Math.max(0, Math.floor(f)));
    const t = f - i;
    const a = frames[i];
    const b = frames[i + 1];
    // Portrait screens see a narrower slice. How far to back off depends on
    // the shot: each keyframe says how much of the correction it wants.
    const aspect = state.size.width / state.size.height;
    // A portrait shot crops the sides of a floor plate rather than backing
    // off until the tower is a thumbnail: close and cropped reads, distant
    // and complete does not.
    const need = aspect < 1.3 ? THREE.MathUtils.clamp(1.3 / aspect, 1, 1.35) : 1;
    const fit = 1 + (need - 1) * lerp(a.fit, b.fit, t);
    const target: Keyframe = {
      lookY: lerp(a.lookY, b.lookY, t),
      rise: lerp(a.rise, b.rise, t),
      radius: lerp(a.radius, b.radius, t) * fit,
      // A narrow screen cannot afford to walk round onto a scaffolded face,
      // so it keeps most of the swing but stays near the clear view angle.
      angle: site.viewAngle + (lerp(a.angle, b.angle, t) - site.viewAngle) * (aspect < 1.3 ? 0.55 : 1),
      fit,
    };

    // Come in while a floor is being framed, pull back as it completes.
    const active = Math.round(f);
    if (active >= 1 && active < sectionCount - 1) {
      const p = floorProgress(active, f);
      const framing = smoothstep(0.2, 0.62, p) * (1 - smoothstep(0.66, 0.95, p));
      const done = smoothstep(0.66, 0.98, p);
      target.radius *= 1 - 0.12 * framing + 0.16 * done;
      target.rise += 0.6 * done;
    }

    // Night shift: hold on the top of the stack and drift slowly round it.
    if (game.active) {
      const roof = frames[frames.length - 1];
      target.lookY = stackTop() - 0.6;
      target.rise = 3.2;
      target.radius = (20 + game.score * 0.25) * fit;
      target.angle = roof.angle - 0.3 + Math.sin(game.time * 0.12) * 0.35;
    }

    // Intro: start far and low, ease in to the ground-level shot.
    if (intro.current < 1) {
      if (started) intro.current = Math.min(1, intro.current + delta / INTRO_SECONDS);
      const e = easeOutExpo(intro.current);
      target.radius = lerp(target.radius + 40, target.radius, e);
      target.rise = lerp(target.rise + 4, target.rise, e);
      target.angle = lerp(target.angle - 0.5, target.angle, e);
    }

    // Gentle pointer parallax.
    pointer.current.x = THREE.MathUtils.damp(pointer.current.x, state.pointer.x, 3, delta);
    pointer.current.y = THREE.MathUtils.damp(pointer.current.y, state.pointer.y, 3, delta);

    const smoothing = animate ? 3.5 : 1000;
    const c = current.current ?? { ...target };
    c.lookY = THREE.MathUtils.damp(c.lookY, target.lookY, smoothing, delta);
    c.rise = THREE.MathUtils.damp(c.rise, target.rise, smoothing, delta);
    c.radius = THREE.MathUtils.damp(c.radius, target.radius, smoothing, delta);
    c.angle = THREE.MathUtils.damp(c.angle, target.angle, smoothing, delta);
    current.current = c;

    const d = drag.current;
    d.value = THREE.MathUtils.damp(d.value, d.target, animate ? 6 : 1000, delta);
    const angle = c.angle + pointer.current.x * 0.06 + d.value;
    camera.position.set(Math.sin(angle) * c.radius, c.lookY + c.rise + pointer.current.y * 0.5, Math.cos(angle) * c.radius);
    look.current.set(0, c.lookY, 0);
    camera.lookAt(look.current);
    // Slide along the camera's own axes; orientation stays the same.
    const shift = game.active ? 0 : 1;
    camera.translateX(-c.radius * shiftX * shift);
    camera.translateY(-c.radius * shiftY * shift);
  });

  return null;
}
