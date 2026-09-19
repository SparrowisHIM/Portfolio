"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Says the orbit is free, once, when the site tops out.
 *
 * The camera is on a short leash the whole way up and comes off it at the
 * top, and nothing about a grab cursor tells you that changed. One line,
 * shown the moment the last level lands, then gone — a permanent control
 * hint on a finished model would be clutter on the shot it is describing.
 */
export function ToppedOut({ topped }: { topped: boolean }) {
  const reduced = useReducedMotion();
  // Only the timeout writes state. A rebuild is a new site, and the caller
  // keys this on the seed, so the fresh mount is what resets it.
  const [expired, setExpired] = useState(false);
  const show = topped && !expired;

  useEffect(() => {
    if (!topped) return;
    const timer = window.setTimeout(() => setExpired(true), 5200);
    return () => window.clearTimeout(timer);
  }, [topped]);

  return (
    <AnimatePresence>
      {show && (
        <motion.p
          key="topped"
          role="status"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduced ? 0.2 : 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-[43%] z-20 mx-auto flex w-fit max-w-[92vw] items-center gap-2.5 rounded-full border border-steel-dim bg-night-deep/80 py-2 pl-3 pr-4 text-[13px] text-chalk-dim backdrop-blur md:bottom-28"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-sodium/15 text-sodium">
            {/* Drag: a span with a head at each end. An orbit ring reads as
                a broken letter at fourteen pixels. */}
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.6 8h10.8" />
              <path d="M5.2 5.4 2.6 8l2.6 2.6" />
              <path d="M10.8 5.4 13.4 8l-2.6 2.6" />
            </svg>
          </span>
          <span>
            <span className="text-chalk">Topped out.</span> Drag to walk round it, or pick a floor.
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
