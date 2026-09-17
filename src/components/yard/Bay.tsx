"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type BayProps = {
  number: number;
  title: string;
  description: string;
  tags: string[];
  children: ReactNode;
  /** Wider bays span two columns on large screens. */
  wide?: boolean;
};

const ease = [0.16, 1, 0.3, 1] as const;

/** One bay in the yard: a numbered shelf with a live part on it. */
export function Bay({ number, title, description, tags, children, wide }: BayProps) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, ease }}
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-steel-dim/80 bg-night-deep/60 backdrop-blur-sm transition-colors duration-300 hover:border-steel ${wide ? "lg:col-span-2" : ""}`}
      aria-labelledby={`bay-${number}`}
    >
      {/* Painted bay number, like a mark on the slab. */}
      <span aria-hidden="true" className="pointer-events-none absolute right-4 top-3 select-none font-display text-[64px] font-extrabold leading-none text-steel-dim/50 transition-colors duration-300 group-hover:text-sodium/40">
        {String(number).padStart(2, "0")}
      </span>
      <div className="relative flex min-h-[260px] flex-1 items-center justify-center overflow-hidden border-b border-steel-dim/60 p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bay-grid opacity-60" />
        <div className="relative w-full">{children}</div>
      </div>
      <div className="p-5">
        <h2 id={`bay-${number}`} className="font-display text-[26px] font-bold uppercase leading-none tracking-wide text-chalk">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-chalk-dim">{description}</p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Built with">
          {tags.map((tag) => (
            <li key={tag} className="rounded-full border border-steel-dim px-2.5 py-0.5 text-[12px] text-steel">
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}
