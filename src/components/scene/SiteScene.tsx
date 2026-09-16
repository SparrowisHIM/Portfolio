"use client";

import { Canvas } from "@react-three/fiber";
import type { Site } from "@/lib/site-generator";
import { palette } from "./materials";
import { Ground } from "./Ground";
import { Floors } from "./Floors";

type SiteSceneProps = {
  site: Site;
};

export function SiteScene({ site }: SiteSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [22, 12, 26], fov: 38, near: 0.5, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ camera }) => camera.lookAt(0, site.totalHeight / 2, 0)}
      className="!absolute inset-0"
    >
      <color attach="background" args={[palette.night]} />
      <fog attach="fog" args={[palette.night, 30, 110]} />
      <hemisphereLight args={["#3b5a86", "#04080f", 0.9]} />
      <directionalLight position={[-20, 40, -10]} intensity={0.35} color="#8fb3e6" />
      <Ground />
      <Floors site={site} />
    </Canvas>
  );
}
