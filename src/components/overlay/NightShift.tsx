"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { game, snapshot, subscribe } from "@/lib/stack-game";

type NightShiftProps = {
  onAgain: () => void;
  onLeave: () => void;
};

const ease = [0.16, 1, 0.3, 1] as const;
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sodium";

/** Sample the simulation directly: a moving needle does not need React renders. */
function BalanceMeter({ reduced }: { reduced: boolean }) {
  const meter = useRef<HTMLDivElement>(null);
  const needle = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const update = () => {
      const stability = Math.max(0, Math.min(1, game.stability));
      const state = stability > 0.66 ? "Stable" : stability > 0.32 ? "Swaying" : "Critical";
      const color = stability > 0.66 ? "#d8d4cb" : stability > 0.32 ? "#eab77a" : "#ef957f";
      // Rotation around Z is negative when the visible tower leans right.
      const offset = Math.max(-1, Math.min(1, -game.lean / 0.22)) * 70;

      if (needle.current) {
        needle.current.style.transform = `translateX(${offset}px)`;
        needle.current.style.backgroundColor = color;
      }
      if (label.current) {
        label.current.textContent = state;
        label.current.style.color = color;
      }
      meter.current?.setAttribute("aria-valuenow", String(Math.round(stability * 100)));
      meter.current?.setAttribute("aria-valuetext", `${state}. ${Math.round(stability * 100)} percent stability.`);
    };

    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      ref={meter}
      role="meter"
      aria-label="Tower stability"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={100}
      aria-valuetext="Stable. 100 percent stability."
      className="w-[160px] select-none"
    >
      <div aria-hidden="true" className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.12em]">
        <span className="text-chalk-dim">Balance</span>
        <span ref={label} className="text-chalk">Stable</span>
      </div>
      <div aria-hidden="true" className="relative h-3">
        <span className="absolute inset-x-0 top-[5px] h-px bg-steel" />
        <span className="absolute inset-y-1 left-0 w-px bg-sodium/70" />
        <span className="absolute inset-y-1 right-0 w-px bg-sodium/70" />
        <span className="absolute inset-y-0 left-1/2 w-px bg-chalk-dim/50" />
        <span
          ref={needle}
          className="absolute top-[3px] left-1/2 -ml-[3px] size-[6px] rounded-[1px] bg-chalk"
          style={{ transition: reduced ? "none" : "transform 100ms linear, background-color 150ms linear" }}
        />
      </div>
    </div>
  );
}

/** This feedback expires once per landing, independently of animation frames. */
function PlacementFeedback({ reduced, perfect, recovery }: { reduced: boolean; perfect: boolean; recovery: boolean }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 1150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -6 }}
          transition={{ duration: reduced ? 0 : 0.22, ease }}
          className="absolute bottom-full mb-5 select-none text-center"
        >
          <p className="font-display text-[28px] font-bold uppercase tracking-[0.08em] text-sodium md:text-[32px]">
            {perfect ? "Perfect" : "Steadying"}
          </p>
          {perfect && recovery && <p className="mt-1 text-[11px] tracking-[0.04em] text-chalk-dim">Balance improving</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShiftResult({ onAgain, onLeave, reduced, collapsed, score, best }: NightShiftProps & {
  reduced: boolean;
  collapsed: boolean;
  score: number;
  best: number;
}) {
  const [visible, setVisible] = useState(false);
  const restart = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), collapsed ? 1100 : 450);
    return () => window.clearTimeout(timer);
  }, [collapsed]);

  useEffect(() => {
    if (!visible) return;
    const frame = window.requestAnimationFrame(() => restart.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [visible]);

  if (!visible) return null;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.25, ease }}
      className="pointer-events-auto w-full max-w-[24rem] rounded-lg border border-steel-dim bg-night-deep/90 p-5 text-center backdrop-blur md:p-6"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-sodium">{collapsed ? "Tower down" : "Shift over"}</p>
      <p className="mt-2 font-display text-[44px] font-extrabold uppercase leading-none text-chalk">
        {score} {score === 1 ? "floor" : "floors"}
      </p>
      <p className="mt-3 text-[12px] text-chalk-dim">
        {collapsed ? "The tower lost its balance." : "The floor missed its landing."}
      </p>
      <p className="mt-2 text-[11px] text-chalk-dim tabular-nums">{score === best && score > 0 ? "Best shift." : `Best shift: ${best}`}</p>
      <div className="mt-5 flex flex-col gap-2">
        <button
          ref={restart}
          type="button"
          onClick={onAgain}
          className={`min-h-11 rounded bg-sodium px-5 py-3 text-[12px] font-medium uppercase tracking-[0.1em] text-night-deep transition-[opacity,transform] hover:opacity-90 motion-safe:active:scale-[0.96] ${focus}`}
        >
          Restart shift
        </button>
        <button
          type="button"
          onClick={onLeave}
          className={`min-h-11 rounded px-4 py-3 text-[12px] text-chalk-dim transition-[color,transform] hover:text-chalk motion-safe:active:scale-[0.96] ${focus}`}
        >
          Back to the site
        </button>
      </div>
    </motion.div>
  );
}

export function NightShift({ onAgain, onLeave }: NightShiftProps) {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const reduced = Boolean(useReducedMotion());
  const { active, over, score, best, lastPerfect, lastLanding, recovery, collapse } = game;

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onLeave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onLeave]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-8 md:pt-7 md:pb-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-sodium">Night shift</p>
          <p className="mt-2 flex items-baseline gap-2.5">
            <motion.span
              key={score}
              initial={reduced ? false : { y: 6, opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.22, ease }}
              className="select-none font-display text-[64px] font-extrabold leading-none text-chalk tabular-nums md:text-[80px]"
            >
              {score}
            </motion.span>
            <span className="text-[12px] uppercase tracking-[0.12em] text-chalk-dim">{score === 1 ? "floor" : "floors"}</span>
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-chalk-dim tabular-nums">Best {best}</p>
          <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {over
              ? `${collapse ? "The tower lost its balance." : "The floor missed its landing."} Shift over. ${score} floors.`
              : `Floor ${score}.${lastPerfect ? " Perfect placement." : ""}${recovery ? " Balance improving." : ""}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          aria-label="Clock off and return to the portfolio"
          className={`pointer-events-auto min-h-11 rounded-full border border-steel-dim bg-night-deep/75 px-4 py-2 text-[12px] text-chalk backdrop-blur transition-[color,border-color,transform] hover:border-sodium hover:text-sodium motion-safe:active:scale-[0.96] ${focus}`}
        >
          Clock off <span aria-hidden="true" className="ml-2 text-steel">↗</span>
        </button>
      </div>

      <div className={`relative flex flex-col items-center self-center ${!over ? "rounded-lg bg-night-deep/85 px-5 py-3 backdrop-blur-sm" : "w-full"}`}>
        {!over ? (
          <>
            {score > 0 && (lastPerfect || recovery) && (
              <PlacementFeedback key={`${score}:${lastLanding}`} reduced={reduced} perfect={lastPerfect} recovery={recovery} />
            )}
            <BalanceMeter reduced={reduced} />
            <p className="mt-3 select-none rounded-full border border-steel-dim/50 bg-night-deep/70 px-4 py-3 text-center text-[10px] uppercase tracking-[0.15em] text-chalk-dim backdrop-blur-sm md:text-[11px]">
              Click / Tap / <kbd className="text-chalk">Space</kbd> to drop
            </p>
            <p className="mt-2 text-center text-[11px] text-chalk-dim">Land near the centre to restore balance.</p>
          </>
        ) : (
          <ShiftResult onAgain={onAgain} onLeave={onLeave} reduced={reduced} collapsed={Boolean(collapse)} score={score} best={best} />
        )}
      </div>
    </div>
  );
}
