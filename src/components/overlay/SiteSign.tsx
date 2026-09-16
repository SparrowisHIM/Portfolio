import { owner, projects } from "@/lib/projects";

const links = [
  { label: "Work", href: `#${projects[0].slug}` },
  { label: "Contact", href: "#contact" },
  { label: "GitHub", href: owner.github, external: true },
];

/** The site sign at the gate: who is building here, and where to go. */
export function SiteSign() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-5 md:px-8 md:pt-7">
      <a
        href="#ground"
        className="pointer-events-auto block leading-tight"
        aria-label="Back to ground level"
      >
        <span className="block font-display text-[22px] font-bold uppercase tracking-wide text-chalk">
          {owner.name}
        </span>
        <span className="block text-[13px] text-chalk-dim">{owner.role}</span>
      </a>
      <nav aria-label="Site" className="pointer-events-auto flex gap-5 pt-1 text-[14px]">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noreferrer" : undefined}
            className="text-chalk-dim transition-colors duration-200 hover:text-sodium"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
