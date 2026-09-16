"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import type { Site } from "@/lib/site-generator";
import { palette } from "./materials";
import { Ground } from "./Ground";
import { Floors } from "./Floors";
import { Scaffold } from "./Scaffold";
import { Crane } from "./Crane";
import { Yard } from "./Yard";
import { Lamps } from "./Lamps";
import { Sparks } from "./Sparks";
import { WorkLamp } from "./WorkLamp";
import { Dust } from "./Dust";
import { CameraRig } from "./CameraRig";

type SiteSceneProps = {
  site: Site;
  /** Scroll progress 0..1 across the whole page. */
  progress: RefObject<number>;
  sectionCount: number;
  activeFloor: number;
  animate?: boolean;
  /** The intro plays once this is true (the loader has gone). */
  started?: boolean;
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

export function SiteScene({
  site,
  progress,
  sectionCount,
  activeFloor,
  animate = true,
  started = true,
  shiftX = 0,
  shiftY = 0,
  onSelectFloor,
  onReady,
}: SiteSceneProps) {
  // Post-processing is the first thing to go on a machine that cannot keep up.
  const [effects, setEffects] = useState(true);

  // Section value derived from progress, shared by everything on the site.
  const section = useMemo(() => {
    const ref = { current: 0 };
    Object.defineProperty(ref, "current", {
      get: () => (progress.current ?? 0) * (sectionCount - 1),
    });
    return ref as RefObject<number>;
  }, [progress, sectionCount]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [30, 12, 30], fov: 36, near: 0.5, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance", localClippingEnabled: true }}
      onCreated={({ gl }) => {
        // Let vertical touch drags scroll the page; horizontal ones orbit.
        gl.domElement.style.touchAction = "pan-y";
      }}
      className="!absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      <color attach="background" args={[palette.night]} />
      <fog attach="fog" args={[palette.night, 34, 130]} />
      <hemisphereLight args={["#4a6f9e", "#05090f", 1.1]} />
      <directionalLight position={[-25, 40, -15]} intensity={0.5} color="#8fb3e6" />
      <Ground />
      <Floors site={site} activeFloor={activeFloor} section={section} onSelect={onSelectFloor} />
      <Scaffold site={site} section={section} />
      <Crane site={site} section={section} animate={animate} />
      <Yard site={site} section={section} />
      <Lamps site={site} />
      <Sparks site={site} section={section} animate={animate} />
      <WorkLamp site={site} animate={animate} />
      <Dust seed={site.seed} color={site.lamp.color} height={site.totalHeight} animate={animate} />
      <CameraRig
        site={site}
        progress={progress}
        animate={animate}
        started={started}
        shiftX={shiftX}
        shiftY={shiftY}
      />
      <PerformanceMonitor
        bounds={() => [40, 60]}
        flipflops={2}
        onDecline={() => setEffects(false)}
        onFallback={() => setEffects(false)}
      >
        <AdaptiveDpr pixelated />
      </PerformanceMonitor>
      {effects && (
        <EffectComposer multisampling={2}>
          <Bloom luminanceThreshold={0.85} mipmapBlur intensity={0.7} radius={0.6} />
          <Vignette offset={0.22} darkness={0.75} />
          <Noise opacity={0.055} />
        </EffectComposer>
      )}
      <Ready onReady={onReady} />
    </Canvas>
  );
}
