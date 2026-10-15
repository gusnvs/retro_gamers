"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { isSceneTransitioning } from "@/lib/sceneNav";

// Route change: quick cut to #101010 and fade out (reference cuts to black for
// ~150ms while the next page's scene is prepared).
export default function PageTransition() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (isSceneTransitioning()) return; // the dot-grid transition already covers the swap
    gsap.fromTo(ref.current, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.45, delay: 0.15, ease: "power2.out" });
  }, [pathname]);

  return <div ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, background: "var(--black)", zIndex: 999990, pointerEvents: "none", visibility: "hidden", opacity: 0 }} />;
}
