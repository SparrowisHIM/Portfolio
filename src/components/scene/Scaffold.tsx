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

const STANDARD = 0.05;
const LEDGER = 0.032;
const ROW = 0.9;

type ScaffoldProps = {
  site: Site;
  section: RefObject<number>;
  animate: boolean;
};

type RunParts = {
  tubes: Instance[];
  joints: Instance[];
  net?: { origin: Vec3; u: Vec3; width: number; height: number; nx: number; ny: number };
};

/** A run of scaffold as pure line work: standards, ledgers, transoms, bracing, joints. */
function buildRun(run: ScaffoldRun): RunParts {
  const { side, span, offset, bays, height, lifts } = run;
  const tubes: Instance[] = [];
  const joints: Instance[] = [];
  const at = (along: number, out: number, y: number) => onSide(side, along, out, y);
  const step = span / bays;
  const along = (i: number) => -span / 2 + i * step;
  const rows = [offset, offset + ROW];

  for (let i = 0; i <= bays; i++) {
    tubes.push(post(at(along(i), rows[1], 0), height - (i % 3 === 1 ? 0.4 : 0), STANDARD));
    // The inner row is braced at every third bay only; a standard at every
    // bay on both rows buries the frame behind it.
    if (i % 3 === 0) tubes.push(post(at(along(i), rows[0], 0), height, STANDARD * 0.8));
  }
  // Density is hierarchy, not uniformity. The outer row carries a ledger at
  // every lift because that face is what reads as scaffold; the inner row
  // and the transoms are thinned so you can see the frame through the run,
  // which matters now the camera stands close enough to look through it.
  for (let l = 1; l <= lifts; l++) {
    const y = l * LIFT;
    tubes.push(strut(at(-span / 2 - 0.15, rows[1], y), at(span / 2 + 0.15, rows[1], y), LEDGER));
    if (l % 2 === 0) tubes.push(strut(at(-span / 2 - 0.15, rows[0], y), at(span / 2 + 0.15, rows[0], y), LEDGER));
    for (let i = 0; i <= bays; i += 2) {
      tubes.push(strut(at(along(i), offset - 0.1, y), at(along(i), offset + ROW + 0.1, y), LEDGER));
      if (l % 2 === 1) joints.push(box(at(along(i), rows[1], y), [0.09, 0.09, 0.09]));
    }
    for (let i = 0; i < bays; i += 2) {
      const flip = (i / 2 + l) % 2 === 0;
      if (l < lifts) tubes.push(strut(at(along(flip ? i : i + 1), offset + ROW + 0.05, y), at(along(flip ? i + 1 : i), offset + ROW + 0.05, y + LIFT), 0.028));
    }
  }

  let net: RunParts["net"];
  if (run.netted) {
    const a = at(-span / 2, offset + ROW + 0.14, height - 0.35);
    const b = at(span / 2, offset + ROW + 0.14, height - 0.35);
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    net = {
      origin: a,
      u: [(b[0] - a[0]) / len, 0, (b[2] - a[2]) / len],
      width: span,
      height: height - 0.8,
      nx: Math.max(8, Math.round(span / 0.55)),
      ny: Math.max(8, Math.round((height - 0.8) / 0.55)),
    };
  }
  return { tubes, joints, net };
}

/** Scaffolding climbs with the building: everything above the built height is clipped. */
export function Scaffold({ site, section, animate }: ScaffoldProps) {
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 4));
  const clipTop = useRef(4);
  const mats = useMemo(() => {
    const clip = [plane.current];
    return {
      tube: new THREE.MeshStandardMaterial({ color: "#1b2230", emissive: "#161d2c", emissiveIntensity: 0.05, roughness: 0.4, metalness: 0.6, clippingPlanes: clip }),
      joint: new THREE.MeshStandardMaterial({ color: "#39435a", emissive: "#2e3750", emissiveIntensity: 0.09, roughness: 0.5, metalness: 0.4, clippingPlanes: clip }),
    };
  }, []);
  const netMaterials = useMemo(
    () =>
      site.scaffolds.map(
        () =>
          new THREE.MeshStandardMaterial({
            color: "#0c1320",
            map: nettingTexture("#2a3a55"),
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            depthWrite: false,
            roughness: 0.95,
          }),
      ),
    [site],
  );

  useFrame((_, delta) => {
    const top = builtHeight(site, section.current ?? 0) - 0.9;
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
          <Instances items={run.joints} material={mats.joint} />
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
