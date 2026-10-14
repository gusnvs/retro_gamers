"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { getReel } from "@/gl/reel";
import s from "./Reel.module.css";

// Showreel section: shots framed over a blurred copy of the reel, alternating
// with full-bleed shots, plus a slight mouse parallax on the frame.
export default function Reel() {
  const root = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reel = getReel();
    const holder = box.current!;
    reel.canvas.className = s.canvas;
    reel.canvas.setAttribute("aria-hidden", "true");
    holder.appendChild(reel.canvas);

    const bgc = bg.current!;
    const bctx = bgc.getContext("2d")!;
    let raf = 0;
    let visible = false;
    const io = new IntersectionObserver((e) => (visible = e[0].isIntersecting));
    io.observe(root.current!);
    // the reference reel cuts between shots framed inside a blurred copy and
    // full-bleed shots; mirror that per scene
    let lastScene = -1;
    const INSET = "inset(10.9% 7.5% 10.9% 7.5%)";
    const FULL = "inset(0% 0% 0% 0%)";
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      reel.update(performance.now());
      bctx.drawImage(reel.canvas, 0, 0, bgc.width, bgc.height);
      if (reel.scene !== lastScene) {
        lastScene = reel.scene;
        gsap.to(holder, { clipPath: reel.scene % 3 === 2 ? FULL : INSET, duration: 0.5, ease: "power3.inOut" });
      }
    };
    raf = requestAnimationFrame(loop);


    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      gsap.to(holder, { x: x * -18, y: y * -10, duration: 1.2, ease: "power3.out" });
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      gsap.killTweensOf(holder);
      window.removeEventListener("pointermove", onMove);
      if (reel.canvas.parentElement === holder) holder.removeChild(reel.canvas);
    };
  }, []);

  return (
    <section ref={root} className={s.reel} aria-label="Reel Retro Gamers">
      <canvas ref={bg} className={s.bg} width={160} height={90} aria-hidden="true" />
      <div className={s.shade} />
      <div ref={box} className={s.box} />
    </section>
  );
}
