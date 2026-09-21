import { FLOOR_HEIGHT } from "./site-generator";
import { projects } from "./projects";

/**
 * The front page as a drawing set.
 *
 * Every section is a sheet and every floor is a level. The levels rule and
 * the floor schedule both read this list rather than deriving their own,
 * because a rule and a table that each work out where floor three is will
 * eventually disagree about it.
 *
 * The elevations are the ones the building is generated at: a floor sits
 * on the slab below it, so floor one shares +0.00 with the ground it
 * stands on. A section drawing numbers it the same way.
 */
export type Level = {
  key: string;
  href: string;
  /** As painted on the slab: G, 01..05, R. */
  code: string;
  /** Sheet number in the set. */
  sheet: string;
  /** What the sheet is of. */
  name: string;
  /** Metres above the ground slab. Null at ground, which is the datum. */
  elevation: number | null;
  /** Null where a level is not a project and has nothing to report. */
  status: "Complete" | "In the works" | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const LEVELS: readonly Level[] = [
  {
    key: "ground",
    href: "#ground",
    code: "G",
    sheet: "00",
    name: "Setting out",
    elevation: null,
    status: null,
  },
  ...projects.map((project, i) => ({
    key: project.slug,
    href: `#${project.slug}`,
    code: pad(i + 1),
    sheet: pad(i + 1),
    name: project.title,
    elevation: i * FLOOR_HEIGHT,
    status: (project.finished ? "Complete" : "In the works") as Level["status"],
  })),
  {
    key: "contact",
    href: "#contact",
    code: "R",
    sheet: pad(projects.length + 1),
    name: "Handover",
    elevation: projects.length * FLOOR_HEIGHT,
    status: null,
  },
];

/** Elevation of the last slab, for the title block. */
export const TOP_ELEVATION = projects.length * FLOOR_HEIGHT;

/** The level being read. `section` can overshoot at either end. */
export function levelAt(section: number): Level {
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, section))];
}

/** How an elevation is written on a drawing. */
export function elevation(metres: number | null): string {
  return metres === null ? "±0.00" : `+${metres.toFixed(2)}`;
}
