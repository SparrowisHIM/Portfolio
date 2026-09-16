"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { projects } from "@/lib/projects";
import { generateSite } from "@/lib/site-generator";
import { useScrollProgress } from "@/hooks/useScrollProgress";

const SiteScene = dynamic(
  () => import("./scene/SiteScene").then((m) => m.SiteScene),
  { ssr: false },
);

/** Ground level, one section per floor, then the roof. */
const SECTION_COUNT = projects.length + 2;

export function SiteExperience() {
  const [seed] = useState(20260916);
  const site = useMemo(() => generateSite(seed, projects), [seed]);
  const { progress, section } = useScrollProgress(SECTION_COUNT);

  return (
    <div className="relative">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <SiteScene site={site} progress={progress} />
      </div>

      <div className="relative -mt-[100vh]" aria-live="off">
        {Array.from({ length: SECTION_COUNT }, (_, i) => (
          <section key={i} className="flex h-screen items-center px-6">
            <p className="text-chalk-dim">
              Section {i} {section === i ? "(active)" : ""}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
