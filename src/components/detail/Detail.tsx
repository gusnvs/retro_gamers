"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import MVObject from "../gl/MVObject";
import Reel from "../home/Reel";
import SplitLines from "../SplitLines";
import { ArrowDown, ArrowUpRight } from "../icons";
import AngleShot from "./AngleShot";
import ReelShot from "./ReelShot";
import NextFooter from "./NextFooter";
import { useLenis } from "../SmoothScroll";
import { useTrailRegion } from "@/lib/useTrailRegion";
import { INSTAGRAM, type GridEntry } from "@/data/site";
import s from "./Detail.module.css";

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

// Category page — structure of the reference project page (/projects/[slug]):
// hero (marquee + device + client/year bar), media, title + info rows + CTA,
// DetailMedia gallery, then the next item's footer.
export default function Detail({ item, next, index }: { item: GridEntry; next: GridEntry; index: number }) {
  const root = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  const { primary, secondary, tertiary } = item.colors;
  useTrailRegion(root, luminance(primary) < 0.3 ? "difference" : "invert");

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-media]").forEach((el) => {
        gsap.fromTo(el, { y: 80, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-usp]").forEach((el, i) => {
        gsap.fromTo(el, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, delay: i * 0.05, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 92%", once: true } });
      });
    }, root.current!);
    return () => ctx.revert();
  }, []);

  const frames: [number, number, number] = [3, 12, 8];
  const bgShot: [string, string] = [luminance(primary) < 0.3 ? "#2a2a2a" : "#ffffff", primary];

  return (
    <div ref={root} className={s.project} style={{ ["--primary" as string]: primary, ["--secondary" as string]: secondary, ["--tertiary" as string]: tertiary }}>
      <section className={s.header} aria-label={item.title}>
        <h1 className={s.title} aria-label={item.title}>
          <span className={s.marquee} aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i}>{item.title}&nbsp;</span>
            ))}
          </span>
        </h1>
        <MVObject className={s.img} name={item.device} quality="high" useMask={item.useMask} trigger="loaded" duration={1.2} label={`${item.title} em 3D`} />
        <div className={s.headerFooter}>
          <div className={s.usp}>
            <span className={s.uspLabel}>Categoria</span>
            <span className={s.uspValue}>{item.label}</span>
            <span className={s.uspLine} />
          </div>
          <div className={s.usp}>
            <span className={s.uspLabel}>Desde</span>
            <span className={s.uspValue}>2013</span>
            <span className={s.uspLine} />
          </div>
        </div>
        <button type="button" className={s.arrow} aria-label="Rolar para o conteúdo" onClick={() => lenis?.scrollTo(window.innerHeight, { duration: 1.4 })}>
          <ArrowDown />
        </button>
      </section>

      <Reel />

      <section className={s.inner}>
        <div className={s.innerHeader}>
          <div className={s.titlewrapper}>
            <p className={s.primaryCopy}>{item.label}</p>
            <SplitLines as="h2" className={s.headline} text={item.headline} indent={0.085} />
          </div>
          <div className={s.body}>
            <div className={s.usps}>
              <div className={s.row} data-usp>
                <div className={s.rowLabel}>Categoria</div>
                <div className={s.rowValue}>{item.label}</div>
              </div>
              <div className={s.row} data-usp>
                <div className={s.rowLabel}>Desde</div>
                <div className={s.rowValue}>2013</div>
              </div>
              <div className={s.row} data-usp>
                <div className={s.rowLabel}>Na loja</div>
                <div className={s.rowValue}>
                  {item.items.map((t) => (
                    <span key={t} className={s.roleLine}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className={s.row} data-usp>
                <div className={s.rowLabel}>Sobre</div>
                <div className={`${s.rowValue} ${s.copy}`}>
                  <p>{item.overview}</p>
                  {item.placeholder && <p className={s.note}>Itens e estoque a confirmar com a loja.</p>}
                </div>
              </div>
            </div>
            <a className={s.cta} href={INSTAGRAM} target="_blank" rel="noreferrer">
              <span>Falar no Instagram</span>
              <ArrowUpRight className={s.ctaIcon} />
              <span className={s.ctaBar} />
            </a>
          </div>
        </div>

        <div className={s.content}>
          <div className={`${s.media} ${s.landscape} ${s.center}`} data-media>
            <div className={s.outer}>
              <div className={s.mediaBg} />
              <div className={s.imgWrapper}>
                <ReelShot scene={index} className={s.mediaImg} />
              </div>
            </div>
          </div>
          <div className={`${s.media} ${s.portrait}`} data-media>
            <div className={s.outer}>
              <div className={s.mediaBg} />
              <div className={s.imgWrapper}>
                <AngleShot name={item.device} frame={frames[0]} bg={bgShot} className={s.mediaImg} />
              </div>
            </div>
          </div>
          <div className={`${s.media} ${s.portrait} ${s.right}`} data-media>
            <div className={s.outer}>
              <div className={s.mediaBg} />
              <div className={s.imgWrapper}>
                <AngleShot name={item.device} frame={frames[1]} bg={bgShot} className={s.mediaImg} />
              </div>
            </div>
          </div>
          <div className={`${s.media} ${s.landscape}`} data-media>
            <div className={s.outer}>
              <div className={s.mediaBg} />
              <div className={s.imgWrapper}>
                <ReelShot scene={index + 3} className={s.mediaImg} />
              </div>
            </div>
          </div>
          <div className={`${s.media} ${s.portrait} ${s.center}`} data-media>
            <div className={s.outer}>
              <div className={s.mediaBg} />
              <div className={s.imgWrapper}>
                <AngleShot name={item.device} frame={frames[2]} bg={bgShot} className={s.mediaImg} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <NextFooter item={next} />
    </div>
  );
}
