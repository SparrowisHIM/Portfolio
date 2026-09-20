"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { COPY_IN, LIFT } from "@/lib/handover";
import { owner } from "@/lib/projects";

export function Roof({ active, onPlay }: { active: boolean; onPlay: () => void }) {
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  // This was the one card on a timer rather than on the scroll, so floor
  // five faded out on its own schedule and the roof faded in on another,
  // and the two did not meet. Same arrival rule as every floor now; there
  // is no departure because there is nothing above it.
  const { scrollYProgress } = useScroll({ target: section, offset: ["start end", "end start"] });
  const travel = useTransform(scrollYProgress, [...COPY_IN], [0, 1]);
  const rise = useTransform(scrollYProgress, [...COPY_IN], [LIFT, 0]);
  return (
    <section
      ref={section}
      id="contact"
      className="h-screen md:flex md:items-center md:px-8 md:pt-24"
    >
      <motion.div
        className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] rounded-xl border border-steel-dim/45 bg-night-deep/80 p-4 backdrop-blur-md md:inset-x-auto md:bottom-auto md:left-8 md:top-[22vh] md:w-auto md:max-w-[28rem] md:rounded-none md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
        style={{
          opacity: travel,
          y: reduced ? 0 : rise,
          pointerEvents: active ? "auto" : "none",
        }}
      >
        <h2 className="select-none font-display text-[clamp(38px,8vw,96px)] font-extrabold uppercase leading-[0.9] tracking-tight text-chalk">
          Next floor
          <br />
          is yours
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-chalk-dim md:mt-6 md:text-[15px]">
          {owner.intro}
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-chalk-dim md:mt-3 md:text-[15px]">
          The slab is on the hook. If you are building something that needs
          to move, write to me. Or{" "}
          <button
            type="button"
            onClick={onPlay}
            className="text-chalk underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium"
            tabIndex={active ? 0 : -1}
          >
            clock on for a night shift
          </button>{" "}
          and stack the next floors yourself.
        </p>
        <div className="mt-4 flex flex-wrap gap-5 text-[14px] md:mt-8 md:gap-6 md:text-[15px]">
          <a
            href={`mailto:${owner.email}`}
            className="text-chalk underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium"
            tabIndex={active ? 0 : -1}
          >
            {owner.email}
          </a>
          <a
            href={owner.github}
            target="_blank"
            rel="noreferrer"
            className="text-chalk underline decoration-steel-dim decoration-1 underline-offset-[6px] transition-colors hover:text-sodium hover:decoration-sodium"
            tabIndex={active ? 0 : -1}
          >
            GitHub
          </a>
        </div>
      </motion.div>
    </section>
  );
}
