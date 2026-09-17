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
      className="flex h-screen items-end px-5 pb-32 md:items-center md:px-8 md:pb-0 md:pt-24"
      aria-label={`Floor ${number}: ${project.title}`}
    >
      {/* Pinned clear of the wordmark: the copy parks in its band and fades
          out rather than sliding up through the header. */}
      <motion.div
        className="sticky top-[34vh] max-w-[26rem] md:top-[22vh]"
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
        >
        <p className="flex items-baseline gap-3">
          <span className="select-none font-display text-[84px] font-extrabold leading-none text-sodium">
            {number}
          </span>
          <span className="text-[14px] text-chalk-dim">Floor</span>
        </p>
        <h2 className="select-none mt-4 font-display text-[40px] font-bold uppercase leading-none tracking-wide text-chalk">
          {project.title}
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
          {project.description}
        </p>
        <p className="mt-4 text-[13px] text-steel">
          {project.stack.join(", ")}
          {project.finished ? "" : " (still in progress)"}
        </p>
        <div className="mt-6 flex flex-wrap gap-6 text-[14px]">
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
