"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { INVADER_ROWS } from "./icons";
import { setLoaded } from "@/lib/appState";
import { runFirstReveal } from "@/lib/sceneNav";
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
    const minTime = new Promise((r) => setTimeout(r, reduce ? 0 : 600));

    const tl = gsap.timeline({ paused: true });
    tl.fromTo(px, { scale: 0, opacity: 1, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.3, ease: "back.out(2)", stagger: { each: 0.008, from: "random" } })
      .to(px, { attr: { rx: 0.5 }, scale: 0.55, duration: 0.3, ease: "power2.inOut" }, "+=0.15")
      .to(px, { x: (i) => (6 - PIXELS[i].x) * 1, y: (i) => (4 - PIXELS[i].y) * 1, duration: 0.4, ease: "power3.in" })
      .to(px, { scale: 0, duration: 0.2, ease: "power2.in" })
      // hand over to the GL dot-grid reveal (reference SceneTransition, uFirst=1):
      // its first frame is the same #101010, so the swap is seamless
      .call(() => {
        const finish = () => {
          setLoaded();
          gsap.set(el, { opacity: 0 });
          setDone(true);
        };
        runFirstReveal(finish).catch(finish);
      });

    Promise.all([fontsReady, minTime]).then(() => {
      if (reduce) {
        setLoaded();
        gsap.set(el, { opacity: 0 });
        setDone(true);
      } else {
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
          <rect key={i} x={p.x} y={p.y} width={1} height={1} rx={0} style={{ opacity: 0 }} />
        ))}
      </svg>
    </div>
  );
}
