export type Project = {
  slug: string;
  title: string;
  description: string;
  stack: string[];
  year: string;
  repo: string;
  live?: string;
  /** Whether the floor reads as finished (glazed) or still raw structure. */
  finished: boolean;
};

/**
 * Floors are ordered bottom to top: the first project is the ground floor,
 * the last one is closest to the crane.
 */
export const projects: Project[] = [
  {
    slug: "vault-market",
    title: "Vault Market",
    description:
      "A trust-first marketplace for graded collectibles. Inspect slabs up close, read market context, and route exceptional cards into specialist review.",
    stack: ["Next.js", "TypeScript", "Tailwind CSS"],
    year: "2026",
    repo: "https://github.com/SparrowisHIM/Vault-market",
    live: "https://vault-market-seven.vercel.app",
    finished: true,
  },
  {
    slug: "kinetic-network-globe",
    title: "Kinetic Network Globe",
    description:
      "A spinning globe with live network arcs between cities. Built directly on three.js to keep the whole thing under one frame budget.",
    stack: ["React", "three.js", "Vite"],
    year: "2026",
    repo: "https://github.com/SparrowisHIM/Kinetic-Network-Globe",
    finished: true,
  },
  {
    slug: "multi-currency-wallet",
    title: "Multi-currency Wallet",
    description:
      "A wallet interface for holding and moving between currencies. Balances, conversions and transfers as a calm, tactile flow.",
    stack: ["React", "TypeScript", "Framer Motion"],
    year: "2026",
    repo: "https://github.com/SparrowisHIM/Multi-currency-Wallet",
    finished: true,
  },
  {
    slug: "betslip-printer",
    title: "Betslip Printer",
    description:
      "A betslip that prints itself. Line-by-line receipt motion with thermal-printer timing, recreated from frame captures of the real thing.",
    stack: ["React", "Framer Motion", "Vite"],
    year: "2026",
    repo: "https://github.com/SparrowisHIM/betslip-printer",
    finished: false,
  },
  {
    slug: "one-piece-cards",
    title: "One Piece Cards",
    description:
      "An animated stack of character cards. Drag, flick and reshuffle with spring physics tuned so every card feels like it has weight.",
    stack: ["React", "Framer Motion", "Tailwind CSS"],
    year: "2026",
    repo: "https://github.com/SparrowisHIM/cards-animation",
    finished: false,
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
