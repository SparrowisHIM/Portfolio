export type Project = {
  slug: string;
  title: string;
  description: string;
  stack: string[];
  year: string;
  /**
   * The site itself. Floors without one are still being fitted out.
   *
   * **Only ever a URL from `vercel projects ls`, from the repo's own
   * `homepage` field, or from Efe.** `<project-name>.vercel.app` is a
   * single global namespace on Vercel, not a per-account one, so the
   * obvious guess for a project name usually resolves - to a stranger's
   * deployment. Guessing all six of these got two right by luck, and
   * there is no way to tell which two from outside the account:
   * `betslip-printer` really is his, `one-piece-cards` is not - his is
   * `one-piece-cards-rose`. A 200 and a plausible `<title>` prove
   * nothing. Do not guess these.
   */
  live?: string;
  /** Whether the floor reads as finished (glazed) or still raw structure. */
  finished: boolean;
};

/**
 * Floors are ordered bottom to top: the first project is the ground floor,
 * the last one is closest to the crane.
 *
 * The count drives the building: `generateSite`, the section count, the climb
 * rule and the floor rail all read `projects.length`. Adding or removing one
 * changes the massing, so swap rather than append unless that is the intent.
 */
export const projects: Project[] = [
  {
    slug: "vault-market",
    title: "Vault Market",
    description:
      "A trust-first marketplace for graded collectibles. Inspect slabs up close, read market context, and route exceptional cards into specialist review.",
    stack: ["Next.js", "TypeScript", "Tailwind CSS"],
    year: "2026",
    live: "https://vault-market-seven.vercel.app",
    finished: true,
  },
  {
    slug: "mimi-crochet",
    title: "Mimi Crochet",
    description:
      "A storefront for a Nigerian crochet label, in ready-to-wear and made-to-order. Browse the pieces in stock, or send a custom request to have an earlier design remade in your size, colour and fit.",
    stack: ["Next.js", "TypeScript", "Tailwind CSS"],
    year: "2026",
    live: "https://mimicrochet-taupe.vercel.app",
    finished: true,
  },
  {
    slug: "multi-currency-wallet",
    title: "Multi-currency Wallet",
    description:
      "A wallet interface for holding and moving between currencies. Balances, conversions and transfers as a calm, tactile flow.",
    stack: ["React", "TypeScript", "Framer Motion"],
    year: "2026",
    // No Vercel project under `efe-ebomwonyis-projects`, which is his only
    // scope, so this one is built but has never been deployed. The panel
    // says exactly that: "Finished. Not published yet."
    finished: true,
  },
  {
    slug: "betslip-printer",
    title: "Betslip Printer",
    description:
      "A betslip that prints itself. Line-by-line receipt motion with thermal-printer timing, recreated from frame captures of the real thing.",
    stack: ["React", "Framer Motion", "Vite"],
    year: "2026",
    live: "https://betslip-printer.vercel.app",
    finished: false,
  },
  {
    slug: "one-piece-cards",
    title: "One Piece Cards",
    description:
      "An animated stack of character cards. Drag, flick and reshuffle with spring physics tuned so every card feels like it has weight.",
    stack: ["React", "Framer Motion", "Tailwind CSS"],
    year: "2026",
    live: "https://one-piece-cards-rose.vercel.app",
    finished: false,
  },
];

/**
 * Bound for the component yard rather than a floor: a built thing rather than
 * a site. Kept here so the copy and the deployment survive until the yard is
 * rebuilt. Nothing on the front page reads this.
 */
export const yardProjects: Project[] = [
  {
    slug: "kinetic-network-globe",
    title: "Kinetic Network Globe",
    description:
      "A spinning globe with live network arcs between cities. Built directly on three.js to keep the whole thing under one frame budget.",
    stack: ["React", "three.js", "Vite"],
    year: "2026",
    live: "https://kinetic-network-globe.vercel.app",
    finished: true,
  },
];

export const owner = {
  name: "Efe Ebomwonyi",
  role: "Design engineer",
  intro:
    "I build interfaces that move: component libraries, product showcases and the small interactions that make a screen feel finished.",
  github: "https://github.com/SparrowisHIM",
  email: "ebomwonyiefe@gmail.com",
};
