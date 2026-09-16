"use client";

import type { Site } from "@/lib/site-generator";

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
              color={site.lamp.color}
              emissive={site.lamp.color}
              emissiveIntensity={3}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            color={site.lamp.color}
            intensity={i === last ? 60 : 28}
            distance={i === last ? 30 : 16}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}
