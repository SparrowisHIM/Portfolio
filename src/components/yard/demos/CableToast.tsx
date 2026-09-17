"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Toast = { id: number; title: string; body: string };

const MESSAGES = [
  { title: "Slab landed", body: "Level 4 is down, dead level." },
  { title: "Wind warning", body: "Gusts over 38 km/h. Crane on standby." },
  { title: "Delivery at the gate", body: "Glazing units for the east elevation." },
  { title: "Shift change", body: "Night crew clocking on in ten minutes." },
];

/** Notifications lowered in on a cable. They swing, settle, and get hoisted away. */
export function CableToast() {
  const reduced = useReducedMotion();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [next, setNext] = useState(0);
  const delivered = useRef(false);

  const deliver = () => {
    const m = MESSAGES[next % MESSAGES.length];
    setNext((n) => n + 1);
    setToasts((t) => [{ id: Date.now(), ...m }, ...t].slice(0, 3));
  };
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <motion.div
      className="flex flex-col items-center gap-4 py-2"
      onViewportEnter={() => {
        // The first one comes down on its own when the bay is in view.
        if (delivered.current) return;
        delivered.current = true;
        deliver();
      }}
      viewport={{ amount: 0.6 }}
    >
      <div className="relative h-[190px] w-full max-w-[300px] overflow-hidden">
        <AnimatePresence>
          {toasts.map((toast, i) => (
            <motion.div
              key={toast.id}
              layout
              initial={reduced ? { opacity: 0 } : { y: -220, rotate: 0, opacity: 1 }}
              animate={{
                y: i * 58,
                rotate: reduced ? 0 : [-3, 2.2, -1.2, 0.5, 0],
                opacity: 1 - i * 0.18,
                scale: 1 - i * 0.04,
                zIndex: 10 - i,
              }}
              exit={reduced ? { opacity: 0 } : { y: -220, opacity: 0.6, transition: { duration: 0.5, ease: [0.4, 0, 0.6, 1] } }}
              transition={reduced ? { duration: 0.2 } : { y: { type: "spring", stiffness: 140, damping: 18, mass: 1.1 }, rotate: { duration: 1.6, ease: "easeOut" }, opacity: { duration: 0.3 } }}
              style={{ transformOrigin: "50% -200px" }}
              className="absolute inset-x-0 top-0"
            >
              {/* The cable, from above the frame to the hook on the card. */}
              <span aria-hidden="true" className="absolute left-1/2 top-[-220px] h-[224px] w-px bg-steel" />
              <span aria-hidden="true" className="absolute left-1/2 top-[-8px] h-3 w-3 -translate-x-1/2 rounded-sm bg-hazard" />
              <div className="flex items-start gap-3 rounded-lg border border-steel-dim bg-night-deep/95 p-3 pr-2 shadow-[0_18px_30px_-18px_rgba(0,0,0,0.9)]">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sodium" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-chalk">{toast.title}</p>
                  <p className="text-[13px] text-chalk-dim">{toast.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label={`Dismiss ${toast.title}`}
                  className="rounded p-1 text-steel transition-colors hover:text-sodium"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 3l8 8M11 3l-8 8" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <button type="button" onClick={deliver} className="text-[14px] text-chalk-dim underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium">
        Lower one in
      </button>
    </motion.div>
  );
}
