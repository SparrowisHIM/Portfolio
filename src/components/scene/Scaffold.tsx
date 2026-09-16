"use client";

import { useMemo } from "react";
import type { Site } from "@/lib/site-generator";
import { InstancedBoxes, type BoxInstance } from "./InstancedBoxes";
import { plank, steel } from "./materials";

const POLE = 0.09;
const LEDGER = 0.07;

export function Scaffold({ site }: { site: Site }) {
  const poles = useMemo<BoxInstance[]>(
    () =>
      site.poles.map((p) => ({
        position: [p.position[0], p.height / 2, p.position[2]],
        scale: [POLE, p.height, POLE],
      })),
    [site],
  );

  const ledgers = useMemo<BoxInstance[]>(
    () =>
      site.ledgers.map((l) => ({
        position: l.position,
        scale:
          l.axis === "x"
            ? [l.length, LEDGER, LEDGER]
            : [LEDGER, LEDGER, l.length],
      })),
    [site],
  );

  const planks = useMemo<BoxInstance[]>(
    () =>
      site.planks.map((p) => ({
        position: p.position,
        scale:
          p.axis === "x" ? [p.length, 0.06, 0.85] : [0.85, 0.06, p.length],
      })),
    [site],
  );

  return (
    <group>
      <InstancedBoxes items={poles} material={steel} />
      <InstancedBoxes items={ledgers} material={steel} />
      <InstancedBoxes items={planks} material={plank} />
    </group>
  );
}
