"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, SMAA, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { buildStructure } from "@/lib/structure";
import { toppedOutAt } from "@/lib/construction";
import { palette } from "./materials";
import { Ground } from "./Ground";
import { Atmosphere } from "./Atmosphere";
import { WorkLights } from "./WorkLights";
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

/**
 * Reports the first committed frame — or gives up waiting for one.
 *
 * A background tab does not run animation frames, so a loader gated purely
 * on rAF can sit there for as long as the tab is hidden and the visitor
 * comes back to a black page. The timer is the floor under that.
 */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onReady?.();
    };
    const frame = requestAnimationFrame(finish);
    const timer = window.setTimeout(finish, 2500);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [onReady]);
  return null;
}

/**
 * Scroll is never applied raw. The section value everything reads is damped
 * toward the real one, so a fast scroll still builds in order and nothing
 * jumps. Runs before every other frame callback.
 *
 * It keeps two clocks. `section` follows the scroll both ways and says where
 * the camera stands. `build` is construction time and only ever runs forward:
 * the moment the last level is complete the site is topped out, and from then
 * on `build` walks out to the end of the timeline and stays there. Scrolling
 * back down after that moves the camera over a finished building instead of
 * dismantling it. Only a rebuild starts the clock again.
 *
 * `below` is why a rebuild works. It drops the latch while the page is still
 * scrolled to the top, so for a moment the new site would read as finished
 * before the scroll has come back down. The latch stays open until the build
 * has genuinely been under way again.
 */
function Smoother({
  site,
  progress,
  sectionCount,
  section,
  build,
  topped,
  below,
  animate,
}: {
  site: Site;
  progress: RefObject<number>;
  sectionCount: number;
  section: RefObject<number>;
  build: RefObject<number>;
  topped: RefObject<boolean>;
  below: RefObject<boolean>;
  animate: boolean;
}) {
  const end = sectionCount - 1;
  const toppedAt = useMemo(() => toppedOutAt(site), [site]);
  useFrame((_, delta) => {
    const target = (progress.current ?? 0) * end;
    const current = section.current ?? target;
    const next = animate ? THREE.MathUtils.damp(current, target, 5.5, delta) : target;
    section.current = next;
    if (topped.current) {
      // Finished. Run the last of the glazing in and hold there.
      build.current = animate ? THREE.MathUtils.damp(build.current ?? end, end, 2.2, delta) : end;
    } else {
      build.current = next;
      if (next < toppedAt) below.current = true;
      else if (below.current) topped.current = true;
    }
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
  /** Construction time. Stops when the site tops out — see Smoother. */
  const build = useRef(0);
  const topped = useRef(false);
  const below = useRef(false);
  const skeleton = useMemo(() => buildStructure(site), [site]);

  // A rebuild is a different site, and the latch belongs to the old one.
  useEffect(() => {
    topped.current = false;
    below.current = false;
  }, [site]);

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
      <Smoother site={site} progress={progress} sectionCount={sectionCount} section={section} build={build} topped={topped} below={below} animate={animate} />
      <Atmosphere animate={animate} />
      <Ground />
      <WorkLights site={site} build={build} animate={animate} />
      <Structure site={site} skeleton={skeleton} section={section} build={build} animate={animate} force={rich && animate} onSelectFloor={onSelectFloor} />
      <Scaffold site={site} build={build} animate={animate} />
      <Crane site={site} build={build} animate={animate} />
      <StackGame site={site} animate={animate} />
      <Pointer site={site} animate={animate} />
      <Bursts animate={animate} count={rich ? 480 : 200} />
      <Dust seed={site.seed} color={site.lamp.color} height={site.totalHeight} animate={animate} count={rich ? 260 : 100} />
      <CameraRig site={site} section={section} build={build} sectionCount={sectionCount} animate={animate} started={started} shiftX={shiftX} shiftY={shiftY} />
      <PerformanceMonitor bounds={() => [40, 60]} flipflops={2} onDecline={() => setEffects(false)} onFallback={() => setEffects(false)}>
        <AdaptiveDpr pixelated />
      </PerformanceMonitor>
      {/*
        multisampling MUST stay 0. Any value above it renders the whole
        composer black on Intel UHD through ANGLE/D3D11 — the scene is perfect
        underneath, the output is not. That is the blank building. SMAA does
        the antialiasing instead, in a shader with no MSAA render target: the
        thin steel needs antialiasing more than anything else here.
      */}
      {effects && (
        <EffectComposer multisampling={0}>
          <SMAA />
          {/*
            Threshold high, radius tight. At 0.42 every dim member bloomed and
            the halos filled the gaps between them, so the frame lost its
            blacks: 73% of it was mid-grey and the glass read as milk. Only
            what is genuinely lit — slab edges, lamps, the sodium on the
            active floor — should throw light into the void.
          */}
          <Bloom luminanceThreshold={0.62} mipmapBlur intensity={rich ? 0.85 : 1.0} radius={0.5} />
          <Vignette offset={0.25} darkness={rich ? 0.7 : 0.45} />
          {rich ? <Noise opacity={0.035} /> : <></>}
        </EffectComposer>
      )}
      <Ready onReady={onReady} />
    </Canvas>
  );
}
