"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/\\|<>+=";
const LINES = ["Steel up.", "Slab down.", "Lights on."];

/**
 * Text that arrives as static and settles letter by letter. Each character
 * locks in from the left; the ones still open cycle through glyphs.
 */
export function ScrambleText() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(LINES[0]);
  const frame = useRef(0);
  const target = LINES[index];
  const started = useRef(false);

  const run = useCallback(
    (to: string) => {
      cancelAnimationFrame(frame.current);
      if (reduced) {
        setText(to);
        return;
      }
      const start = performance.now();
      const perChar = 55;
      const tick = (now: number) => {
        const t = now - start;
        const locked = Math.floor(t / perChar);
        let out = "";
        for (let i = 0; i < to.length; i++) {
          const c = to[i];
          if (c === " ") out += " ";
          else if (i < locked) out += c;
          else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        setText(out);
        if (locked < to.length) frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [reduced],
  );

  // First pass plays once the bay is on screen; later passes come from the controls.
  useEffect(() => {
    const el = frame;
    return () => cancelAnimationFrame(el.current);
  }, []);
  const onEnter = () => {
    if (!started.current) started.current = true;
    run(target);
  };
  const next = () => {
    const i = (index + 1) % LINES.length;
    setIndex(i);
    run(LINES[i]);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <p
        className="select-none font-display text-[clamp(40px,6vw,64px)] font-extrabold uppercase leading-none tracking-tight text-chalk tabular-nums"
        aria-live="polite"
        aria-label={target}
        onPointerEnter={onEnter}
      >
        <span aria-hidden="true">{text}</span>
      </p>
      <button
        type="button"
        onClick={next}
        className="text-[14px] text-chalk-dim underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium"
      >
        Next line
      </button>
    </div>
  );
}
