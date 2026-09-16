"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { projects } from "@/lib/projects";
import { randomSeed } from "@/lib/random";
import { generateSite } from "@/lib/site-generator";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SiteSign } from "./overlay/SiteSign";
import { Hero } from "./overlay/Hero";
import { FloorPanel } from "./overlay/FloorPanel";
import { Roof } from "./overlay/Roof";
import { RebuildButton } from "./overlay/RebuildButton";

const SiteScene = dynamic(
  () => import("./scene/SiteScene").then((m) => m.SiteScene),
  { ssr: false },
);

/** Ground level, one section per floor, then the roof. */
const SECTION_COUNT = projects.length + 2;
const FIRST_SEED = 0x2026_0916;

export function SiteExperience() {
  const [seed, setSeed] = useState(FIRST_SEED);
  const site = useMemo(() => generateSite(seed, projects), [seed]);
  const { progress, section } = useScrollProgress(SECTION_COUNT);
  const reduced = useReducedMotion() ?? false;
  const wide = useMediaQuery("(min-width: 768px)");

  const rebuild = useCallback(() => setSeed(randomSeed()), []);

  return (
    <div className="relative">
      <SiteSign />

      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <SiteScene
          site={site}
          progress={progress}
          activeFloor={section - 1}
          animate={!reduced}
          shiftX={wide ? 0.16 : 0}
          shiftY={wide ? 0 : 0.14}
        />
        {/* On small screens the copy sits over the ground, so shade it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-night via-night/75 to-transparent md:hidden"
        />
      </div>

      <div className="relative z-10 -mt-[100vh]">
        <Hero />
        {projects.map((project, i) => (
          <FloorPanel
            key={project.slug}
            project={project}
            number={i + 1}
            active={section === i + 1}
          />
        ))}
        <Roof active={section === SECTION_COUNT - 1} />
      </div>

      <RebuildButton seed={seed} onRebuild={rebuild} />
    </div>
  );
}
