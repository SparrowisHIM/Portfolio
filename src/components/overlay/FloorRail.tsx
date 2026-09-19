"use client";

import { projects } from "@/lib/projects";

/**
 * The lift panel: every level in the building, as a call button.
 *
 * A phone has no hover, so the tower cannot be the navigation the way it is
 * on a desktop — pointing at a storey is not a gesture a thumb has. This is
 * the same job done the way a building does it: a column of floors down the
 * edge of the screen, the one you are on lit, tap to travel.
 *
 * Links rather than buttons, because they go somewhere: the browser gets
 * the back button and the keyboard for free, and the smooth scroll is the
 * one already set on the document.
 */
export function FloorRail({ section, sectionCount }: { section: number; sectionCount: number }) {
  const stops = [
    { key: "ground", href: "#ground", label: "G", name: "Ground level" },
    ...projects.map((project, i) => ({
      key: project.slug,
      href: `#${project.slug}`,
      label: String(i + 1),
      name: `Floor ${i + 1}: ${project.title}`,
    })),
    { key: "contact", href: "#contact", label: "R", name: "Roof: get in touch" },
  ];

  return (
    <nav
      aria-label="Floors"
      className="pointer-events-none fixed right-2 top-[46%] z-20 -translate-y-1/2 md:hidden"
    >
      {/* Top to bottom on screen is roof to ground: the rail is an elevation
          of the building, so the numbers have to climb the way it does. */}
      <ul className="pointer-events-auto flex flex-col-reverse gap-1.5">
        {stops.map((stop, i) => {
          const here = i === Math.min(sectionCount - 1, Math.max(0, section));
          return (
            <li key={stop.key}>
              <a
                href={stop.href}
                aria-label={stop.name}
                aria-current={here ? "true" : undefined}
                className={
                  "flex h-8 w-8 items-center justify-center rounded-md border text-[12px] font-semibold tabular-nums transition-colors duration-200 " +
                  (here
                    ? "border-sodium bg-sodium text-night-deep"
                    : "border-steel-dim/50 bg-night-deep/60 text-steel backdrop-blur")
                }
              >
                {stop.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
