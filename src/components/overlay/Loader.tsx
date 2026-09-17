"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type LoaderProps = {
  /** True once the scene has drawn its first frame. */
  ready: boolean;
};

/** The setting-out drawing: a floor plan sketches itself while the site loads. */
export function Loader({ ready }: LoaderProps) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          key="loader"
          className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background"
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.6, ease: "easeOut" }}
          aria-live="polite"
          aria-label="Setting out the site"
        >
          <svg
            viewBox="0 0 160 120"
            width="200"
            height="150"
            fill="none"
            stroke="currentColor"
            className={`text-steel ${reduced ? "" : "plan-draw"}`}
            aria-hidden="true"
          >
            <g strokeWidth="0.5" opacity="0.5">
              {Array.from({ length: 7 }, (_, i) => (
                <line key={`v${i}`} x1={20 + i * 20} y1="10" x2={20 + i * 20} y2="110" />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line key={`h${i}`} x1="20" y1={10 + i * 25} x2="140" y2={10 + i * 25} />
              ))}
            </g>
            <rect x="40" y="30" width="80" height="60" strokeWidth="1.2" />
            <g strokeWidth="1.2">
              {[
                [46, 36],
                [114, 36],
                [46, 84],
                [114, 84],
                [80, 36],
                [80, 84],
              ].map(([x, y]) => (
                <rect key={`${x}${y}`} x={x - 3} y={y - 3} width="6" height="6" />
              ))}
            </g>
            <g stroke="#ff6a2b" strokeWidth="1.2">
              <circle cx="132" cy="22" r="3" />
              <line x1="132" y1="22" x2="132" y2="100" />
              <line x1="132" y1="22" x2="70" y2="22" />
            </g>
          </svg>
          <p className="mt-6 font-display text-[28px] font-bold uppercase tracking-wide text-chalk">
            Build site
          </p>
          <p className="mt-1 text-[13px] text-chalk-dim">Setting out the site</p>
          <div className="mt-6 h-px w-40 overflow-hidden bg-steel-dim">
            <div className={`h-full w-1/3 bg-sodium ${reduced ? "" : "level-bar"}`} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
