"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Project } from "@/lib/projects";

type FloorPanelProps = {
  project: Project;
  /** Floor number as painted on the slab, counting up from the ground. */
  number: number;
  active: boolean;
};

/** One project per floor. The panel switches on like a work lamp. */
export function FloorPanel({ project, number, active }: FloorPanelProps) {
  const reduced = useReducedMotion();
  const flicker = reduced
    ? { opacity: active ? 1 : 0 }
    : { opacity: active ? [0, 0.7, 0.25, 1] : 0 };

  return (
    <section
      id={project.slug}
      className="flex h-screen items-end px-5 pb-32 md:items-center md:px-8 md:pb-0 md:pt-24"
      aria-label={`Floor ${number}: ${project.title}`}
    >
      <motion.div
        className="max-w-[26rem]"
        initial={false}
        animate={flicker}
        transition={
          reduced
            ? { duration: 0.2 }
            : { duration: 0.55, times: [0, 0.2, 0.35, 1], ease: "linear" }
        }
        style={{ pointerEvents: active ? "auto" : "none" }}
      >
        <p className="flex items-baseline gap-3">
          <span className="font-display text-[84px] font-extrabold leading-none text-sodium">
            {number}
          </span>
          <span className="text-[14px] text-chalk-dim">Floor</span>
        </p>
        <h2 className="mt-4 font-display text-[40px] font-bold uppercase leading-none tracking-wide text-chalk">
          {project.title}
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-chalk-dim">
          {project.description}
        </p>
        <p className="mt-4 text-[13px] text-steel">
          {project.stack.join(", ")}
          {project.finished ? "" : " (still in progress)"}
        </p>
        <div className="mt-6 flex gap-6 text-[14px]">
          {project.live && (
            <a
              href={project.live}
              target="_blank"
              rel="noreferrer"
              className="text-chalk underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium"
              tabIndex={active ? 0 : -1}
            >
              Open project
            </a>
          )}
          <a
            href={project.repo}
            target="_blank"
            rel="noreferrer"
            className="text-chalk underline decoration-steel-dim decoration-1 underline-offset-[6px] transition-colors hover:text-sodium hover:decoration-sodium"
            tabIndex={active ? 0 : -1}
          >
            Source on GitHub
          </a>
        </div>
      </motion.div>
    </section>
  );
}
