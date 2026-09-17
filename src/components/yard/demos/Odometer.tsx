"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const DIGIT = 52;

function Column({ digit, delay }: { digit: number; delay: number }) {
  const reduced = useReducedMotion();
  return (
    <span className="relative inline-block h-[52px] w-[0.62em] overflow-hidden" aria-hidden="true">
      <motion.span
        className="absolute left-0 top-0 flex flex-col items-center"
        animate={{ y: -digit * DIGIT }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20, mass: 0.9, delay }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="flex h-[52px] items-center justify-center">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/** Digits that roll like an odometer, each column only as far as it has to. */
export function Odometer() {
  const [value, setValue] = useState(20260916);
  const [tonnes, setTonnes] = useState(1284);

  const recount = () => {
    setValue((v) => v + Math.floor(Math.random() * 900 + 100));
    setTonnes(Math.floor(900 + Math.random() * 4000));
  };

  useEffect(() => {
    const id = setInterval(() => setTonnes((t) => t + Math.floor(Math.random() * 3)), 2600);
    return () => clearInterval(id);
  }, []);

  const digits = String(value).split("").map(Number);
  const tonneDigits = String(tonnes).padStart(4, "0").split("").map(Number);

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div>
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-steel">Site number</p>
        <p className="mt-1 font-display text-[44px] font-extrabold leading-none text-chalk tabular-nums" aria-label={String(value)}>
          {digits.map((d, i) => (
            <Column key={i} digit={d} delay={(digits.length - i) * 0.04} />
          ))}
        </p>
      </div>
      <div>
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-steel">Concrete poured, tonnes</p>
        <p className="mt-1 text-center font-display text-[44px] font-extrabold leading-none text-sodium tabular-nums" aria-label={String(tonnes)}>
          {tonneDigits.map((d, i) => (
            <Column key={i} digit={d} delay={(tonneDigits.length - i) * 0.04} />
          ))}
        </p>
      </div>
      <button type="button" onClick={recount} className="text-[14px] text-chalk-dim underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium">
        Recount
      </button>
    </div>
  );
}
