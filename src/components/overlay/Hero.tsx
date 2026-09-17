"use client";

import { motion, useReducedMotion } from "framer-motion";
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

  return (
    <section
      id="ground"
      className="flex h-screen items-end px-5 pb-28 md:items-center md:px-8 md:pb-0 md:pt-24"
    >
      <div className="pointer-events-auto max-w-[34rem]">
        <h1 className="select-none font-display text-[clamp(88px,16vw,200px)] font-extrabold uppercase leading-[0.86] tracking-tight text-chalk">
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
          <p className="mt-6 max-w-[26rem] text-[17px] leading-relaxed text-chalk">
            A portfolio under construction.
          </p>
          <p className="mt-2 max-w-[26rem] text-[15px] leading-relaxed text-chalk-dim">
            I&apos;m Efe, a design engineer. Scroll to climb: {floors} floors
            of work are up and the crane is still running.
          </p>
          <a
            href={`#${projects[0].slug}`}
            className="group mt-10 inline-flex items-center gap-3 text-[14px] text-chalk-dim transition-colors hover:text-sodium"
          >
            <span className="relative block h-10 w-px overflow-hidden bg-steel-dim">
              <span className="climb-line absolute inset-x-0 top-0 h-4 bg-sodium" />
            </span>
            Climb
          </a>
        </motion.div>
      </div>
    </section>
  );
}
