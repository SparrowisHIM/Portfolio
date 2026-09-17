"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const HOLD_MS = 1400;
const R = 26;
const C = 2 * Math.PI * R;

/** A destructive action that needs a held press. Let go early and it lets go too. */
export function HoldToConfirm() {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [holding, setHolding] = useState(false);
  const frame = useRef(0);
  const start = useRef(0);

  const stop = () => {
    cancelAnimationFrame(frame.current);
    setHolding(false);
    if (!done) setProgress(0);
  };
  const begin = () => {
    if (done) return;
    setHolding(true);
    start.current = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start.current) / (reduced ? 1 : HOLD_MS));
      setProgress(p);
      if (p >= 1) {
        setDone(true);
        setHolding(false);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const reset = () => {
    setDone(false);
    setProgress(0);
  };
  const remaining = Math.ceil(((1 - progress) * HOLD_MS) / 1000 * 10) / 10;

  return (
    <div className="flex flex-col items-center gap-5 py-4 md:flex-row md:justify-center md:gap-12">
      <div className="max-w-[22rem] text-center md:text-left">
        <p className="font-display text-[30px] font-bold uppercase leading-none text-chalk">Demolish level 2</p>
        <p className="mt-2 text-[14px] leading-relaxed text-chalk-dim">
          This cannot be undone. The floor above will be propped while the slab comes out.
        </p>
      </div>
      <div className="relative flex flex-col items-center gap-3">
        <motion.button
          type="button"
          onPointerDown={begin}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !holding && !e.repeat) begin();
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") stop();
          }}
          animate={done ? { scale: [1, 1.06, 1] } : holding && !reduced ? { x: [0, -1, 1, -1, 0] } : { x: 0 }}
          transition={holding ? { repeat: Infinity, duration: 0.18 } : { duration: 0.4 }}
          aria-live="polite"
          className={`relative flex h-[72px] w-[72px] select-none items-center justify-center rounded-full border transition-colors ${done ? "border-safety bg-safety text-night-deep" : "border-safety/70 bg-night-deep text-safety hover:border-safety"}`}
          style={{ touchAction: "none" }}
        >
          <svg aria-hidden="true" className="absolute inset-0 -rotate-90" width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={R} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
            <circle cx="36" cy="36" r={R} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
          </svg>
          <span className="relative font-display text-[15px] font-bold uppercase tracking-wide">
            {done ? "Gone" : holding ? remaining.toFixed(1) : "Hold"}
          </span>
        </motion.button>
        <AnimatePresence mode="wait">
          <motion.p key={done ? "done" : holding ? "holding" : "idle"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="text-[12px] text-steel">
            {done ? (
              <button type="button" onClick={reset} className="text-chalk-dim underline decoration-sodium underline-offset-4 hover:text-sodium">
                Rebuild it
              </button>
            ) : holding ? (
              "Keep holding"
            ) : (
              "Press and hold to confirm"
            )}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
