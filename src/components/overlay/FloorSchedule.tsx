"use client";

import { LEVELS } from "@/lib/sheets";

/**
 * The floor schedule, in the margin the model does not use.
 *
 * A drawing of a building carries a table of what is on each level. This
 * page had the data for one and showed it a floor at a time. The levels
 * rule on the far edge answers "where am I"; this answers "what is the
 * whole building", which nothing did — and that thinness is most of the
 * gap the audit measured between a 6 and a 9.
 *
 * It carries status rather than elevation on purpose. Elevation is the
 * rule's job and it prints the active one 80px to the right of this, so a
 * column of metres here read as the same number twice. Status is the thing
 * a schedule can say that a rule cannot.
 *
 * Read top down, roof first, the way the tower is read on screen.
 */
export function FloorSchedule({ section }: { section: number }) {
  const here = Math.min(LEVELS.length - 1, Math.max(0, section));
  const rows = LEVELS.map((level, i) => ({ level, i })).reverse();

  return (
    // Clear of the levels rule: the rule's floating elevation label hangs
    // out to about 68px from the window edge.
    <aside
      aria-label="Floor schedule"
      className="sheet-wide pointer-events-none fixed right-[150px] top-1/2 z-20 w-[236px] -translate-y-1/2 select-none font-mono"
    >
      <p className="mb-1.5 flex items-baseline justify-between text-[9px] uppercase tracking-[0.18em] text-steel">
        <span>Floor schedule</span>
        <span className="tabular-nums text-steel-dim">{LEVELS.length - 1} lvl</span>
      </p>
      <ul className="border-t border-steel-dim/25">
        {rows.map(({ level, i }) => {
          const active = i === here;
          return (
            <li
              key={level.key}
              className={
                "flex items-baseline gap-2 border-b border-steel-dim/15 py-[5px] transition-colors duration-200 " +
                (active ? "text-sodium" : "text-steel")
              }
            >
              <span className="w-[16px] shrink-0 text-[10px] tabular-nums">{level.code}</span>
              <span className={"flex-1 truncate text-[10px] " + (active ? "" : "text-chalk-dim/65")}>
                {level.name}
              </span>
              <span className="shrink-0 text-[9px] uppercase tracking-[0.08em]">
                {level.status ?? "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
