"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ScaffoldRun, Site } from "@/lib/site-generator";
import { LIFT, onSide } from "@/lib/site-generator";
import { builtHeight } from "@/lib/construction";
import { post, strut, type Instance } from "@/lib/geometry";
import { Instances } from "./Instances";

const STANDARD = 0.04;
const LEDGER = 0.028;
const ROW = 0.9;
/** How far below the work the boarded lift reaches, in metres. */
const WORKING_BAND = 5.5;

type ScaffoldProps = {
  site: Site;
  section: RefObject<number>;
  animate: boolean;
};

type RunParts = {
  /** Standards run the full height: thin verticals read as rhythm, not mesh. */
  posts: Instance[];
  /** Everything else only exists on the working lift near the top. */
  tubes: Instance[];
};

/**
 * One run of scaffold, in two parts.
 *
 * Full-height ledgers and bracing turn the run into a mesh, and a mesh in
 * front of a frame drawn in 4cm steel simply hides it. A real run is struck
 * as the floors below are finished anyway, so only the standards go all the
 * way down; everything that makes it dense lives on the working lift near
 * the top and is clipped away below.
 */
function buildRun(run: ScaffoldRun): RunParts {
  const { side, span, offset, bays, height, lifts } = run;
  const posts: Instance[] = [];
  const tubes: Instance[] = [];
  const at = (along: number, out: number, y: number) => onSide(side, along, out, y);
  const step = span / bays;
  const along = (i: number) => -span / 2 + i * step;
  const outer = offset + ROW;

  for (let i = 0; i <= bays; i++) {
    posts.push(post(at(along(i), outer, 0), height - (i % 3 === 1 ? 0.4 : 0), STANDARD));
  }
  for (let l = 1; l <= lifts; l++) {
    const y = l * LIFT;
    if (l % 2 === 0) tubes.push(strut(at(-span / 2 - 0.15, outer, y), at(span / 2 + 0.15, outer, y), LEDGER));
    for (let i = 0; i <= bays; i += 3) {
      tubes.push(strut(at(along(i), offset - 0.1, y), at(along(i), outer + 0.1, y), LEDGER));
    }
    for (let i = 0; i < bays; i += 4) {
      if (l < lifts) tubes.push(strut(at(along(i), outer + 0.05, y), at(along(i + 1), outer + 0.05, y + LIFT), 0.024));
    }
  }
  return { posts, tubes };
}

/** Scaffolding climbs with the building: everything above the built height is clipped. */
export function Scaffold({ site, section }: ScaffoldProps) {
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 4));
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const mats = useMemo(() => {
    const top = [plane.current];
    const band = [plane.current, floorPlane.current];
    return {
      post: new THREE.MeshStandardMaterial({ color: "#1e2635", emissive: "#18202f", emissiveIntensity: 0.06, roughness: 0.4, metalness: 0.6, clippingPlanes: top }),
      tube: new THREE.MeshStandardMaterial({ color: "#1b2230", emissive: "#161d2c", emissiveIntensity: 0.05, roughness: 0.4, metalness: 0.6, clippingPlanes: band }),
    };
  }, []);
  useFrame((_, delta) => {
    const top = builtHeight(site, section.current ?? 0) - 0.9;
    plane.current.constant = THREE.MathUtils.damp(plane.current.constant, top, 5, delta);
    // Keeps points above the floor of the working lift.
    floorPlane.current.constant = -Math.max(0, plane.current.constant - WORKING_BAND);
  });

  // One run only. A second run on another face doubles the line count and
  // is almost always the one standing between the camera and the building.
  const runs = useMemo(() => site.scaffolds.slice(0, 1).map(buildRun), [site]);

  return (
    <group>
      {runs.map((run, i) => (
        <group key={i}>
          <Instances items={run.posts} material={mats.post} />
          <Instances items={run.tubes} material={mats.tube} />
        </group>
      ))}
    </group>
  );
}
