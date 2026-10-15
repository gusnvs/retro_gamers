"use client";

import { useEffect, useRef } from "react";
import { runsToPath, trail } from "@/lib/trail";

// Global pixel-trail layer. Sits under the GL canvas (devices stay on top, like the
// reference) and above the page:
//  - "invert" areas (brand backgrounds): backdrop invert+grayscale+contrast turns the
//    brand colour black and black text white (reference uColor->uColor2 / text white);
//    the outer ring adds sepia+saturate+hue to paint the text rainbow.
//  - "difference" areas (dark backgrounds): brand colour with difference blend, so
//    #101010 becomes brand and brand text becomes black.
export default function TrailOverlay() {
  const core = useRef<HTMLDivElement>(null);
  const fringe = useRef<HTMLDivElement>(null);
  const diffCore = useRef<HTMLDivElement>(null);
  const diffFringe = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trail.init();
    if (!trail.isEnabled) return;
    const set = (el: HTMLDivElement | null, d: string) => {
      if (!el) return;
      el.style.clipPath = d ? `path(nonzero, "${d}")` : "inset(50%)";
      el.style.visibility = d ? "visible" : "hidden";
    };
    return trail.subscribe((f) => {
      const hue = (f.time * 240) % 360;
      fringe.current?.style.setProperty("--h", `${hue}deg`);
      diffFringe.current?.style.setProperty("--h", `${hue}deg`);
      set(core.current, runsToPath(f.runs, f.cell, 0, 0, (r) => r.mode === "invert" && r.core));
      set(fringe.current, runsToPath(f.runs, f.cell, 0, 0, (r) => r.mode === "invert" && !r.core));
      set(diffCore.current, runsToPath(f.runs, f.cell, 0, 0, (r) => r.mode === "difference" && r.core));
      set(diffFringe.current, runsToPath(f.runs, f.cell, 0, 0, (r) => r.mode === "difference" && !r.core));
    });
  }, []);

  const base: React.CSSProperties = { position: "fixed", inset: 0, pointerEvents: "none", visibility: "hidden", zIndex: 45 };
  return (
    <div aria-hidden="true">
      <div ref={fringe} style={{ ...base, backdropFilter: "invert(1) grayscale(1) contrast(8) sepia(1) saturate(9) hue-rotate(var(--h, 0deg))" }} />
      <div ref={core} style={{ ...base, backdropFilter: "invert(1) grayscale(1) contrast(8)" }} />
      <div ref={diffFringe} style={{ ...base, background: "var(--brand)", mixBlendMode: "difference" }} />
      <div ref={diffCore} style={{ ...base, background: "var(--brand)", mixBlendMode: "difference" }} />
    </div>
  );
}
