"use client";

// Animated dot glyph (reference "Dna" lottie: dots morphing between ':' and a
// pixel wave). Pure SVG + CSS animation.
import s from "./Dna.module.css";

const COLS = 7;
export default function Dna({ className }: { className?: string }) {
  return (
    <svg className={`${s.dna} ${className ?? ""}`} viewBox="0 0 84 36" aria-hidden="true">
      {Array.from({ length: COLS }).map((_, i) => (
        <g key={i} style={{ ["--i" as string]: i }}>
          <circle className={s.a} cx={12 + i * 10} cy={10} r={4} />
          <circle className={s.b} cx={12 + i * 10} cy={26} r={4} />
        </g>
      ))}
    </svg>
  );
}
