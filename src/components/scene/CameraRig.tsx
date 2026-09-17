"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, HERO } from "@/lib/site-generator";
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
};

type CameraRigProps = {
  site: Site;
  progress: RefObject<number>;
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
  // Swing the orbit across the open face, never behind the scaffolding.
  const sweep = 0.7;
  const start = site.viewAngle - sweep / 2;
  const step = sweep / (site.floors.length + 1);
  const frames: Keyframe[] = [
    // Ground level: arriving at the gate. Eye height on the road outside the
    // hoarding, the banner in the foreground, the tower and crane rising behind.
    { lookY: 6.2, rise: -2.5, radius: HERO.radius, angle: site.viewAngle + HERO.angleOffset },
  ];
  site.floors.forEach((floor, i) => {
    frames.push({
      lookY: floor.y + FLOOR_HEIGHT * 0.55,
      rise: 1.8,
      radius: 26.5,
      angle: start + step * (i + 1),
    });
  });
  // Roof: above the unfinished top level, looking down at the slab on the hook.
  frames.push({
    lookY: site.topLevel.y + 1.5,
    rise: 7,
    radius: 34,
    angle: start + sweep + 0.2,
  });
  return frames;
}

export function CameraRig({
  site,
  progress,
  animate,
  started,
  shiftX = 0,
  shiftY = 0,
}: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const domElement = useThree((s) => s.gl.domElement);
  const frames = useMemo(() => buildKeyframes(site), [site]);
  const intro = useRef(animate ? 0 : 1);
  const pointer = useRef({ x: 0, y: 0 });
  const current = useRef<Keyframe | null>(null);
  const look = useRef(new THREE.Vector3());
  const drag = useRef({ active: false, lastX: 0, target: 0, value: 0 });

  // Drag sideways to walk around the site. Vertical movement stays with scroll.
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
      state.target = THREE.MathUtils.clamp(state.target - dx * 0.004, -0.9, 0.9);
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
    const p = progress.current ?? 0;
    const f = p * (frames.length - 1);
    const i = Math.min(frames.length - 2, Math.floor(f));
    const t = f - i;
    const a = frames[i];
    const b = frames[i + 1];
    // Portrait screens see a narrower slice, so back off to keep the tower in frame.
    const aspect = state.size.width / state.size.height;
    const fit = Math.min(1.4, aspect < 1.2 ? 1.2 / aspect : 1);
    const target: Keyframe = {
      lookY: lerp(a.lookY, b.lookY, t),
      rise: lerp(a.rise, b.rise, t),
      radius: lerp(a.radius, b.radius, t) * fit,
      angle: lerp(a.angle, b.angle, t),
    };

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
      target.radius = lerp(target.radius + 60, target.radius, e);
      target.rise = lerp(target.rise + 6, target.rise, e);
      target.angle = lerp(target.angle - 0.55, target.angle, e);
    }

    // Gentle pointer parallax.
    pointer.current.x = THREE.MathUtils.damp(pointer.current.x, state.pointer.x, 3, delta);
    pointer.current.y = THREE.MathUtils.damp(pointer.current.y, state.pointer.y, 3, delta);

    const smoothing = animate ? 4.5 : 1000;
    const c = current.current ?? { ...target };
    c.lookY = THREE.MathUtils.damp(c.lookY, target.lookY, smoothing, delta);
    c.rise = THREE.MathUtils.damp(c.rise, target.rise, smoothing, delta);
    c.radius = THREE.MathUtils.damp(c.radius, target.radius, smoothing, delta);
    c.angle = THREE.MathUtils.damp(c.angle, target.angle, smoothing, delta);
    current.current = c;

    const d = drag.current;
    d.value = THREE.MathUtils.damp(d.value, d.target, animate ? 6 : 1000, delta);
    const angle = c.angle + pointer.current.x * 0.08 + d.value;
    camera.position.set(
      Math.sin(angle) * c.radius,
      c.lookY + c.rise + pointer.current.y * 0.6,
      Math.cos(angle) * c.radius,
    );
    look.current.set(0, c.lookY, 0);
    camera.lookAt(look.current);
    // Slide along the camera's own axes; orientation stays the same.
    const shift = game.active ? 0 : 1;
    camera.translateX(-c.radius * shiftX * shift);
    camera.translateY(-c.radius * shiftY * shift);
  });

  return null;
}
