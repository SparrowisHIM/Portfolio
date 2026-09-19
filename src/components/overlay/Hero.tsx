"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { projects } from "@/lib/projects";

const ease = [0.16, 1, 0.3, 1] as const;

function Line({
  children,
  delay,
  started,
}: {
  children: string;
  delay: number;
  started: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <motion.span
        className="block"
        initial={reduced ? false : { y: "110%" }}
        animate={{ y: started || reduced ? 0 : "110%" }}
        transition={{ duration: 1, ease, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Ground level. The reveal waits for the site to finish setting out. */
export function Hero({ started }: { started: boolean }) {
  const reduced = useReducedMotion();
  const floors = WORDS[projects.length] ?? String(projects.length);
  const section = useRef<HTMLElement>(null);
  // Fixed to the foot of a phone screen, the card has to be told when to
  // leave: nothing carries it off the way the flow used to. Above the
  // breakpoint the stylesheet pins the opacity back to 1, so the wide
  // layout keeps scrolling its hero away exactly as it did.
  const { scrollYProgress } = useScroll({ target: section, offset: ["start end", "end start"] });
  const travel = useTransform(scrollYProgress, [0.5, 0.72], [1, 0]);
  const catches = useTransform(travel, (v) => (v > 0.5 ? "auto" : "none"));

  return (
    <section
      ref={section}
      id="ground"
      className="h-screen md:flex md:items-center md:px-8 md:pt-24"
    >
      <motion.div
        style={{ opacity: travel, pointerEvents: catches }}
        className="pointer-events-auto fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] rounded-xl border border-steel-dim/45 bg-night-deep/80 p-4 backdrop-blur-md md:static md:inset-x-auto md:bottom-auto md:w-auto md:max-w-[34rem] md:rounded-none md:border-0 md:bg-transparent md:p-0 md:opacity-100! md:backdrop-blur-none"
      >
        <h1 className="select-none font-display text-[clamp(58px,16vw,200px)] font-extrabold uppercase leading-[0.86] tracking-tight text-chalk">
          <Line delay={1.3} started={started}>
            Build
          </Line>
          <Line delay={1.42} started={started}>
            site
          </Line>
        </h1>
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: started || reduced ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 1.9 }}
        >
          <p className="mt-3 max-w-[26rem] text-[15px] leading-relaxed text-chalk md:mt-6 md:text-[17px]">
            A portfolio under construction.
          </p>
          <p className="mt-1.5 max-w-[26rem] text-[13px] leading-relaxed text-chalk-dim md:mt-2 md:text-[15px]">
            I&apos;m Efe, a design engineer. Scroll to climb: {floors} floors
            of work are up and the crane is still running.
          </p>
          <a
            href={`#${projects[0].slug}`}
            className="group mt-4 inline-flex items-center gap-3 text-[14px] text-chalk-dim transition-colors hover:text-sodium md:mt-10"
          >
            <span className="relative block h-10 w-px overflow-hidden bg-steel-dim">
              <span className="climb-line absolute inset-x-0 top-0 h-4 bg-sodium" />
            </span>
            Climb
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
