"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Project } from "@/lib/projects";

type WalkInProps = {
  project: Project | null;
  onClose: () => void;
};

/** Walk into a floor: the live project opens in place, over the site. */
export function WalkIn({ project, onClose }: WalkInProps) {
  const reduced = useReducedMotion();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!project) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [project, onClose]);

  return (
    <AnimatePresence>
      {project?.live && (
        <motion.div
          key={project.slug}
          role="dialog"
          aria-modal="true"
          aria-label={`${project.title}, live`}
          className="fixed inset-0 z-30 flex flex-col bg-night-deep/85 p-3 backdrop-blur-sm md:p-6"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-steel-dim bg-night"
            initial={reduced ? false : { y: 40, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={reduced ? undefined : { y: 30, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-steel-dim px-4 py-3">
              <p className="min-w-0 truncate font-display text-[20px] font-bold uppercase tracking-wide text-chalk">
                {project.title}
              </p>
              <div className="flex shrink-0 items-center gap-5 text-[14px]">
                <a
                  href={project.live}
                  target="_blank"
                  rel="noreferrer"
                  className="text-chalk-dim transition-colors hover:text-sodium"
                >
                  Open in a new tab
                </a>
                <button
                  ref={closeButton}
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-steel-dim px-3 py-1 text-chalk transition-colors hover:border-sodium hover:text-sodium"
                >
                  Back to site
                </button>
              </div>
            </div>
            <iframe
              src={project.live}
              title={`${project.title} live`}
              className="min-h-0 flex-1 bg-white"
              loading="eager"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
