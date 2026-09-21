"use client";

import { motion, useReducedMotion } from "framer-motion";

type RebuildButtonProps = {
  onRebuild: () => void;
  onPlay: () => void;
};

/**
 * Tear the site down and put it up again from a new seed.
 *
 * The seed and the lamp used to be printed under these buttons as a loose
 * line with nothing to belong to. They are rows in the title block now,
 * which is where a drawing states them.
 */
export function RebuildButton({ onRebuild, onPlay }: RebuildButtonProps) {
  const reduced = useReducedMotion();
  return (
    // On a phone these move to the left edge, opposite the floor rail: the
    // bottom right is where the copy card lives, and two pills sitting on
    // top of the text was the first thing wrong with the small layout.
    <div className="pointer-events-none fixed left-2 top-[46%] z-20 flex -translate-y-1/2 flex-col items-start gap-2 md:bottom-7 md:left-auto md:right-8 md:top-auto md:translate-y-0 md:items-end">
      <div className="flex flex-col gap-1.5 md:flex-row md:gap-2">
      <motion.button
        type="button"
        onClick={onPlay}
        aria-label="Clock on for a night shift"
        whileTap={reduced ? undefined : { scale: 0.96 }}
        className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center gap-2.5 rounded-md border border-sodium/60 bg-night-deep/70 text-[14px] text-sodium backdrop-blur transition-colors duration-200 hover:border-sodium hover:bg-sodium hover:text-night-deep md:h-11 md:w-auto md:rounded-full md:px-4"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="10" width="10" height="3" />
          <rect x="4.5" y="6" width="8" height="3" />
          <rect x="6" y="2" width="6" height="3" />
        </svg>
        <span className="hidden md:inline">Night shift</span>
      </motion.button>
      <motion.button
        type="button"
        onClick={onRebuild}
        aria-label="Tear the site down and build a new one"
        whileTap={reduced ? undefined : { scale: 0.96 }}
        className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center gap-2.5 rounded-md border border-steel-dim bg-night-deep/70 text-[14px] text-chalk backdrop-blur transition-colors duration-200 hover:border-sodium hover:text-sodium md:h-11 md:w-auto md:rounded-full md:px-4"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* A small crane: mast, jib and hook */}
          <path d="M4 15V3h9" />
          <path d="M2 3h2" />
          <path d="M11 3v5" />
          <path d="M9.5 9.5a1.5 1.5 0 1 0 3 0" />
        </svg>
        <span className="hidden md:inline">Rebuild</span>
      </motion.button>
      </div>
    </div>
  );
}
