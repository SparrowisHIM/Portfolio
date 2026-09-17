"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";

type Card = { id: number; title: string; note: string; tone: string };

const CARDS: Card[] = [
  { id: 1, title: "Permit 0412", note: "Crane lift, level 3 slab", tone: "#f5b043" },
  { id: 2, title: "Permit 0413", note: "Hot works, column welding", tone: "#ff6a2b" },
  { id: 3, title: "Permit 0414", note: "Glazing, east elevation", tone: "#d7e6ff" },
  { id: 4, title: "Permit 0415", note: "Core pour, night shift", tone: "#3ddc84" },
];

/** A stack of cards with weight. Flick the top one and it goes under the pile. */
export function CardStack() {
  const reduced = useReducedMotion();
  const [cards, setCards] = useState(CARDS);

  const send = () => setCards((c) => [...c.slice(1), c[0]]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) send();
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative h-[168px] w-[240px]" style={{ perspective: 800 }}>
        <AnimatePresence initial={false}>
          {cards.map((card, i) => {
            const top = i === 0;
            return (
              <motion.div
                key={card.id}
                layout
                drag={top && !reduced ? "x" : false}
                dragSnapToOrigin
                dragElastic={0.7}
                onDragEnd={top ? onDragEnd : undefined}
                initial={{ scale: 0.9, y: 30, opacity: 0 }}
                animate={{
                  scale: 1 - i * 0.05,
                  y: i * 12,
                  rotate: reduced ? 0 : (i % 2 ? 1 : -1) * i * 1.5,
                  opacity: 1 - i * 0.12,
                  zIndex: cards.length - i,
                }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                whileDrag={{ rotate: 0, scale: 1.04, cursor: "grabbing" }}
                className="absolute inset-0 select-none rounded-lg border border-steel-dim bg-night-deep p-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]"
                style={{ cursor: top ? "grab" : "default", touchAction: "pan-y" }}
                aria-hidden={!top}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-steel">Permit to work</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: card.tone }} />
                </div>
                <p className="mt-5 font-display text-[28px] font-bold uppercase leading-none text-chalk">{card.title}</p>
                <p className="mt-2 text-[13px] text-chalk-dim">{card.note}</p>
                <p className="mt-4 text-[11px] text-steel">Valid tonight only</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <button
        type="button"
        onClick={send}
        className="text-[14px] text-chalk-dim underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium"
      >
        Next permit
      </button>
    </div>
  );
}
