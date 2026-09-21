"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { projects, type Project } from "@/lib/projects";
import { randomSeed } from "@/lib/random";
import { HERO, generateSite } from "@/lib/site-generator";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SiteSign } from "./overlay/SiteSign";
import { Hero } from "./overlay/Hero";
import { FloorPanel } from "./overlay/FloorPanel";
import { Roof } from "./overlay/Roof";
import { RebuildButton } from "./overlay/RebuildButton";
import { FloorRail } from "./overlay/FloorRail";
import { ClimbRule } from "./overlay/ClimbRule";
import { SheetFrame } from "./overlay/SheetFrame";
import { TitleBlock } from "./overlay/TitleBlock";
import { FloorSchedule } from "./overlay/FloorSchedule";
import { Loader } from "./overlay/Loader";
import { WalkIn } from "./overlay/WalkIn";
import { NightShift } from "./overlay/NightShift";
import { endGame, startGame } from "@/lib/stack-game";

const SiteScene = dynamic(
  () => import("./scene/SiteScene").then((m) => m.SiteScene),
  { ssr: false },
);

/** Ground level, one section per floor, then the roof. */
const SECTION_COUNT = projects.length + 2;
const FIRST_SEED = 0x2026_0916;

export function SiteExperience() {
  const [seed, setSeed] = useState(FIRST_SEED);
  const [ready, setReady] = useState(false);
  const [walkIn, setWalkIn] = useState<Project | null>(null);
  const site = useMemo(() => generateSite(seed, projects), [seed]);
  const { progress, section } = useScrollProgress(SECTION_COUNT);
  const reduced = useReducedMotion() ?? false;
  const wide = useMediaQuery("(min-width: 768px)");

  const [playing, setPlaying] = useState(false);
  // A rebuild during a shift ends it: the site is torn down. Back to the
  // ground with it, too — a finished building stays up once it has topped
  // out, so this is the only way to watch the next one go up.
  const rebuild = useCallback(() => {
    endGame();
    setPlaying(false);
    window.scrollTo({ top: 0, behavior: "auto" });
    setSeed(randomSeed());
  }, []);

  // The night shift stacks on top of the tower as designed, so the whole
  // thing is built first, then the page stops scrolling until you clock off.
  const base = useMemo(
    () => ({ x: 0, z: 0, width: site.topLevel.width * 0.92, depth: site.topLevel.depth * 0.92, y: site.topLevel.y }),
    [site],
  );
  const clockOn = useCallback(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });
    startGame(base);
    setPlaying(true);
  }, [base]);
  const clockOff = useCallback(() => {
    endGame();
    setPlaying(false);
  }, []);
  const again = useCallback(() => startGame(base), [base]);
  useEffect(() => {
    if (!playing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [playing]);
  const onReady = useCallback(() => setReady(true), []);
  const closeWalkIn = useCallback(() => setWalkIn(null), []);

  return (
    <div className="relative">
      <Loader ready={ready} />
      <AnimatePresence>
        {!playing && (
          <motion.div key="chrome" initial={false} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <SiteSign />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <SiteScene
          site={site}
          progress={progress}
          sectionCount={SECTION_COUNT}
          animate={!reduced}
          started={ready}
          rich={wide}
          shiftX={wide ? HERO.shift : 0}
          shiftY={wide ? 0 : 0.155}
          onReady={onReady}
          onSelectFloor={(index) => {
            document.getElementById(projects[index].slug)?.scrollIntoView({
              behavior: reduced ? "auto" : "smooth",
            });
          }}
        />
        {/* Keep the copy column legible where the tower runs behind it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-[46%] bg-gradient-to-r from-background/85 via-background/40 to-transparent md:block"
        />
        {/* On small screens the copy sits over the ground, so shade it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-background via-background/45 to-transparent md:hidden"
        />
      </div>

      {/* Sections let pointer events through to the site; only their copy catches them. */}
      <div
        className={"pointer-events-none relative z-10 -mt-[100vh] transition-opacity duration-300" + (playing ? " opacity-0" : "")}
        aria-hidden={playing}
      >
        <Hero started={ready} />
        {projects.map((project, i) => (
          <FloorPanel
            key={project.slug}
            project={project}
            number={i + 1}
            active={section === i + 1}
            onWalkIn={setWalkIn}
          />
        ))}
        <Roof active={section === SECTION_COUNT - 1 && !playing} onPlay={clockOn} />
      </div>

      {!playing && <RebuildButton onRebuild={rebuild} onPlay={clockOn} />}
      {!playing && <FloorRail section={section} sectionCount={SECTION_COUNT} />}
      {!playing && <ClimbRule section={section} />}
      {/* The drawing sheet: the frame, what is on each level, and who drew it. */}
      {!playing && <SheetFrame />}
      {!playing && <FloorSchedule section={section} />}
      {!playing && <TitleBlock section={section} seed={seed} lamp={site.lamp.name} />}
      <NightShift onAgain={again} onLeave={clockOff} />
      <WalkIn project={walkIn} onClose={closeWalkIn} />
    </div>
  );
}
