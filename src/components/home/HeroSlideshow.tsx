"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { MVItem } from "@/gl/stage";
import { HERO_DEVICES } from "@/data/site";
import { onLoaded } from "@/lib/appState";
import s from "./Hero.module.css";

const INTERVAL = 10000; // reference: setInterval(next, 1e4)

// Hero device slideshow: PlayStation, Switch, Xbox and the RetroGamers logo,
// cycling with the motion-vector transition (exit/enter overlap like the
// reference's AnimatePresence "popLayout").
export default function HeroSlideshow() {
  const ref = useRef<HTMLDivElement>(null);
  const api = useRef<{ next: () => void } | null>(null);

  useEffect(() => {
    const el = ref.current!;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let current = 0;
    let started = false;
    const items: MVItem[] = [];
    let removeStage = () => {};
    let offLoaded = () => {};
    let visible = true;

    const enter = (i: number, first = false) => {
      const it = items[i];
      gsap.killTweensOf(it.uniforms.uTransition);
      gsap.fromTo(it.uniforms.uTransition, { value: 0 }, { value: 1, duration: first ? 2.4 : 2, ease: "power3.inOut", delay: first ? 0.2 : 0.35 });
    };
    const exit = (i: number) => {
      const it = items[i];
      gsap.killTweensOf(it.uniforms.uTransition);
      gsap.to(it.uniforms.uTransition, { value: 0, duration: 1.4, ease: "power3.inOut" });
    };
    const next = () => {
      if (!started) return;
      exit(current);
      current = (current + 1) % items.length;
      enter(current);
    };
    const restart = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => visible && !document.hidden && next(), INTERVAL);
    };
    api.current = {
      next: () => {
        next();
        restart();
      },
    };

    const io = new IntersectionObserver((e) => (visible = e[0].isIntersecting));
    io.observe(el);

    import("@/gl/stage").then(async ({ getStage }) => {
      const stage = await getStage();
      if (cancelled) return;
      HERO_DEVICES.forEach((d, i) => items.push(stage.add(el, d.name, { quality: "high", useMask: d.useMask, renderOrder: i })));
      removeStage = () => items.forEach((it) => stage.remove(it));
      await items[0].ready;
      if (cancelled) return;
      offLoaded = onLoaded(() => {
        started = true;
        enter(0, true);
        restart();
      });
    });

    return () => {
      cancelled = true;
      offLoaded();
      io.disconnect();
      if (timer) clearInterval(timer);
      items.forEach((it) => gsap.killTweensOf(it.uniforms.uTransition));
      removeStage();
    };
  }, []);

  return (
    <div className={s.slideshow}>
      <div
        ref={ref}
        className={s.slide}
        role="img"
        aria-label="Controle PlayStation, Nintendo Switch, controle Xbox e o logo Retro Gamers em 3D"
        onClick={() => api.current?.next()}
      />
    </div>
  );
}
