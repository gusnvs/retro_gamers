"use client";

import { useEffect, useRef } from "react";
import { useLenis } from "./SmoothScroll";

// Thin custom scroll indicator on the right edge (the reference hides the native
// scrollbar and draws its own bar). Uses the header's difference blend so it
// reads on both brand and dark backgrounds.
export default function ScrollIndicator() {
  const bar = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const update = () => {
      const el = bar.current;
      if (!el) return;
      const vh = window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const h = Math.max(40, (vh / total) * vh);
      const y = (window.scrollY / Math.max(1, total - vh)) * (vh - h);
      el.style.height = `${h}px`;
      el.style.transform = `translateY(${y}px)`;
      el.style.opacity = total > vh + 4 ? "1" : "0";
    };
    update();
    lenis?.on("scroll", update);
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    return () => {
      lenis?.off("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [lenis]);

  return (
    <div aria-hidden="true" style={{ position: "fixed", top: 0, right: 3, width: 4, height: "100vh", zIndex: 999999, pointerEvents: "none", mixBlendMode: "difference" }}>
      <div ref={bar} style={{ width: 4, borderRadius: 4, background: "var(--brand)", willChange: "transform" }} />
    </div>
  );
}
