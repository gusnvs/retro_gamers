"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useTrailRegion } from "@/lib/useTrailRegion";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import MVObject from "../gl/MVObject";
import PageFooter from "../PageFooter";
import s from "./Sobre.module.css";

gsap.registerPlugin(ScrollTrigger);

// Profile page of the reference, as the store's "about" page.
// Lists only contain facts published by @retrogamersbr (bio + story highlights).
const EVENTS = [
  ["BGS", "2022"],
  ["BGS", "2023"],
  ["BGS", "2026"],
];
const RANGE = [
  ["Atari", "Clássico"],
  ["Raros", "Curadoria"],
  ["PS5", "Atual"],
];

export default function Sobre() {
  const root = useRef<HTMLDivElement>(null);
  useTrailRegion(root, "difference");

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from("[data-word]", { yPercent: 105, duration: 1.2, ease: "power3.out", stagger: 0.06, delay: 0.1 });
      gsap.utils.toArray<HTMLElement>("[data-section]").forEach((el) => {
        gsap.from(el.querySelectorAll("[data-item]"), {
          y: 40,
          autoAlpha: 0,
          duration: 0.9,
          stagger: 0.06,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 80%", once: true },
        });
        gsap.fromTo(el.querySelector("[data-line]"), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "power3.inOut", scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      });
    }, root.current!);
    return () => ctx.revert();
  }, []);

  const words = ["Do", "Atari", "ao", "PS5,", "jogos", "raros", "desde", "2013."];

  return (
    <div ref={root} className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>
          {words.map((w, i) => (
            <span key={i} className={s.word}>
              <span data-word className={i === 0 ? s.white : undefined}>
                {w}
              </span>{" "}
            </span>
          ))}
        </h1>
        <MVObject className={s.mv} name="crt" quality="high" useMask trigger="loaded" label="TV de tubo em 3D exibindo o reel" />
        <div className={s.copy}>
          <p>Curadoria em jogos raros,</p>
          <div>
            <span>do Atari&nbsp;</span>
            <span>ao PS5.</span>
          </div>
        </div>
        <p className={s.body}>
          A Retro Gamers é loja e experiência gamer desde 2013. Fazemos curadoria em jogos raros — do Atari ao
          PS5 —, aceitamos seus jogos e consertamos seu videogame.
        </p>
      </div>

      <div className={s.sections}>
        <section className={`${s.section} ${s.full}`} data-section>
          <span className={s.line} data-line />
          <h2 className={s.sectionTitle} data-item>
            O que fazemos
          </h2>
          <p className={s.sectionBody} data-item>
            Loja e experiência gamer. <b>Curadoria em jogos raros</b>, do Atari ao PS5. <b>Aceitamos seus jogos</b> e{" "}
            <b>consertamos seu videogame</b>.
          </p>
        </section>
        <section className={s.section} data-section>
          <span className={s.line} data-line />
          <div className={s.listHeader} data-item>
            <h2 className={s.sectionTitle}>Eventos</h2>
            <p className={s.listHeaderBody}>Brasil Game Show — presença registrada nos destaques do nosso Instagram.</p>
          </div>
          <ul className={s.list}>
            {EVENTS.map(([a, b]) => (
              <li key={a + b} data-item>
                <span>{a}</span>
                <span className={s.amount}>{b}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={s.section} data-section>
          <span className={s.line} data-line />
          <div className={s.listHeader} data-item>
            <h2 className={s.sectionTitle}>Gerações</h2>
            <p className={s.listHeaderBody}>Do primeiro joystick ao console atual.</p>
          </div>
          <ul className={s.list}>
            {RANGE.map(([a, b]) => (
              <li key={a + b} data-item>
                <span>{a}</span>
                <span className={s.amount}>{b}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <PageFooter theme="brand" />
    </div>
  );
}
