"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { LEVELS, TOP_ELEVATION, elevation, levelAt } from "@/lib/sheets";

/**
 * The title block, bottom left, where a drawing puts it.
 *
 * Everything in here was already in the app and unsaid: the seed the site
 * was generated from, the lamp it is lit by, how many levels went up, how
 * high the last slab sits. The one line already written in this voice —
 * "Site no. 20260916, arc lighting" — was floating loose under the rebuild
 * button with nothing to belong to. This is the system it belongs to.
 *
 * The clock is the live data a site carries, and it decides the shift,
 * which is the only honest way this page can claim to be a night one.
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const two = (n: number) => String(n).padStart(2, "0");

/** Day shift is 06:00 to 18:00. Everything else is nights. */
function stamp(now: Date) {
  const hours = now.getHours();
  return {
    date: `${two(now.getDate())} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    time: `${two(hours)}:${two(now.getMinutes())}`,
    shift: hours >= 6 && hours < 18 ? "Day" : "Night",
  };
}

/**
 * The clock, as an external store rather than state set from an effect.
 *
 * It has to be one: rendering the time on the server ships one value in
 * the HTML and hydrates to another. `getServerSnapshot` returns null, so
 * the first paint on both sides is the dash, and the client swaps in the
 * real stamp on the tick after hydration.
 */
const TICK = 30_000;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, TICK);
  return () => window.clearInterval(id);
}

/**
 * Bucketed to the tick. A raw `Date.now()` would be a new value on every
 * read, and a snapshot that never compares equal re-renders forever.
 */
function getSnapshot(): number | null {
  return Math.floor(Date.now() / TICK);
}

function getServerSnapshot(): number | null {
  return null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-t border-steel-dim/20 py-[4px] first:border-t-0">
      <span className="w-[52px] shrink-0 text-[9px] uppercase tracking-[0.16em] text-steel-dim">
        {label}
      </span>
      <span className="truncate text-[10px] tracking-[0.03em] text-chalk-dim tabular-nums">
        {children}
      </span>
    </div>
  );
}

type TitleBlockProps = {
  section: number;
  seed: number;
  /** Name of the lighting rig on the current site. */
  lamp: string;
};

export function TitleBlock({ section, seed, lamp }: TitleBlockProps) {
  const level = levelAt(section);
  const last = LEVELS[LEVELS.length - 1];

  // A tick every half minute: the readout has no seconds, so a faster one
  // paints nothing. The render stays inside this leaf, so the scene below
  // never sees it.
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const when = tick === null ? null : stamp(new Date());

  return (
    <aside
      aria-label="Drawing title block"
      className="sheet-block pointer-events-none fixed bottom-8 left-8 z-20 w-[264px] select-none font-mono"
    >
      <p className="mb-2 text-[9px] uppercase tracking-[0.22em] text-steel">
        Sheet {level.sheet} <span className="text-steel-dim">of</span> {last.sheet}
      </p>
      {/*
        Four rows, and it is a measurement rather than a taste.

        The hero card is the tallest copy on the page — a 200px headline
        over two lines — and at 1920x980 it runs to y=802. Anchored to the
        foot of the sheet, a six-row block started at 758 and the "Climb"
        link printed straight through it. Four rows at this leading start
        at 820. Add a row back and it collides again on the ground sheet
        only, which is exactly the kind of fault that looks fine on every
        floor you happen to screenshot.

        What went: the project row, which the headline already says, and
        the drawing row, which the copy column's own sheet label says.
      */}
      <div className="border border-steel-dim/25 px-3 py-1.5">
        <Row label="Site no">{seed.toString(16).padStart(8, "0")}</Row>
        <Row label="Lamp">{lamp} lighting</Row>
        <Row label="Levels">
          {LEVELS.length - 1} risers, top {elevation(TOP_ELEVATION)}
        </Row>
        <Row label="Shift">
          {when ? `${when.shift}, ${when.time} · ${when.date}` : "—"}
        </Row>
      </div>
    </aside>
  );
}
