"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * The sheet the site is drawn on.
 *
 * Rulers down two edges, crop marks at the corners, and a coordinate
 * readout that follows the pointer. It is the layer that says the page is
 * a drawing rather than a page, and it is what the empty margin either
 * side of the model is for: at 1920 the model is 758px wide and covers
 * 39% of the frame, and no camera move fixes that — the shot is already
 * height-bound and coming in crops the crane's head.
 *
 * Everything here is inert: no pointer events, no focus, aria-hidden. It
 * adds a layer of meaning and nothing to the tab order.
 */

/** Inset of the sheet border from the window edge, in px. */
const EDGE = 16;

function CropMark({ at }: { at: "tl" | "tr" | "bl" | "br" }) {
  const top = at[0] === "t";
  const left = at[1] === "l";
  const vertical: CSSProperties = top ? { top: 0 } : { bottom: 0 };
  const horizontal: CSSProperties = top ? { top: EDGE } : { bottom: EDGE };
  if (left) {
    vertical.left = EDGE;
    horizontal.left = 0;
  } else {
    vertical.right = EDGE;
    horizontal.right = 0;
  }
  return (
    <>
      <span className="absolute h-[9px] w-px bg-steel-dim/45" style={vertical} />
      <span className="absolute h-px w-[9px] bg-steel-dim/45" style={horizontal} />
    </>
  );
}

export function SheetFrame() {
  const readout = useRef<HTMLSpanElement>(null);

  // Written straight to the node, never through state. A pointer move that
  // re-renders React hands every instancedMesh in the scene a fresh args
  // array, and r3f answers that by rebuilding the mesh with an empty matrix
  // buffer — the blank building this project has already paid for once.
  // Moves are coalesced onto one frame, so a fast sweep paints once a frame
  // rather than once an event.
  useEffect(() => {
    let queued = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      queued = 0;
      const node = readout.current;
      if (!node) return;
      const px = String(Math.round(x)).padStart(4, "0");
      const py = String(Math.round(y)).padStart(4, "0");
      node.textContent = `X ${px}   Y ${py}`;
    };
    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!queued) queued = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (queued) cancelAnimationFrame(queued);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 hidden select-none md:block"
    >
      <div className="absolute border border-steel-dim/20" style={{ inset: EDGE }} />

      <CropMark at="tl" />
      <CropMark at="tr" />
      <CropMark at="bl" />
      <CropMark at="br" />

      {/* Ticks read inward off the border, so the sheet measures itself. */}
      <span
        className="rule-x absolute h-[9px]"
        style={{ top: EDGE + 1, left: EDGE, right: EDGE }}
      />
      <span
        className="rule-y absolute w-[9px]"
        style={{ left: EDGE + 1, top: EDGE, bottom: EDGE }}
      />

      {/*
        The note, in the top margin.

        Everything it describes was already true and the page said none of
        it: you could drag the model, click a finished storey to travel to
        it, and get a full turn of the camera once the frame topped out.

        Efe deleted a tooltip that faded in at the end to say so, and was
        right to - a hint that appears, explains the page and goes away
        treats the reader as someone who needs managing. The form that
        works is the reference's: permanent, in the annotation voice, and
        phrased like the person who built the thing rather than like a
        product tour. So it is printed on the sheet with the rulers and the
        coordinates, it never animates, and it is there from the first
        frame to the last.

        The top margin, not the bottom, and that is a measurement. At the
        bottom the free width is whatever the model leaves, and the model
        moves: the plinth's left edge at that height is x=1039 at 1920 and
        x=515 at 1440, so a note wide enough to read printed across the
        deck on any ordinary laptop. Up here the neighbours are the
        wordmark and the nav, which are fixed chrome at known positions,
        and the model never reaches y<80 - the highest thing it ever puts
        in this band is the crane's beacon, at about x=925 on a mid scroll.
        Hence 320 to 880, and a gate at 1360 where the nav still starts at
        about 1033.

        Accurate on purpose. The camera really is leashed until the frame
        tops out, so it says "once it tops out" rather than implying a free
        orbit from the start, and "finished storey" because clicking an
        unbuilt one does nothing.
      */}
      <p
        className="sheet-note absolute max-w-[560px] font-mono text-[10px] leading-[1.7] tracking-[0.05em] text-steel"
        style={{ left: EDGE + 304, top: EDGE + 8 }}
      >
        <span className="text-sodium/80">N.B.</span> this site is live. Drag the model, and click a
        finished storey to go up to it. Once it tops out the camera comes off its leash; Rebuild
        starts a new one.
      </p>

      <span
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tracking-[0.18em] text-steel-dim tabular-nums"
        style={{ bottom: EDGE + 8 }}
      >
        <span ref={readout}>X 0000   Y 0000</span>
      </span>
    </div>
  );
}
