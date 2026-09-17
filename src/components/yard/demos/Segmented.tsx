"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const OPTIONS = [
  { id: "day", label: "Day", crew: 14 },
  { id: "night", label: "Night", crew: 7 },
  { id: "weekend", label: "Weekend", crew: 3 },
];

/** A radio group drawn as one sliding pill, with a readout that counts across. */
export function Segmented() {
  const reduced = useReducedMotion();
  const [value, setValue] = useState("night");
  const name = useId();
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];

  const onKey = (e: React.KeyboardEvent) => {
    const i = OPTIONS.findIndex((o) => o.id === value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setValue(OPTIONS[(i + 1) % OPTIONS.length].id);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setValue(OPTIONS[(i - 1 + OPTIONS.length) % OPTIONS.length].id);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div role="radiogroup" aria-label="Shift" onKeyDown={onKey} className="relative flex rounded-full border border-steel-dim bg-night-deep p-1">
        {OPTIONS.map((option) => {
          const active = option.id === value;
          return (
            <label key={option.id} className={`relative cursor-pointer select-none rounded-full px-5 py-2 text-[14px] transition-colors duration-200 ${active ? "text-night-deep" : "text-chalk-dim hover:text-chalk"}`}>
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={active}
                onChange={() => setValue(option.id)}
                className="sr-only"
              />
              {active && (
                <motion.span
                  layoutId={`${name}-pill`}
                  className="absolute inset-0 rounded-full bg-sodium"
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 36 }}
                />
              )}
              <span className="relative">{option.label}</span>
            </label>
          );
        })}
      </div>
      <p className="flex items-baseline gap-2 text-[14px] text-chalk-dim">
        <span className="relative inline-block h-[40px] w-[2.2ch] overflow-hidden font-display text-[40px] font-extrabold leading-none text-chalk tabular-nums">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={current.crew}
              initial={reduced ? false : { y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="absolute inset-0 text-right"
            >
              {current.crew}
            </motion.span>
          </AnimatePresence>
        </span>
        on the {current.label.toLowerCase()} shift
      </p>
    </div>
  );
}
