"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from "framer-motion";

/**
 * Voice note.
 *
 * A recreation. The original interaction and video are by Nitish Khagwal;
 * this is a rebuild of it in React and Framer Motion, not a copy of his
 * code. The credit belongs on the page as well as here — a portfolio that
 * shows someone else's idea without naming them is the same fault as one
 * that shows work it did not do.
 *
 * Four states, and the whole thing is one row that changes shape:
 *
 *   idle       a single round button with a microphone
 *   recording  cancel · a pill of live level bars · confirm
 *   recorded   cancel · a pill reading the duration · send
 *   playing    the same pill, counting back up
 *
 * The microphone is not real and is not pretending to be. Asking for
 * permission to the mic on a page someone is browsing is a hostile thing
 * to do for a piece of craft, and a denied prompt would leave the demo
 * dead. The levels are a meter, the timer is real, and nothing here claims
 * otherwise.
 */

/** Longest note. Recording stops itself here. */
const MAX_SECONDS = 12;

/** How many bars the level meter has. */
const BARS = 5;

type Phase = "idle" | "recording" | "recorded" | "playing";

/**
 * Per-bar keyframes. Each bar gets its own heights and its own duration so
 * the meter reads as a voice rather than as five things on one timer —
 * that shared-clock look is the tell that a meter is decorative.
 */
const BAR_MOTION = [
  { heights: [8, 20, 11, 24, 9], duration: 0.72 },
  { heights: [14, 9, 22, 12, 18], duration: 0.61 },
  { heights: [10, 24, 13, 19, 11], duration: 0.83 },
  { heights: [18, 11, 20, 9, 22], duration: 0.67 },
  { heights: [9, 17, 10, 21, 13], duration: 0.78 },
];

function Mic() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5l5.2 5.2L20 7" />
    </svg>
  );
}

function Send() {
  // Stroked, like the other three. The filled version of this shape reads
  // as a cursor arrow at 16px unless the tail crease is drawn, and the
  // crease is the line that makes it a paper plane.
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.5 2.5 11 13" />
      <path d="M21.5 2.5 14.8 21.5 11 13 2.5 9.2z" />
    </svg>
  );
}

/** Round icon button, the two either side of the pill. */
function Round({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      layout
      whileTap={reduced ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
    >
      {children}
    </motion.button>
  );
}

export function VoiceNote() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  /** Whole seconds shown on the chip. */
  const [seconds, setSeconds] = useState(0);
  /** How long the finished note is. */
  const [length, setLength] = useState(0);
  const [sent, setSent] = useState(false);

  /*
    Progress drives the stroke that traces the pill, 0 to 1. It is a motion
    value rather than state because it changes every frame: through React it
    would re-render the whole control sixty times a second to move one
    dash offset.
  */
  const progress = useMotionValue(0);
  const dash = useTransform(progress, (p) => 1 - p);
  const run = useRef<AnimationPlaybackControls | null>(null);
  const tick = useRef<number | null>(null);

  const stopClocks = useCallback(() => {
    run.current?.stop();
    run.current = null;
    if (tick.current !== null) {
      window.clearInterval(tick.current);
      tick.current = null;
    }
  }, []);

  useEffect(() => stopClocks, [stopClocks]);

  /** Drive progress to 1 over `span`, showing whole seconds as it goes. */
  const startClock = useCallback(
    (span: number, from: number, onDone: () => void) => {
      stopClocks();
      progress.set(from);
      run.current = animate(progress, 1, {
        duration: span * (1 - from),
        ease: "linear",
        onComplete: onDone,
      });
      tick.current = window.setInterval(() => {
        setSeconds(Math.floor(progress.get() * span));
      }, 200);
    },
    [progress, stopClocks],
  );

  const record = useCallback(() => {
    setSent(false);
    setSeconds(0);
    setPhase("recording");
    startClock(MAX_SECONDS, 0, () => {
      // Ran to the cap on its own. Keep what was captured.
      setLength(MAX_SECONDS);
      setSeconds(MAX_SECONDS);
      setPhase("recorded");
    });
  }, [startClock]);

  const keep = useCallback(() => {
    const done = Math.max(1, Math.round(progress.get() * MAX_SECONDS));
    stopClocks();
    setLength(done);
    setSeconds(done);
    progress.set(0);
    setPhase("recorded");
  }, [progress, stopClocks]);

  const discard = useCallback(() => {
    stopClocks();
    progress.set(0);
    setSeconds(0);
    setLength(0);
    setPhase("idle");
  }, [progress, stopClocks]);

  const play = useCallback(() => {
    setPhase("playing");
    setSeconds(0);
    startClock(length, 0, () => {
      progress.set(0);
      setSeconds(length);
      setPhase("recorded");
    });
  }, [length, startClock, progress]);

  const send = useCallback(() => {
    stopClocks();
    progress.set(0);
    setSent(true);
    setPhase("idle");
    setSeconds(0);
  }, [progress, stopClocks]);

  const recording = phase === "recording";
  const playing = phase === "playing";
  const shown = recording ? seconds : playing ? seconds : length;

  /* The morph. Blur and scale on the way in and out, which is what makes
     one control read as changing shape rather than as three controls
     swapping places. Dropped entirely under reduced motion. */
  const swap = reduced
    ? { initial: false as const, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, filter: "blur(4px)", scale: 0.86 },
        animate: { opacity: 1, filter: "blur(0px)", scale: 1 },
        exit: { opacity: 0, filter: "blur(4px)", scale: 0.86 },
      };

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div layout className="flex items-center gap-2.5" transition={{ type: "spring", stiffness: 480, damping: 36 }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {phase === "idle" ? (
            <motion.div key="mic" layout {...swap} transition={{ duration: 0.22 }}>
              <Round label="Record a voice note" onClick={record}>
                <Mic />
              </Round>
            </motion.div>
          ) : (
            <motion.div key="cancel" layout {...swap} transition={{ duration: 0.22 }}>
              <Round label="Discard this note" onClick={discard}>
                <Cross />
              </Round>
            </motion.div>
          )}

          {phase !== "idle" && (
            <motion.div key="pill" layout {...swap} transition={{ duration: 0.22 }} className="relative">
              <motion.button
                type="button"
                layout
                onClick={recording ? keep : playing ? undefined : play}
                aria-label={
                  recording
                    ? `Recording, ${seconds} seconds. Stop and keep it.`
                    : playing
                      ? `Playing, ${seconds} of ${length} seconds`
                      : `Play the note, ${length} seconds`
                }
                disabled={playing}
                className={
                  "relative grid h-10 place-items-center overflow-hidden rounded-full px-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 " +
                  (recording
                    ? "bg-[#fde3e3] text-[#e5484d]"
                    : "border border-black/10 bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-neutral-50")
                }
              >
                {recording ? (
                  <span className="flex items-end gap-[3px]" aria-hidden="true">
                    {BAR_MOTION.slice(0, BARS).map((bar, i) => (
                      <motion.span
                        key={i}
                        className="w-[3.5px] rounded-full bg-current"
                        style={{ height: 14 }}
                        animate={reduced ? { height: 14 } : { height: bar.heights }}
                        transition={
                          reduced
                            ? { duration: 0 }
                            : { duration: bar.duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
                        }
                      />
                    ))}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-[15px] font-semibold tabular-nums">
                    {playing ? (
                      <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true">
                        <path d="M1 1.4v10.2a.6.6 0 0 0 .92.5l8-5.1a.6.6 0 0 0 0-1l-8-5.1a.6.6 0 0 0-.92.5z" fill="currentColor" />
                      </svg>
                    ) : (
                      <span aria-hidden="true" className="block h-[11px] w-[11px] rounded-[2px] bg-[#e5484d]" />
                    )}
                    {String(shown).padStart(2, "0")}s
                  </span>
                )}
              </motion.button>

              {/*
                The stroke that traces the pill's own border.

                An SVG rounded rect with `pathLength` normalised to 1, so
                one dash covers the whole outline and the offset is the
                progress. Doing it this way means the line follows the
                corner radius exactly — a border-image or a conic gradient
                cuts the corners, which is obvious on a shape this round.
              */}
              {(recording || playing) && (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <motion.rect
                    x="1"
                    y="1"
                    width="calc(100% - 2px)"
                    height="calc(100% - 2px)"
                    rx="19"
                    ry="19"
                    fill="none"
                    stroke="#e5484d"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="1 1"
                    style={{ strokeDashoffset: dash }}
                  />
                </svg>
              )}
            </motion.div>
          )}

          {phase === "recording" && (
            <motion.div key="keep" layout {...swap} transition={{ duration: 0.22 }}>
              <Round label="Stop and keep this note" onClick={keep}>
                <Check />
              </Round>
            </motion.div>
          )}

          {(phase === "recorded" || phase === "playing") && (
            <motion.div key="send" layout {...swap} transition={{ duration: 0.22 }}>
              <Round label="Send this note" onClick={send}>
                <Send />
              </Round>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Said once, for anyone who cannot see the control change shape. */}
      <p aria-live="polite" className="h-4 text-[12px] text-neutral-500">
        {sent ? "Sent." : recording ? "Recording…" : phase === "recorded" ? "Ready to send." : ""}
      </p>
    </div>
  );
}
