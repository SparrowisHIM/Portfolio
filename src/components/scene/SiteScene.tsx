"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { buildStructure } from "@/lib/structure";
import { palette } from "./materials";
import { Ground } from "./Ground";
import { Structure } from "./Structure";
import { Scaffold } from "./Scaffold";
import { Crane } from "./Crane";
import { Pointer } from "./Pointer";
import { Bursts } from "./Bursts";
import { Dust } from "./Dust";
import { CameraRig } from "./CameraRig";
import { StackGame } from "./StackGame";

type SiteSceneProps = {
  site: Site;
  /** Scroll progress 0..1 across the whole page. */
  progress: RefObject<number>;
  sectionCount: number;
  animate?: boolean;
  /** The intro plays once this is true (the loader has gone). */
  started?: boolean;
  /** Wide screens get the full effect budget. */
  rich?: boolean;
  shiftX?: number;
  shiftY?: number;
  onSelectFloor?: (index: number) => void;
  /** Called once the scene has mounted and drawn. */
  onReady?: () => void;
};

/** Reports the first committed frame. */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(id);
  }, [onReady]);
  return null;
}

/**
 * Scroll is never applied raw. The section value everything reads is damped
 * toward the real one, so a fast scroll still builds in order and nothing
 * jumps. Runs before every other frame callback.
 */
function Smoother({ progress, sectionCount, section, animate }: { progress: RefObject<number>; sectionCount: number; section: RefObject<number>; animate: boolean }) {
  useFrame((_, delta) => {
    const target = (progress.current ?? 0) * (sectionCount - 1);
    const current = section.current ?? target;
    section.current = animate ? THREE.MathUtils.damp(current, target, 5.5, delta) : target;
  }, -10);
  return null;
}

export function SiteScene({
  site,
  progress,
  sectionCount,
  animate = true,
  started = true,
  rich = true,
  shiftX = 0,
  shiftY = 0,
  onSelectFloor,
  onReady,
}: SiteSceneProps) {
  // Bloom is what makes the lines read as light, so a narrow screen keeps
  // it and drops the grain and the vignette instead. It is still the first
  // thing to go on a machine that cannot keep up.
  const [effects, setEffects] = useState(true);
  const section = useRef(0);
  const skeleton = useMemo(() => buildStructure(site), [site]);

  return (
    <Canvas
      dpr={[1, rich ? 1.75 : 1.5]}
      camera={{ position: [30, 12, 30], fov: 43, near: 0.4, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance", localClippingEnabled: true }}
      onCreated={({ gl }) => {
        // Let vertical touch drags scroll the page; horizontal ones orbit.
        gl.domElement.style.touchAction = "pan-y";
      }}
      className="!absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      <color attach="background" args={[palette.void]} />
      <fog attach="fog" args={[palette.void, 26, 95]} />
      <hemisphereLight args={["#4a6390", "#0a0f1a", 1.2]} />
      <directionalLight position={[-20, 40, -10]} intensity={0.6} color="#9db8e6" />
      <Smoother progress={progress} sectionCount={sectionCount} section={section} animate={animate} />
      <Ground />
      <Structure site={site} skeleton={skeleton} section={section} animate={animate} force={rich && animate} onSelectFloor={onSelectFloor} />
      <Scaffold site={site} section={section} animate={animate} />
      <Crane site={site} section={section} animate={animate} />
      <StackGame site={site} animate={animate} />
      <Pointer site={site} animate={animate} />
      <Bursts animate={animate} count={rich ? 480 : 200} />
      <Dust seed={site.seed} color={site.lamp.color} height={site.totalHeight} animate={animate} count={rich ? 260 : 100} />
      <CameraRig site={site} section={section} sectionCount={sectionCount} animate={animate} started={started} shiftX={shiftX} shiftY={shiftY} />
      <PerformanceMonitor bounds={() => [40, 60]} flipflops={2} onDecline={() => setEffects(false)} onFallback={() => setEffects(false)}>
        <AdaptiveDpr pixelated />
      </PerformanceMonitor>
      {effects && (
        <EffectComposer multisampling={rich ? 2 : 0}>
          <Bloom luminanceThreshold={0.42} mipmapBlur intensity={rich ? 1.15 : 1.3} radius={0.72} />
          <Vignette offset={0.25} darkness={rich ? 0.7 : 0.45} />
          {rich ? <Noise opacity={0.035} /> : <></>}
        </EffectComposer>
      )}
      <Ready onReady={onReady} />
    </Canvas>
  );
}
