"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import MVObject from "../gl/MVObject";
import type { GridEntry } from "@/data/site";
import s from "./Grid.module.css";

// darker, saturated companion colour used for text inside the hover circle
function inkFor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 510;
  if (l < 0.25) return "#3da9f4";
  // rotate hue a bit and push saturation/darkness, like the reference pairs
  const k = 0.55;
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k * 0.6)}, ${Math.round(Math.min(255, b * k + 90))})`;
}

export default function GridItem({ item, href, variant = "home" }: { item: GridEntry; href: string; variant?: "home" | "list" }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const hover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const layer = hover.current!;
    const state = { r: 0, x: 50, y: 50 };
    const apply = () => {
      layer.style.clipPath = `circle(${state.r}% at ${state.x}% ${state.y}%)`;
    };
    apply();
    const toLocal = (e: PointerEvent) => {
      const b = layer.getBoundingClientRect();
      return { x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100 };
    };
    const enter = (e: PointerEvent) => {
      const p = toLocal(e);
      // the circle eases toward the card centre, biased by the pointer
      gsap.to(state, { r: 47, x: 50 + (p.x - 50) * 0.15, y: 50 + (p.y - 50) * 0.15, duration: 0.55, ease: "power3.out", onUpdate: apply, overwrite: true });
    };
    const move = (e: PointerEvent) => {
      const p = toLocal(e);
      gsap.to(state, { x: 50 + (p.x - 50) * 0.15, y: 50 + (p.y - 50) * 0.15, duration: 0.8, ease: "power3.out", onUpdate: apply, overwrite: "auto" });
    };
    const leave = () => gsap.to(state, { r: 0, duration: 0.45, ease: "power3.inOut", onUpdate: apply, overwrite: true });
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focus", () => gsap.to(state, { r: 47, x: 50, y: 50, duration: 0.55, onUpdate: apply, overwrite: true }));
    el.addEventListener("blur", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      gsap.killTweensOf(state);
    };
  }, []);

  const ink = inkFor(item.color);
  const label = (
    <p>
      {item.label} <span className={s.anno}>({item.anno})</span>
    </p>
  );

  return (
    <Link ref={ref} href={href} className={`${s.item} ${variant === "list" ? s.list : ""}`} aria-label={`${item.title} — ${item.description}`}>
      <div className={s.intrinsic}>
        <div className={s.inner}>
          <div className={s.label}>{label}</div>
          <span className={s.badge} aria-hidden="true">
            {item.badge}
          </span>
          <MVObject className={s.device} name={item.device} useMask={item.useMask} small />
        </div>
        <div ref={hover} className={s.hover} style={{ ["--c" as string]: item.color, ["--ink" as string]: ink }} aria-hidden="true">
          <div className={s.hoverBg} />
          <div className={s.marquee}>
            <div className={s.marqueeInner}>
              <p>{item.title}</p>
              <p>{item.title}</p>
              <p>{item.title}</p>
              <p>{item.title}</p>
            </div>
          </div>
          <div className={s.hoverCard}>
            <div className={s.label}>{label}</div>
            <span className={s.badge}>{item.badge}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
