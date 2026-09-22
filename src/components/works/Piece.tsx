"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

export type PieceProps = {
  /** Running number in the set. */
  number: number;
  title: string;
  /** What it is, in a sentence or two. */
  children: ReactNode;
  /** When it was made. */
  date: string;
  /** What kind of thing it is. */
  tag: string;
  /** The live thing itself. */
  stage: ReactNode;
};

/**
 * One piece of work: what it is on the left, the thing itself on the right.
 *
 * Deliberately plain. The format is the one Efe picked off
 * craft.momoyi.design — title, a sentence, a date, a tag, and the live
 * piece beside it — and it is here so there is somewhere true to put the
 * work while he designs what it should actually look like. **Expect this
 * to be replaced.** The component on the stage is the deliverable; this is
 * the shelf it stands on.
 *
 * The stage is light on purpose. These are interface artefacts, not site
 * chrome, and a UI built for a white product page reads as a lie when it
 * is recoloured to match a night-shift construction site. Showing it on
 * its own surface is the same instinct as a product shot.
 */
export function Piece({ number, title, children, date, tag, stage }: PieceProps) {
  const reduced = useReducedMotion();
  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease }}
      className="grid gap-6 border-t border-steel-dim/25 py-10 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-12 md:py-14"
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel">
          {String(number).padStart(2, "0")}
          <span className="text-steel-dim"> · </span>
          {tag}
        </p>
        <h2 className="mt-3 font-display text-[26px] font-bold uppercase leading-none tracking-wide text-chalk md:text-[32px]">
          {title}
        </h2>
        <div className="mt-3 max-w-[34rem] text-[14px] leading-relaxed text-chalk-dim md:text-[15px]">
          {children}
        </div>
        <p className="mt-4 font-mono text-[10px] tracking-[0.06em] text-steel-dim tabular-nums">
          {date}
        </p>
      </div>

      <div className="relative grid min-h-[280px] place-items-center overflow-hidden rounded-xl bg-[#f7f7f6] p-8 md:min-h-[340px]">
        {stage}
      </div>
    </motion.article>
  );
}
