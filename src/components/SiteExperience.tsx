"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { projects } from "@/lib/projects";
import { generateSite } from "@/lib/site-generator";

const SiteScene = dynamic(
  () => import("./scene/SiteScene").then((m) => m.SiteScene),
  { ssr: false },
);

export function SiteExperience() {
  const [seed] = useState(20260916);
  const site = useMemo(() => generateSite(seed, projects), [seed]);

  return (
    <div className="relative h-screen w-full">
      <SiteScene site={site} />
    </div>
  );
}
