"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface Props {
  text: string;
  className?: string;
  as?: "p" | "h2" | "h1";
  /** first line pushed to the right (reference HeaderText behaviour) */
  firstLineRight?: boolean;
  /** force the first line to hold exactly N words (reference breaks after "digital") */
  firstLineWords?: number;
  reveal?: boolean;
}

// Splits text into measured lines (like SplitText "lines") so lines can be
// aligned/animated individually. Re-splits on resize.
export default function SplitLines({ text, className, as: Tag = "p", firstLineRight, firstLineWords, reveal = true }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    const el = ref.current!;
    const all = text.split(" ");
    const split = () => {
      // on narrow layouts the forced first line would collide with the subtitle
      const n = firstLineWords ? (el.clientWidth < 700 ? Math.max(2, firstLineWords - 2) : firstLineWords) : 0;
      const head = n ? all.slice(0, n).join(" ") : null;
      const rest = n ? all.slice(n).join(" ") : text;
      // measure in an invisible clone so React keeps ownership of `el`
      const probe = el.cloneNode(false) as HTMLElement;
      probe.removeAttribute("aria-label");
      Object.assign(probe.style, { position: "absolute", visibility: "hidden", left: "0", top: "0", width: `${el.clientWidth}px`, pointerEvents: "none" });
      probe.innerHTML = rest
        .split(" ")
        .map((w) => `<span style="display:inline-block">${w.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`)
        .join(" ");
      el.parentElement!.appendChild(probe);
      const words = Array.from(probe.children) as HTMLElement[];
      const out: string[][] = [];
      let top = -Infinity;
      words.forEach((w) => {
        if (Math.abs(w.offsetTop - top) > 2) {
          out.push([]);
          top = w.offsetTop;
        }
        out[out.length - 1].push(w.textContent ?? "");
      });
      probe.remove();
      const measured = out.map((l) => l.join(" "));
      setLines(head ? [head, ...measured] : measured);
    };
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    (fonts?.ready ?? Promise.resolve()).then(split);
    let w = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === w) return;
      w = window.innerWidth;
      split();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [text, firstLineWords]);

  useEffect(() => {
    if (!lines || !reveal) return;
    const el = ref.current!;
    const inners = el.querySelectorAll(".line-inner");
    const ctx = gsap.context(() => {
      gsap.fromTo(
        inners,
        { yPercent: 105 },
        { yPercent: 0, duration: 1.1, ease: "power3.out", stagger: 0.07, scrollTrigger: { trigger: el, start: "top 85%", once: true } },
      );
    }, el);
    return () => ctx.revert();
  }, [lines, reveal]);

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {lines?.map((l, i) => (
        <span key={i} className="line" aria-hidden="true" style={firstLineRight && i === 0 ? { textAlign: "right" } : undefined}>
          <span className="line-inner">{l}</span>
        </span>
      ))}
    </Tag>
  );
}
