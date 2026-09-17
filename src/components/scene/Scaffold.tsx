"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ScaffoldRun, Site } from "@/lib/site-generator";
import { LIFT, onSide } from "@/lib/site-generator";
import { builtHeight } from "@/lib/construction";
import { box, post, strut, type Instance, type Vec3 } from "@/lib/geometry";
import { nettingTexture } from "@/lib/textures";
import { Cloth } from "./Cloth";
import { Instances } from "./Instances";

const STANDARD = 0.075;
const LEDGER = 0.05;
const ROW = 0.9;

type ScaffoldProps = {
  site: Site;
  section: RefObject<number>;
  animate: boolean;
};

type RunParts = {
  tubes: Instance[];
  clamps: Instance[];
  boards: Instance[];
  plates: Instance[];
  net?: { origin: Vec3; u: Vec3; width: number; height: number; nx: number; ny: number };
};

function buildRun(run: ScaffoldRun): RunParts {
  const { side, span, offset, bays, height, lifts, boarded, ladderBay } = run;
  const tubes: Instance[] = [];
  const clamps: Instance[] = [];
  const boards: Instance[] = [];
  const plates: Instance[] = [];
  const at = (along: number, out: number, y: number) => onSide(side, along, out, y);
  const step = span / bays;
  const along = (i: number) => -span / 2 + i * step;
  const rows = [offset, offset + ROW];

  // Standards on base plates and sole boards.
  for (let i = 0; i <= bays; i++) {
    for (const out of rows) {
      tubes.push(post(at(along(i), out, 0), height - (i % 3 === 1 ? 0.4 : 0), STANDARD));
      plates.push(box(at(along(i), out, 0.02), [0.16, 0.04, 0.16]));
      boards.push(box(at(along(i), out, 0.02), run.horizontal ? [0.55, 0.03, 0.24] : [0.24, 0.03, 0.55]));
    }
  }

  for (let l = 1; l <= lifts; l++) {
    const y = l * LIFT;
    // Ledgers along both rows, transoms across at every standard.
    for (const out of rows) {
      tubes.push(strut(at(-span / 2 - 0.15, out, y), at(span / 2 + 0.15, out, y), LEDGER));
    }
    for (let i = 0; i <= bays; i++) {
      tubes.push(strut(at(along(i), offset - 0.12, y), at(along(i), offset + ROW + 0.12, y), LEDGER));
      for (const out of rows) clamps.push(box(at(along(i), out, y), [0.13, 0.13, 0.13]));
    }
    // Face bracing on the outer row, every other bay, alternating direction.
    for (let i = 0; i < bays; i += 2) {
      const flip = (i / 2 + l) % 2 === 0;
      const a0 = along(flip ? i : i + 1);
      const a1 = along(flip ? i + 1 : i);
      if (l < lifts) tubes.push(strut(at(a0, offset + ROW + 0.08, y), at(a1, offset + ROW + 0.08, y + LIFT), 0.045));
    }
    if (boarded.includes(l)) {
      // Four boards across the lift, a toe board and a mid guardrail outside.
      for (let k = 0; k < 4; k++) {
        const out = offset + 0.12 + k * 0.22;
        boards.push(box(at(0, out, y + 0.05), run.horizontal ? [span, 0.04, 0.2] : [0.2, 0.04, span]));
      }
      boards.push(box(at(0, offset + ROW + 0.06, y + 0.14), run.horizontal ? [span, 0.16, 0.03] : [0.03, 0.16, span]));
      tubes.push(strut(at(-span / 2, offset + ROW, y + 0.62), at(span / 2, offset + ROW, y + 0.62), 0.035));
    }
  }

  // Ladders in one bay, lift to lift.
  const lx = along(ladderBay) + step * 0.5;
  for (const dx of [-0.2, 0.2]) {
    tubes.push(strut(at(lx + dx, offset + 0.45, 0.1), at(lx + dx, offset + 0.45, height - 0.4), 0.03));
  }
  for (let y = 0.3; y < height - 0.5; y += 0.3) {
    tubes.push(strut(at(lx - 0.2, offset + 0.45, y), at(lx + 0.2, offset + 0.45, y), 0.025));
  }

  let net: RunParts["net"];
  if (run.netted) {
    const a = at(-span / 2, offset + ROW + 0.16, height - 0.35);
    const b = at(span / 2, offset + ROW + 0.16, height - 0.35);
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    net = {
      origin: a,
      u: [(b[0] - a[0]) / len, 0, (b[2] - a[2]) / len],
      width: span,
      height: height - 0.8,
      nx: Math.max(8, Math.round(span / 0.5)),
      ny: Math.max(8, Math.round((height - 0.8) / 0.5)),
    };
  }

  return { tubes, clamps, boards, plates, net };
}

/** Scaffolding climbs with the building: everything above the built height is clipped. */
export function Scaffold({ site, section, animate }: ScaffoldProps) {
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 4));
  const clipTop = useRef(4);
  const mats = useMemo(() => {
    const clip = [plane.current];
    return {
      tube: new THREE.MeshStandardMaterial({ color: "#aeb6c2", roughness: 0.38, metalness: 0.8, clippingPlanes: clip }),
      clamp: new THREE.MeshStandardMaterial({ color: "#4c5563", roughness: 0.55, metalness: 0.65, clippingPlanes: clip }),
      plank: new THREE.MeshStandardMaterial({ color: "#8c7351", roughness: 0.9, clippingPlanes: clip }),
      plate: new THREE.MeshStandardMaterial({ color: "#3a4250", roughness: 0.7, metalness: 0.5, clippingPlanes: clip }),
    };
  }, []);
  const netMaterials = useMemo(
    () =>
      site.scaffolds.map(
        () =>
          new THREE.MeshStandardMaterial({
            map: nettingTexture("#3ddc84"),
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
            depthWrite: false,
            roughness: 0.95,
          }),
      ),
    [site],
  );

  useFrame((_, delta) => {
    const top = builtHeight(site, section.current ?? 0) + 1.6;
    plane.current.constant = THREE.MathUtils.damp(plane.current.constant, top, 5, delta);
    clipTop.current = plane.current.constant;
  });

  const runs = useMemo(() => site.scaffolds.map(buildRun), [site]);
  const down = useMemo<Vec3>(() => [0, -1, 0], []);
  const pin = useMemo(() => ({ top: true, every: 3 }), []);

  return (
    <group>
      {runs.map((run, i) => (
        <group key={i}>
          <Instances items={run.tubes} material={mats.tube} />
          <Instances items={run.clamps} material={mats.clamp} />
          <Instances items={run.boards} material={mats.plank} />
          <Instances items={run.plates} material={mats.plate} />
          {run.net && (
            <Cloth
              origin={run.net.origin}
              u={run.net.u}
              v={down}
              width={run.net.width}
              height={run.net.height}
              nx={run.net.nx}
              ny={run.net.ny}
              pin={pin}
              material={netMaterials[i]}
              windScale={0.7}
              gravity={1.8}
              animate={animate}
              clipAbove={clipTop}
            />
          )}
        </group>
      ))}
    </group>
  );
}
