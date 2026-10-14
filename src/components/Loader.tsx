"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { INVADER_ROWS } from "./icons";
import { setLoaded } from "@/lib/appState";
import s from "./Loader.module.css";

// Preloader. Reference: #101010 screen, brand-coloured logo lottie morphing into
// dots, then a dot "burst" while the page is revealed. Here the logo is the
// RetroGamers invader assembled from its own pixels.
const PIXELS: { x: number; y: number }[] = [];
INVADER_ROWS.forEach((row, j) => [...row].forEach((c, i) => c === "X" && PIXELS.push({ x: i, y: j })));

export default function Loader() {
  const root = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = root.current!;
    const px = el.querySelectorAll<SVGRectElement>("rect");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.add("is-loading");

    const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve();
    const minTime = new Promise((r) => setTimeout(r, reduce ? 0 : 1500));

    const tl = gsap.timeline({ paused: true });
    tl.fromTo(px, { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.35, ease: "back.out(2)", stagger: { each: 0.012, from: "random" } })
      .to(px, { attr: { rx: 0.5 }, scale: 0.55, duration: 0.35, ease: "power2.inOut" }, "+=0.25")
      .to(px, { x: (i) => (6 - PIXELS[i].x) * 1, y: (i) => (4 - PIXELS[i].y) * 1, duration: 0.45, ease: "power3.in" })
      .to(px, {
        x: (i) => Math.cos((i / PIXELS.length) * Math.PI * 2 * 3) * (3 + (i % 5)) * 4,
        y: (i) => Math.sin((i / PIXELS.length) * Math.PI * 2 * 3) * (3 + (i % 5)) * 4,
        scale: (i) => 0.25 + (i % 4) * 0.12,
        fill: (i) => ["#3da9f4", "#8fd0ff", "#ff5b49", "#b7ff95", "#d4b4ed"][i % 5],
        duration: 0.7,
        ease: "expo.out",
      })
      .to(el, { opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.45")
      .call(() => setLoaded(), [], "-=0.55");

    Promise.all([fontsReady, minTime]).then(() => {
      if (reduce) {
        setLoaded();
        gsap.set(el, { opacity: 0 });
        setDone(true);
      } else {
        tl.eventCallback("onComplete", () => setDone(true));
        tl.play();
      }
      document.documentElement.classList.remove("is-loading");
    });
    return () => {
      tl.kill();
    };
  }, []);

  if (done) return null;
  return (
    <div ref={root} className={s.loader} role="status" aria-label="Carregando">
      <svg className={s.logo} viewBox="-6 -6 25 21" fill="currentColor" shapeRendering="geometricPrecision">
        {PIXELS.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={1} height={1} rx={0} />
        ))}
      </svg>
    </div>
  );
}
