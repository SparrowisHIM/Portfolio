"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT } from "@/lib/site-generator";

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
};

const INTRO_SECONDS = 2.6;

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function buildKeyframes(site: Site): Keyframe[] {
  const start = Math.atan2(site.crane.position[0], site.crane.position[2]) + 0.9;
  const frames: Keyframe[] = [
    // Ground level: the whole site in view, camera low like a person on the road.
    { lookY: site.totalHeight * 0.42, rise: 2.5, radius: 34, angle: start },
  ];
  site.floors.forEach((floor, i) => {
    frames.push({
      lookY: floor.y + FLOOR_HEIGHT * 0.55,
      rise: 1.6,
      radius: 17,
      angle: start + 0.55 + i * 0.42,
    });
  });
  // Roof: above the unfinished top level, looking slightly down at the crane's slab.
  frames.push({
    lookY: site.topLevel.y + 1.2,
    rise: 4.5,
    radius: 21,
    angle: start + 0.55 + site.floors.length * 0.42 + 0.3,
  });
  return frames;
}

export function CameraRig({ site, progress, animate }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const frames = useMemo(() => buildKeyframes(site), [site]);
  const intro = useRef(animate ? 0 : 1);
  const pointer = useRef({ x: 0, y: 0 });
  const current = useRef<Keyframe | null>(null);
  const look = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const p = progress.current ?? 0;
    const f = p * (frames.length - 1);
    const i = Math.min(frames.length - 2, Math.floor(f));
    const t = f - i;
    const a = frames[i];
    const b = frames[i + 1];
    const target: Keyframe = {
      lookY: lerp(a.lookY, b.lookY, t),
      rise: lerp(a.rise, b.rise, t),
      radius: lerp(a.radius, b.radius, t),
      angle: lerp(a.angle, b.angle, t),
    };

    // Intro: start far and low, ease in to the ground-level shot.
    if (intro.current < 1) {
      intro.current = Math.min(1, intro.current + delta / INTRO_SECONDS);
      const e = easeOutExpo(intro.current);
      target.radius = lerp(target.radius + 55, target.radius, e);
      target.rise = lerp(-1.5, target.rise, e);
      target.angle = lerp(target.angle - 0.7, target.angle, e);
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

    const angle = c.angle + pointer.current.x * 0.08;
    camera.position.set(
      Math.sin(angle) * c.radius,
      c.lookY + c.rise + pointer.current.y * 0.6,
      Math.cos(angle) * c.radius,
    );
    look.current.set(0, c.lookY, 0);
    camera.lookAt(look.current);
  });

  return null;
}
