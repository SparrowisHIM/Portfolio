"use client";

import type { Site } from "@/lib/site-generator";
import { palette } from "./materials";

/** Sodium work lamps: warm point lights with a glowing head. */
export function Lamps({ site }: { site: Site }) {
  const last = site.lamps.length - 1;
  return (
    <group>
      {site.lamps.map((position, i) => (
        <group key={i} position={position}>
          <mesh>
            <boxGeometry args={[0.42, 0.3, 0.2]} />
            <meshStandardMaterial
              color={palette.sodium}
              emissive={palette.sodium}
              emissiveIntensity={3}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            color={palette.sodium}
            intensity={i === last ? 60 : 28}
            distance={i === last ? 30 : 16}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}
