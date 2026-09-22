import type { Metadata } from "next";
import { SiteSign } from "@/components/overlay/SiteSign";
import { Piece } from "@/components/works/Piece";
import { VoiceNote } from "@/components/works/VoiceNote";

export const metadata: Metadata = {
  // The layout's template appends his name.
  title: "Works",
  description:
    "Interface pieces Efe Ebomwonyi has built: interactions rebuilt from the work of designers he admires, and the studies that come out of them.",
};

/**
 * Works.
 *
 * This page used to be the component yard and used to hold seven things —
 * a magnetic button, a scrambled headline, a card stack and so on. **None
 * of them were Efe's.** They were invented by the tool that first
 * scaffolded this repo, from a prompt that asked for a component page and
 * never said what should be on it. He expected it blank. They were live
 * under his name for a day, which is worse than an empty page has ever
 * been, so they are gone.
 *
 * What replaces them is real and arrives one piece at a time. The rule
 * that goes with it: **a rebuild of someone else's interaction names them,
 * every time.** That is not politeness, it is the difference between this
 * page and the one it replaced.
 */
export default function WorksPage() {
  return (
    <main className="relative min-h-screen bg-night px-5 pb-28 pt-32 md:px-8 md:pt-40">
      <SiteSign />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 yard-backdrop" />

      <header className="relative mx-auto max-w-[76rem]">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel">
          Sheet 07<span className="text-steel-dim"> · </span>Works
        </p>
        <h1 className="mt-3 select-none font-display text-[clamp(56px,9vw,132px)] font-extrabold uppercase leading-[0.88] tracking-tight text-chalk">
          Off the
          <br />
          shelf
        </h1>
        <p className="mt-6 max-w-[38rem] text-[15px] leading-relaxed text-chalk-dim md:text-[17px]">
          Interface pieces, built to find out how they are made. Several are
          rebuilds of interactions designed by other people; where that is the
          case, they are named. Everything here is live — press it.
        </p>
      </header>

      <div className="relative mx-auto mt-14 max-w-[76rem] md:mt-20">
        <Piece
          number={1}
          title="Voice note"
          tag="Interaction rebuild"
          date="22 September 2026"
          stage={<VoiceNote />}
        >
          <p>
            A voice note that records, keeps, plays back and sends — one control
            that changes shape through all four. The stroke tracing the pill is
            the clock, and it traces the border itself rather than approximating
            it, which is the part that takes the work.
          </p>
          <p className="mt-3 text-steel">
            The original interaction and video are by{" "}
            <a
              href="https://x.com/nitishkmrk"
              target="_blank"
              rel="noreferrer"
              className="text-chalk underline decoration-sodium decoration-1 underline-offset-[5px] transition-colors hover:text-sodium"
            >
              Nitish Khagwal
            </a>
            . Rebuilt here in React and Framer Motion. The microphone is a meter,
            not a recorder, and does not ask for permission it would not use.
          </p>
        </Piece>

        <p className="border-t border-steel-dim/25 pt-10 font-mono text-[11px] leading-relaxed text-steel-dim">
          One piece. The rest are being built — this page stays honest and short
          rather than full and borrowed.
        </p>
      </div>
    </main>
  );
}
