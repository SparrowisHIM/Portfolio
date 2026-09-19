"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { Project } from "@/lib/projects";

type FloorPanelProps = {
  project: Project;
  /** Floor number as painted on the slab, counting up from the ground. */
  number: number;
  active: boolean;
  /** Open the live project in place. */
  onWalkIn?: (project: Project) => void;
};

/** One project per floor. The panel switches on like a work lamp. */
export function FloorPanel({ project, number, active, onWalkIn }: FloorPanelProps) {
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  // The copy is tied to where its own floor sits on screen, not to a
  // rounded section index, so it is already dark by the time it would
  // otherwise slide up through the wordmark.
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start end", "end start"],
  });
  const travel = useTransform(scrollYProgress, [0.24, 0.42, 0.58, 0.75], [0, 1, 1, 0]);
  // Arriving on a floor switches the panel on like a work lamp.
  const flicker = reduced
    ? { opacity: 1 }
    : { opacity: active ? [0.35, 0.95, 0.5, 1] : 1 };

  return (
    <section
      ref={section}
      id={project.slug}
      className="h-screen md:flex md:items-center md:px-8 md:pt-24"
      aria-label={`Floor ${number}: ${project.title}`}
    >
      {/* Pinned clear of the wordmark: the copy parks in its band and fades
          out rather than sliding up through the header.

          On a phone it is fixed to the foot of the screen instead. Sticky
          cannot do this job: sticky only ever pulls an element back up
          toward an edge, and what is wanted here is the opposite — hold the
          card down at the bottom of the viewport while its section is still
          arriving. Left in flow the cards ride their sections, and two of
          them meet half-lit in the middle of the screen between floors. */}
      <motion.div
        className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] md:sticky md:inset-x-auto md:bottom-auto md:top-[22vh] md:w-auto md:max-w-[26rem]"
        style={{ opacity: travel, pointerEvents: active ? "auto" : "none" }}
      >
        <motion.div
          initial={false}
          animate={flicker}
          transition={
            reduced
              ? { duration: 0.2 }
              : { duration: 0.55, times: [0, 0.2, 0.35, 1], ease: "linear" }
          }
          className="rounded-xl border border-steel-dim/45 bg-night-deep/80 p-4 backdrop-blur-md md:rounded-none md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
        >
        <p className="flex items-baseline gap-3">
          <span className="select-none font-display text-[46px] font-extrabold leading-none text-sodium md:text-[84px]">
            {number}
          </span>
          <span className="text-[14px] text-chalk-dim">Floor</span>
        </p>
        <h2 className="select-none mt-2 font-display text-[28px] font-bold uppercase leading-none tracking-wide text-chalk md:mt-4 md:text-[40px]">
          {project.title}
        </h2>
        <p className="mt-2.5 text-[13px] leading-relaxed text-chalk-dim md:mt-4 md:text-[15px]">
          {project.description}
        </p>
        <p className="mt-2.5 text-[12px] text-steel md:mt-4 md:text-[13px]">
          {project.stack.join(", ")}
          {project.finished ? "" : " (still in progress)"}
        </p>
        <div className="mt-4 flex flex-wrap gap-6 text-[14px] md:mt-6">
          {project.live ? (
            <>
              <a
                href={project.live}
                target="_blank"
                rel="noreferrer"
                className="text-chalk underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium"
                tabIndex={active ? 0 : -1}
              >
                Visit the site
              </a>
              <button
                type="button"
                onClick={() => onWalkIn?.(project)}
                className="text-chalk underline decoration-steel-dim decoration-1 underline-offset-[6px] transition-colors hover:text-sodium hover:decoration-sodium"
                tabIndex={active ? 0 : -1}
              >
                Walk in
              </button>
            </>
          ) : (
            <span className="text-steel">Fit-out in progress. Opens soon.</span>
          )}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
