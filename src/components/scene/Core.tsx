"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { FLOOR_HEIGHT, SLAB_THICKNESS } from "@/lib/site-generator";
import { coreHeight } from "@/lib/construction";
import { box, post, strut, type Instance } from "@/lib/geometry";
import { Instances } from "./Instances";
import { game } from "@/lib/stack-game";
import { materials } from "./materials";

type CoreProps = {
  site: Site;
  section: RefObject<number>;
};

/**
 * The lift and stair core: a slip-formed concrete shaft that runs a storey
 * ahead of the steel, with the climbing formwork rig riding on top of it.
 */
export function Core({ site, section }: CoreProps) {
  const m = materials();
  const { core } = site;
  const shaft = useRef<THREE.Mesh>(null);
  const rig = useRef<THREE.Group>(null);
  const doors = useRef<THREE.Group>(null);
  const height = useRef(FLOOR_HEIGHT);

  const rigParts = useMemo(() => {
    const w = core.width + 0.7;
    const d = core.depth + 0.7;
    const items: Instance[] = [];
    // Working platform around the shaft, with handrails and shutter panels.
    items.push(box([0, 0, 0], [w, 0.12, d]));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        items.push(post([(sx * w) / 2, 0, (sz * d) / 2], 1.1, 0.04));
      }
    }
    for (const sx of [-1, 1]) {
      items.push(strut([(sx * w) / 2, 1.05, -d / 2], [(sx * w) / 2, 1.05, d / 2], 0.035));
      items.push(strut([-w / 2, 1.05, (sx * d) / 2], [w / 2, 1.05, (sx * d) / 2], 0.035));
      items.push(strut([(sx * w) / 2, 0.55, -d / 2], [(sx * w) / 2, 0.55, d / 2], 0.03));
      items.push(strut([-w / 2, 0.55, (sx * d) / 2], [w / 2, 0.55, (sx * d) / 2], 0.03));
    }
    // Shutter panels, a little taller than the pour, with walers across them.
    const shutters: Instance[] = [
      box([(core.width + 0.1) / 2, 0.55, 0], [0.05, 1.3, core.depth + 0.12]),
      box([-(core.width + 0.1) / 2, 0.55, 0], [0.05, 1.3, core.depth + 0.12]),
      box([0, 0.55, (core.depth + 0.1) / 2], [core.width + 0.12, 1.3, 0.05]),
      box([0, 0.55, -(core.depth + 0.1) / 2], [core.width + 0.12, 1.3, 0.05]),
    ];
    for (const y of [0.25, 0.85]) {
      items.push(box([(core.width + 0.22) / 2, y, 0], [0.07, 0.07, core.depth + 0.3]));
      items.push(box([-(core.width + 0.22) / 2, y, 0], [0.07, 0.07, core.depth + 0.3]));
      items.push(box([0, y, (core.depth + 0.22) / 2], [core.width + 0.3, 0.07, 0.07]));
      items.push(box([0, y, -(core.depth + 0.22) / 2], [core.width + 0.3, 0.07, 0.07]));
    }
    return { items, shutters };
  }, [core]);

  const doorLevels = useMemo(
    () => site.floors.map((floor) => floor.y + SLAB_THICKNESS),
    [site],
  );

  useFrame((_, delta) => {
    const target = coreHeight(site, section.current ?? 0);
    height.current = THREE.MathUtils.damp(height.current, target, 5, delta);
    const h = height.current;
    if (shaft.current) {
      shaft.current.scale.y = h;
      shaft.current.position.y = h / 2;
    }
    if (rig.current) {
      rig.current.position.y = h + 0.06;
      rig.current.visible = !(game.active && game.blocks.length > 1);
    }
    if (doors.current) {
      doors.current.children.forEach((door, i) => {
        door.visible = doorLevels[i] + 2.2 < h;
      });
    }
  });

  return (
    <group position={[core.x, 0, core.z]}>
      <mesh ref={shaft} material={m.concreteDark}>
        <boxGeometry args={[core.width, 1, core.depth]} />
      </mesh>
      {/* Lift door openings on the face that looks out at the visitor. */}
      <group ref={doors}>
        {doorLevels.map((y, i) => (
          <mesh key={i} position={[0, y + 1.1, (core.depth / 2 + 0.01) * Math.sign(-core.z || 1)]} rotation={[0, core.z > 0 ? Math.PI : 0, 0]}>
            <planeGeometry args={[0.95, 2.2]} />
            <meshStandardMaterial color="#05090f" roughness={1} />
          </mesh>
        ))}
      </group>
      <group ref={rig}>
        <Instances items={rigParts.items} material={m.crane} frustumCulled={false} />
        <Instances items={rigParts.shutters} material={m.plank} frustumCulled={false} />
      </group>
    </group>
  );
}
