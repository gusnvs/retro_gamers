"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { getReel } from "@/gl/reel";
import { clipRuns, trail } from "@/lib/trail";
import s from "./Reel.module.css";

// Showreel section: shots framed over a blurred copy of the reel, alternating
// with full-bleed shots, plus a slight mouse parallax on the frame.
export default function Reel() {
  const root = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLCanvasElement>(null);
  const fx = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reel = getReel();
    const holder = box.current!;
    reel.canvas.className = s.canvas;
    reel.canvas.setAttribute("aria-hidden", "true");
    reel.canvas.setAttribute("data-scene-live", "reel"); // kept playing by scene transitions
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

    // mouse trail over the reel = old-TV interference (reference: noisy, torn video
    // inside the fluid mask), drawn as pixel cells
    const section = root.current!;
    const fxc = fx.current!;
    const fctx = fxc.getContext("2d")!;
    const noise = document.createElement("canvas");
    noise.width = noise.height = 96;
    const nctx = noise.getContext("2d")!;
    const img = nctx.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    const pattern = fctx.createPattern(noise, "repeat")!;
    const offRegion = trail.region(section, "custom");
    let dirty = false;
    let seed = 0;
    const offTrail = trail.subscribe((f) => {
      const sr = section.getBoundingClientRect();
      if (sr.bottom < 0 || sr.top > window.innerHeight) return;
      if (fxc.width !== Math.round(sr.width) || fxc.height !== Math.round(sr.height)) {
        fxc.width = Math.round(sr.width);
        fxc.height = Math.round(sr.height);
      }
      fctx.clearRect(0, 0, fxc.width, fxc.height);
      const runs = clipRuns(f.runs, f.cell, sr);
      if (!runs.length) {
        if (dirty) dirty = false;
        return;
      }
      dirty = true;
      const step = Math.floor(f.time * 12);
      if (step !== seed) seed = step;
      const br = holder.getBoundingClientRect();
      const kx = reel.canvas.width / br.width, ky = reel.canvas.height / br.height;
      for (const r of runs) {
        const x = r.x0 - sr.left, y = r.y - sr.top, w = r.x1 - r.x0, h = f.cell;
        // torn video strip
        const tear = (((r.y * 7 + seed * 13) % 9) - 4) * f.cell * 0.9;
        fctx.globalAlpha = r.core ? 0.55 : 0.8;
        fctx.drawImage(reel.canvas, (r.x0 - br.left + tear) * kx, (r.y - br.top) * ky, w * kx, h * ky, x, y, w, h);
        // static grain
        fctx.globalAlpha = r.core ? 0.75 : 0.4;
        fctx.save();
        fctx.translate(((seed * 37) % 96), ((seed * 53) % 96));
        fctx.fillStyle = pattern;
        fctx.fillRect(x - ((seed * 37) % 96), y - ((seed * 53) % 96), w, h);
        fctx.restore();
        fctx.globalAlpha = r.core ? 0.35 : 0.15;
        fctx.fillStyle = "#101010";
        fctx.fillRect(x, y, w, h);
      }
      fctx.globalAlpha = 1;
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      gsap.killTweensOf(holder);
      offTrail();
      offRegion();
      window.removeEventListener("pointermove", onMove);
      if (reel.canvas.parentElement === holder) holder.removeChild(reel.canvas);
    };
  }, []);

  return (
    <section ref={root} className={s.reel} aria-label="Reel Retro Gamers">
      <canvas ref={bg} className={s.bg} width={160} height={90} aria-hidden="true" />
      <div className={s.shade} />
      <div ref={box} className={s.box} />
      <canvas ref={fx} className={s.fx} aria-hidden="true" data-scene-skip />
    </section>
  );
}
