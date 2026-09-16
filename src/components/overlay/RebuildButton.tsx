"use client";

import { motion, useReducedMotion } from "framer-motion";

type RebuildButtonProps = {
  seed: number;
  /** Name of the lighting rig on the current site. */
  lamp: string;
  onRebuild: () => void;
};

/** Tear the site down and put it up again from a new seed. */
export function RebuildButton({ seed, lamp, onRebuild }: RebuildButtonProps) {
  const reduced = useReducedMotion();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2 md:bottom-7 md:right-8">
      <motion.button
        type="button"
        onClick={onRebuild}
        whileTap={reduced ? undefined : { scale: 0.96 }}
        className="pointer-events-auto inline-flex h-11 items-center gap-2.5 rounded-full border border-steel-dim bg-night-deep/70 px-4 text-[14px] text-chalk backdrop-blur transition-colors duration-200 hover:border-sodium hover:text-sodium"
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
        Rebuild
      </motion.button>
      <p className="text-[11px] tabular-nums text-steel" aria-live="polite">
        Site no. {seed.toString(16).padStart(8, "0")}, {lamp} lighting
      </p>
    </div>
  );
}
