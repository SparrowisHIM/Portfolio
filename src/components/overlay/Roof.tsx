"use client";

import { motion, useReducedMotion } from "framer-motion";
import { owner } from "@/lib/projects";

export function Roof({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  return (
    <section
      id="contact"
      className="flex h-screen items-end px-5 pb-32 md:items-center md:px-8 md:pb-0 md:pt-24"
    >
      <motion.div
        className="max-w-[28rem]"
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: reduced ? 0.2 : 0.6 }}
        style={{ pointerEvents: active ? "auto" : "none" }}
      >
        <h2 className="font-display text-[clamp(56px,8vw,96px)] font-extrabold uppercase leading-[0.9] tracking-tight text-chalk">
          Next floor
          <br />
          is yours
        </h2>
        <p className="mt-6 text-[15px] leading-relaxed text-chalk-dim">
          {owner.intro}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-chalk-dim">
          The slab is on the hook. If you are building something that needs
          to move, write to me.
        </p>
        <div className="mt-8 flex flex-wrap gap-6 text-[15px]">
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
