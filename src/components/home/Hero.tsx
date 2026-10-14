"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { onLoaded } from "@/lib/appState";
import { useLenis } from "../SmoothScroll";
import { ArrowDown } from "../icons";
import HeroSlideshow from "./HeroSlideshow";
import Dna from "./Dna";
import s from "./Hero.module.css";

const TAGLINE = "Loja e experiência gamer desde 2013 — do Atari ao PS5";

export default function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const el = root.current!;
    const q = gsap.utils.selector(el);
    gsap.set(q("[data-clip]"), { attr: { width: 0 } });
    gsap.set(q("[data-fade]"), { autoAlpha: 0 });
    return onLoaded(() => {
      const tl = gsap.timeline({ delay: 0.15 });
      tl.to(q("[data-clip='retro']"), { attr: { width: 820 }, duration: 0.9, ease: "power3.inOut" })
        .to(q("[data-clip='gamers']"), { attr: { width: 1440 }, duration: 1.4, ease: "power2.inOut" }, "-=0.35")
        .to(q("[data-fade]"), { autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: "power2.out" }, "-=1.1");
    });
  }, []);

  return (
    <section ref={root} className={s.header} aria-label="Retro Gamers">
      <div className={s.inner}>
        <h1 className={s.logoShape}>
          <span className="sr-only">Retro Gamers</span>
          <svg className={s.wordmark} viewBox="0 0 1440 360" aria-hidden="true">
            <defs>
              <clipPath id="clip-retro">
                <rect data-clip="retro" x="0" y="0" width="820" height="360" />
              </clipPath>
              <clipPath id="clip-gamers">
                <rect data-clip="gamers" x="640" y="0" width="1440" height="360" />
              </clipPath>
            </defs>
            <g clipPath="url(#clip-retro)">
              <text className={s.retro} x="104" y="266" textLength="664" lengthAdjust="spacingAndGlyphs">
                Retro
              </text>
            </g>
            <g clipPath="url(#clip-gamers)">
              <text className={s.gamers} x="748" y="286" textLength="588" lengthAdjust="spacingAndGlyphs">
                Gamers
              </text>
            </g>
            {/* desktop tagline lives in the wordmark so it scales with it (reference) */}
            <text className={s.svgTagline} x="111" y="303" textLength="418" lengthAdjust="spacingAndGlyphs" data-fade>
              {TAGLINE.toUpperCase()}
            </text>
          </svg>
        </h1>
        <div className={s.taglineWrapper} data-fade>
          <p className={s.tagline}>{TAGLINE}</p>
        </div>
        <HeroSlideshow />
        <div className={s.footer}>
          <div data-fade>
            <Dna className={s.dna} />
          </div>
          <div data-fade>
            <button type="button" className={s.arrow} aria-label="Rolar para o conteúdo" onClick={() => lenis?.scrollTo(window.innerHeight, { duration: 1.4 })}>
              <ArrowDown />
            </button>
          </div>
          <div data-fade>
            <div className={s.copy}>
              <p>Loja e experiência</p>
              <p>gamer desde 2013.</p>
              <p>Do Atari</p>
              <p>ao PS5.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
