"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { game, snapshot, subscribe } from "@/lib/stack-game";

type NightShiftProps = {
  onAgain: () => void;
  onLeave: () => void;
};

const ease = [0.16, 1, 0.3, 1] as const;

/** The game HUD: floor count, the drop hint, and the end-of-shift card. */
export function NightShift({ onAgain, onLeave }: NightShiftProps) {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!game.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onLeave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);

  if (!game.active) return null;
  const perfect = game.lastPerfect && game.time - game.lastDrop < 1.2;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between px-5 py-5 md:px-8 md:py-7">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-sodium">Night shift</p>
          <p className="mt-1 flex items-baseline gap-3">
            <motion.span
              key={game.score}
              initial={reduced ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, ease }}
              className="select-none font-display text-[96px] font-extrabold leading-none text-chalk tabular-nums"
            >
              {game.score}
            </motion.span>
            <span className="text-[14px] text-chalk-dim">{game.score === 1 ? "floor" : "floors"} up</span>
          </p>
          <p className="mt-1 text-[13px] text-steel tabular-nums">Best shift {Math.max(game.best, game.score)}</p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="pointer-events-auto rounded-full border border-steel-dim bg-night-deep/70 px-4 py-2 text-[14px] text-chalk backdrop-blur transition-colors hover:border-sodium hover:text-sodium"
        >
          Clock off
        </button>
      </div>

      <div className="relative flex justify-center">
        <AnimatePresence>
          {perfect && !game.over && (
            <motion.p
              key={game.lastDrop}
              initial={reduced ? false : { opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.35, ease }}
              className="absolute bottom-full mb-6 select-none font-display text-[40px] font-extrabold uppercase tracking-wide text-sodium"
            >
              Dead level{game.streak >= 3 ? ". Slab reclaimed" : ""}
            </motion.p>
          )}
        </AnimatePresence>
        {!game.over ? (
          <p className="text-center text-[14px] text-chalk-dim">
            Click, tap or press <kbd className="rounded border border-steel-dim px-1.5 py-0.5 text-[12px] text-chalk">space</kbd> to land the slab.
            Whatever hangs over the edge comes off.
          </p>
        ) : (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="pointer-events-auto max-w-[30rem] rounded-lg border border-steel-dim bg-night-deep/85 p-6 text-center backdrop-blur"
          >
            <p className="text-[12px] uppercase tracking-[0.2em] text-safety">Site closed</p>
            <p className="mt-2 font-display text-[44px] font-extrabold uppercase leading-none text-chalk">
              {game.score} {game.score === 1 ? "floor" : "floors"} on the hook
            </p>
            <p className="mt-3 text-[14px] text-chalk-dim">
              {game.score >= game.best && game.score > 0
                ? "Best shift on this site. The crane driver is impressed."
                : `Best shift so far: ${game.best} floors.`}
            </p>
            <div className="mt-5 flex justify-center gap-6 text-[14px]">
              <button type="button" onClick={onAgain} className="text-chalk underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium">
                Another shift
              </button>
              <button type="button" onClick={onLeave} className="text-chalk underline decoration-steel-dim decoration-1 underline-offset-[6px] transition-colors hover:text-sodium">
                Back to the site
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
