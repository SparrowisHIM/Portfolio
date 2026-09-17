"use client";

import { Bay } from "./Bay";
import { MagneticButton } from "./demos/MagneticButton";
import { ScrambleText } from "./demos/ScrambleText";
import { CardStack } from "./demos/CardStack";
import { Segmented } from "./demos/Segmented";
import { Odometer } from "./demos/Odometer";
import { CableToast } from "./demos/CableToast";
import { HoldToConfirm } from "./demos/HoldToConfirm";

function Line({ children, delay }: { children: string; delay: number }) {
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <span className="rise-in block" style={{ animationDelay: `${delay}s` }}>
        {children}
      </span>
    </span>
  );
}

/** The yard: the parts the site is built from, laid out on numbered bays. */
export function ComponentYard() {
  return (
    <div className="relative min-h-screen bg-night px-5 pb-24 pt-32 md:px-8 md:pt-40">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 yard-backdrop" />
      <header className="relative mx-auto max-w-[80rem]">
        <p className="text-[12px] uppercase tracking-[0.2em] text-sodium">Component yard</p>
        <h1 className="mt-3 select-none font-display text-[clamp(64px,10vw,150px)] font-extrabold uppercase leading-[0.88] tracking-tight text-chalk">
          <Line delay={0.1}>Parts on</Line>
          <Line delay={0.22}>the shelf</Line>
        </h1>
        <p className="fade-in mt-6 max-w-[34rem] text-[16px] leading-relaxed text-chalk-dim" style={{ animationDelay: "0.7s" }}>
          Every interface on the site is put together from parts like these. Each one is live: press it,
          drag it, hold it. They are built with React, Framer Motion and Tailwind, and they respect
          reduced-motion settings.
        </p>
      </header>

      <div className="relative mx-auto mt-14 grid max-w-[80rem] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 md:mt-20">
        <Bay number={1} title="Magnetic button" description="The button leans toward the pointer before you reach it, and the glow follows your hand across it. Springs, no easing curves." tags={["Framer Motion", "springs", "pointer"]}>
          <MagneticButton />
        </Bay>
        <Bay number={2} title="Scrambled headline" description="Copy arrives as static and settles letter by letter, left to right. Hover to send it through again." tags={["text", "requestAnimationFrame", "reveal"]}>
          <ScrambleText />
        </Bay>
        <Bay number={3} title="Card stack" description="Drag the top card and flick it away; it slides under the pile and the rest shuffle up. Every card has weight." tags={["drag", "spring physics", "layout"]}>
          <CardStack />
        </Bay>
        <Bay number={4} title="Segmented control" description="One pill, shared between the options, that slides on a spring. Keyboard works: arrow keys move the selection." tags={["layoutId", "a11y", "radio group"]}>
          <Segmented />
        </Bay>
        <Bay number={5} title="Rolling counter" description="Digits roll like an odometer, each column only as far as it needs to. Recount to watch it settle." tags={["tabular numbers", "springs", "transform"]}>
          <Odometer />
        </Bay>
        <Bay number={6} title="Toast, delivered" description="Notifications are lowered in on a cable, swing, and settle. Dismiss one and the hook takes it back up." tags={["AnimatePresence", "pendulum", "stack"]}>
          <CableToast />
        </Bay>
        <Bay number={7} title="Hold to confirm" description="Destructive actions ask for a held press. The ring fills, the label counts down, release early and it lets go." tags={["press and hold", "SVG", "feedback"]} wide>
          <HoldToConfirm />
        </Bay>
      </div>
    </div>
  );
}
