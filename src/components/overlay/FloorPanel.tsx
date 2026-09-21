"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { COPY_BAND, COPY_KEYS, LIFT_KEYS } from "@/lib/handover";
import type { Project } from "@/lib/projects";
import { LEVELS, elevation } from "@/lib/sheets";

type FloorPanelProps = {
  project: Project;
  /** Floor number as painted on the slab, counting up from the ground. */
  number: number;
  active: boolean;
  /** Open the live project in place. */
  onWalkIn?: (project: Project) => void;
};

/** One row of the floor's specification. */
function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-steel-dim/15 py-[5px]">
      <dt className="w-[66px] shrink-0 text-[9px] uppercase tracking-[0.16em] text-steel-dim">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 truncate text-[10px] tracking-[0.03em] text-chalk-dim tabular-nums">
        {children}
      </dd>
    </div>
  );
}

/** One project per floor. The panel switches on like a work lamp. */
export function FloorPanel({ project, number, active, onWalkIn }: FloorPanelProps) {
  const reduced = useReducedMotion();
  const code = String(number).padStart(2, "0");
  const level = LEVELS.find((l) => l.key === project.slug);
  /*
    The host on its own, because the scheme and the trailing slash are
    noise in a table and the reader is being told where this is, not given
    something to copy. The link underneath is the thing you click.
  */
  const host = project.live ? project.live.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;
  const section = useRef<HTMLElement>(null);
  // The copy is tied to where its own floor sits on screen, not to a
  // rounded section index, so it is already dark by the time it would
  // otherwise slide up through the wordmark. The window itself is the
  // shared handover rule — see `handover.ts` for why the out band is the
  // in band plus exactly a half.
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start end", "end start"],
  });
  const travel = useTransform(scrollYProgress, [...COPY_BAND], [...COPY_KEYS]);
  const rise = useTransform(scrollYProgress, [...COPY_BAND], [...LIFT_KEYS]);
  // Arriving on a floor switches the panel on like a work lamp.
  const flicker = reduced
    ? { opacity: 1 }
    : { opacity: active ? [0.35, 0.95, 0.5, 1] : 1 };

  return (
    <section
      ref={section}
      id={project.slug}
      className="h-screen md:flex md:items-center md:px-8 md:pt-24"
      aria-label={`Floor ${number}: ${project.title}`}
    >
      {/* Pinned clear of the wordmark: the copy parks in its band and fades
          out rather than sliding up through the header. On a phone it parks
          at the foot of the screen instead.

          Fixed on both, and sticky on neither. Sticky cannot do this job:
          sticky only ever pulls an element back up toward an edge, so until
          the section has scrolled far enough to engage it the card is just
          in flow, riding its own section down the screen. On a tall window
          that only looked slightly loose. On a short one — 820px, an
          ordinary laptop — the card sat at two thirds height and ran its
          last two lines off the bottom of the screen, under the night-shift
          button. There is nothing to line the card up with anyway: it is an
          overlay on a 3D scene, so it belongs in a fixed band of the
          viewport, which is what `travel` already assumes.

          All six stack in the same band and only the one whose floor is on
          screen is visible, which is how the phone has always done it. */}
      <motion.div
        className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:left-8 md:top-[22vh] md:w-auto md:max-w-[26rem]"
        style={{
          opacity: travel,
          y: reduced ? 0 : rise,
          pointerEvents: active ? "auto" : "none",
        }}
      >
        <motion.div
          initial={false}
          animate={flicker}
          transition={
            reduced
              ? { duration: 0.2 }
              : { duration: 0.55, times: [0, 0.2, 0.35, 1], ease: "linear" }
          }
          className="rounded-xl border border-steel-dim/45 bg-night-deep/80 p-4 backdrop-blur-md md:rounded-none md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
        >
        {/* The copy column joins the drawing set: sheet number, and the
            status the schedule is reporting for this level. */}
        <p className="mb-2 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-steel md:block">
          Sheet {code}
          <span className="text-steel-dim"> · </span>
          {project.finished ? "Complete" : "In the works"}
        </p>
        <p className="flex items-baseline gap-3">
          <span className="select-none font-display text-[46px] font-extrabold leading-none text-sodium md:text-[84px]">
            {number}
          </span>
          <span className="text-[14px] text-chalk-dim">Floor</span>
          <span className="font-mono text-[11px] tracking-widest text-steel tabular-nums">
            {project.year}
          </span>
        </p>
        <h2 className="select-none mt-2 font-display text-[28px] font-bold uppercase leading-none tracking-wide text-chalk md:mt-4 md:text-[40px]">
          {project.title}
        </h2>
        <p className="mt-2.5 text-[13px] leading-relaxed text-chalk-dim md:mt-4 md:text-[15px]">
          {project.description}
        </p>
        {/*
          The specification, as a drawing states one.

          The audit's complaint was that a floor carried a number, a title,
          two lines and a stack list against a reference row carrying a
          paragraph, a caption, a range, a status and a count. The answer is
          not to invent copy about the work - that is how a portfolio starts
          lying - it is to say the things that are already true and were
          going unsaid. The elevation is the one on the rule, the host is the
          one the link actually opens, and the level count is the building
          you are standing in front of.
        */}
        <dl className="mt-3 hidden border-t border-steel-dim/25 font-mono md:mt-5 md:block">
          <Spec label="Level">
            {code} of {String(LEVELS.length - 2).padStart(2, "0")}
            <span className="text-steel-dim"> · </span>
            {elevation(level?.elevation ?? null)}
          </Spec>
          <Spec label="Stack">{project.stack.join(" · ")}</Spec>
          <Spec label="Published">
            {host ?? <span className="text-steel">Not yet</span>}
          </Spec>
        </dl>

        {/* On a phone the specification is a line, not a table. */}
        <p className="mt-2.5 text-[12px] text-steel md:hidden">
          {project.stack.join(", ")}
          {project.finished ? "" : " (still in progress)"}
        </p>

        {/*
          Every figure on the reference is captioned, and the figure here is
          the storey standing next to the words. Captioning it is what ties
          the column to the model rather than leaving them as two things on
          one screen.
        */}
        <p className="mt-3 hidden font-mono text-[10px] leading-relaxed text-steel md:mt-4 md:block">
          Fig {number}.1
          <span className="text-steel-dim"> — </span>
          Level {code},{" "}
          {project.finished
            ? "glazed and occupied."
            : "frame up, fit-out to follow."}
        </p>
        <div className="mt-4 flex flex-wrap gap-6 text-[14px] md:mt-6">
          {project.live ? (
            <>
              <a
                href={project.live}
                target="_blank"
                rel="noreferrer"
                className="text-chalk underline decoration-sodium decoration-1 underline-offset-[6px] transition-colors hover:text-sodium"
                tabIndex={active ? 0 : -1}
              >
                Visit the site
              </a>
              <button
                type="button"
                onClick={() => onWalkIn?.(project)}
                className="text-chalk underline decoration-steel-dim decoration-1 underline-offset-[6px] transition-colors hover:text-sodium hover:decoration-sodium"
                tabIndex={active ? 0 : -1}
              >
                Walk in
              </button>
            </>
          ) : (
            // Phone only. Above the breakpoint the specification's PUBLISHED
            // row already says this, and the two together said it twice.
            //
            // Two different states were saying the same sentence before
            // that. A floor flagged finished with no URL is built and
            // unpublished; a floor that is not finished is still being
            // fitted out. Saying "fit-out in progress" on a glazed storey
            // contradicts the model standing next to it.
            <span className="text-steel md:hidden">
              {project.finished
                ? "Finished. Not published yet."
                : "Fit-out in progress. Opens soon."}
            </span>
          )}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
