"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

/** A button that leans toward the pointer, with a glow that follows the hand. */
export function MagneticButton() {
  const ref = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.6 });
  const tx = useTransform(sx, (v) => v * 0.35);
  const ty = useTransform(sy, (v) => v * 0.35);
  const glow = useTransform([glowX, glowY], ([gx, gy]) => `radial-gradient(120px circle at ${gx}% ${gy}%, rgba(245,176,67,0.45), transparent 70%)`);

  const move = (e: React.PointerEvent) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    x.set(dx);
    y.set(dy);
    glowX.set(((e.clientX - r.left) / r.width) * 100);
    glowY.set(((e.clientY - r.top) / r.height) * 100);
  };
  const leave = () => {
    x.set(0);
    y.set(0);
    glowX.set(50);
    glowY.set(50);
  };

  return (
    <div className="flex items-center justify-center py-6" onPointerMove={move} onPointerLeave={leave}>
      <motion.button
        ref={ref}
        type="button"
        style={{ x: sx, y: sy }}
        whileTap={reduced ? undefined : { scale: 0.96 }}
        className="relative overflow-hidden rounded-full border border-sodium/60 bg-night-deep px-8 py-4 font-display text-[20px] font-bold uppercase tracking-wide text-chalk transition-colors hover:border-sodium"
      >
        <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: glow }} />
        <motion.span className="relative block" style={{ x: tx, y: ty }}>
          Start the pour
        </motion.span>
      </motion.button>
    </div>
  );
}
