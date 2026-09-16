"use client";

import type { RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import type { Site } from "@/lib/site-generator";
import { palette } from "./materials";
import { Ground } from "./Ground";
import { Floors } from "./Floors";
import { Scaffold } from "./Scaffold";
import { Crane } from "./Crane";
import { Lamps } from "./Lamps";
import { Dust } from "./Dust";
import { CameraRig } from "./CameraRig";

type SiteSceneProps = {
  site: Site;
  progress: RefObject<number>;
  activeFloor: number;
  animate?: boolean;
  shiftX?: number;
  shiftY?: number;
};

export function SiteScene({
  site,
  progress,
  activeFloor,
  animate = true,
  shiftX = 0,
  shiftY = 0,
}: SiteSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [30, 12, 30], fov: 36, near: 0.5, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <color attach="background" args={[palette.night]} />
      <fog attach="fog" args={[palette.night, 34, 130]} />
      <hemisphereLight args={["#4a6f9e", "#05090f", 1.1]} />
      <directionalLight
        position={[-25, 40, -15]}
        intensity={0.5}
        color="#8fb3e6"
      />
      <Ground />
      <Floors key={site.seed} site={site} activeFloor={activeFloor} animate={animate} />
      <Scaffold site={site} />
      <Crane site={site} animate={animate} />
      <Lamps site={site} />
      <Dust seed={site.seed} height={site.totalHeight} animate={animate} />
      <CameraRig
        site={site}
        progress={progress}
        animate={animate}
        shiftX={shiftX}
        shiftY={shiftY}
      />
    </Canvas>
  );
}
