"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { owner, projects } from "@/lib/projects";

const modes = [
  { label: "Site", href: "/" },
  { label: "Works", href: "/works" },
];

/** The site sign at the gate: who is building here, and where to go. */
export function SiteSign() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const onSite = pathname === "/";

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-5 pt-5 md:px-8 md:pt-7">
      <Link href={onSite ? "#ground" : "/"} className="pointer-events-auto block leading-tight" aria-label="Back to ground level">
        <span className="block font-display text-[22px] font-bold uppercase tracking-wide text-chalk">{owner.name}</span>
        <span className="block text-[13px] text-chalk-dim">{owner.role}</span>
      </Link>
      <div className="pointer-events-auto flex items-center gap-4 md:gap-6">
        {/* Mode switch: the showcase site, or the parts it is built from. */}
        <nav aria-label="Mode" className="relative flex h-9 items-center rounded-full border border-steel-dim bg-night-deep/70 p-1 text-[13px] backdrop-blur">
          {modes.map((mode) => {
            const active = mode.href === "/" ? onSite : pathname.startsWith(mode.href);
            return (
              <Link
                key={mode.href}
                href={mode.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-3 py-1 transition-colors duration-200 ${active ? "text-night-deep" : "text-chalk-dim hover:text-chalk"}`}
              >
                {active && (
                  <motion.span
                    layoutId="mode-pill"
                    className="absolute inset-0 rounded-full bg-sodium"
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{mode.label}</span>
              </Link>
            );
          })}
        </nav>
        {onSite && (
          <nav aria-label="Site" className="hidden gap-5 text-[14px] sm:flex">
            <a href={`#${projects[0].slug}`} className="text-chalk-dim transition-colors duration-200 hover:text-sodium">
              Work
            </a>
            <a href="#contact" className="text-chalk-dim transition-colors duration-200 hover:text-sodium">
              Contact
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
