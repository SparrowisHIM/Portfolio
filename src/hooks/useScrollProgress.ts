"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks page scroll as a 0..1 progress value.
 * The ref updates every frame without re-rendering; `section` re-renders
 * only when the nearest section index changes.
 */
export function useScrollProgress(sectionCount: number) {
  const progress = useRef(0);
  const [section, setSection] = useState(0);
  const lastSection = useRef(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress.current = p;
      const next = Math.round(p * (sectionCount - 1));
      if (next !== lastSection.current) {
        lastSection.current = next;
        setSection(next);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sectionCount]);

  return { progress, section };
}
