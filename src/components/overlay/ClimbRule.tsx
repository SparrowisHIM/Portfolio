"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { FLOOR_HEIGHT } from "@/lib/site-generator";
import { projects } from "@/lib/projects";

/** Height of the rule, in pixels. */
const TRACK = 248;

/**
 * The climb, as a scale rule.
 *
 * Scrolling this page drives a building up and nothing on a wide screen
 * said so — the phone has its floor rail and the desktop had no equivalent
 * at all, so the scroll was doing the most interesting work on the page
 * silently. This is the one thing that answers "where am I" and "what is
 * this scroll for" at the same time.
 *
 * Drawn as a levels rule rather than a progress bar on purpose. A bar says
 * how far through a page you are, which is a browser's job; a rule says
 * how high up a building you are, in metres, which is the thing actually
 * happening. The elevations are the real ones — `slabTop(i)` — so the
 * number beside the marker is the height of the floor you are reading.
 */
export function ClimbRule({ section }: { section: number }) {
  const { scrollYProgress } = useScroll();
  // Bottom of the rule is the ground, top is the roof, the way an
  // elevation is drawn.
  const y = useTransform(scrollYProgress, [0, 1], [TRACK, 0]);

  const stops = [
    { key: "ground", href: "#ground", code: "G", level: null as number | null },
    ...projects.map((project, i) => ({
      key: project.slug,
      href: `#${project.slug}`,
      code: String(i + 1).padStart(2, "0"),
      level: i,
    })),
    { key: "contact", href: "#contact", code: "R", level: projects.length },
  ];

  const here = Math.min(stops.length - 1, Math.max(0, section));
  const at = stops[here];
  const metres = at.level === null ? null : at.level * FLOOR_HEIGHT;

  return (
    <nav
      aria-label="Levels"
      className="pointer-events-none fixed right-7 top-1/2 z-20 hidden -translate-y-1/2 md:block"
    >
      <div className="relative" style={{ height: TRACK }}>
        {/* The rule itself. */}
        <span aria-hidden="true" className="absolute right-[26px] top-0 h-full w-px bg-steel-dim/60" />

        {/*
          Where the scroll has got to, sliding continuously between the
          ticks. A diamond rather than another dash: as a dash it read as
          a second tick sitting just below the real one rather than as a
          position on the rule.
        */}
        <motion.span
          aria-hidden="true"
          style={{ y }}
          className="absolute right-[24px] top-0 h-[5px] w-[5px] -translate-y-1/2 translate-x-[2px] rotate-45 bg-sodium"
        />

        {/* The elevation of the level being read, in metres, like a drawing. */}
        <motion.span
          aria-hidden="true"
          style={{ y }}
          className="absolute right-[40px] top-0 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] tracking-tight text-sodium tabular-nums"
        >
          {metres === null ? "±0.00" : `+${metres.toFixed(2)}`}
        </motion.span>

        <ul>
          {stops.map((stop, i) => {
            const active = i === here;
            // Ground at the foot, roof at the head.
            const top = TRACK * (1 - i / (stops.length - 1));
            return (
              <li key={stop.key} className="absolute right-0" style={{ top }}>
                <a
                  href={stop.href}
                  aria-current={active ? "true" : undefined}
                  className="pointer-events-auto flex -translate-y-1/2 items-center gap-2 py-1 pl-4 font-mono text-[10px] tabular-nums transition-colors duration-200"
                >
                  <span
                    aria-hidden="true"
                    className={
                      "block h-px transition-all duration-200 " +
                      (active ? "w-[13px] bg-sodium" : "w-[7px] bg-steel-dim group-hover:bg-steel")
                    }
                  />
                  <span className={active ? "text-sodium" : "text-steel"}>{stop.code}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
