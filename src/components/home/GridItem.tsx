"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import MVObject from "../gl/MVObject";
import type { GridEntry } from "@/data/site";
import { clipRuns, runsToPath, trail } from "@/lib/trail";
import s from "./Grid.module.css";

export default function GridItem({ item, href, variant = "home" }: { item: GridEntry; href: string; variant?: "home" | "list" }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const hover = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const layer = hover.current!;
    const card = cardRef.current!;
    // hover circle (percent of the layer) + pixel trail cells, one clip path
    const state = { r: 0, x: 50, y: 50 };
    let trailPath = "";
    const apply = () => {
      const w = layer.offsetWidth, h = layer.offsetHeight;
      let d = trailPath;
      if (state.r > 0.05) {
        const r = (state.r / 100) * Math.hypot(w, h) / Math.SQRT2;
        const cx = (state.x / 100) * w, cy = (state.y / 100) * h;
        d += `M${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}Z`;
      }
      layer.style.clipPath = d ? `path(nonzero, "${d}")` : "inset(50%)";
    };
    apply();
    const offTrail = trail.subscribe((f) => {
      const cr = card.getBoundingClientRect();
      if (cr.bottom < 0 || cr.top > window.innerHeight) {
        if (trailPath) {
          trailPath = "";
          apply();
        }
        return;
      }
      const lr = layer.getBoundingClientRect();
      const next = runsToPath(clipRuns(f.runs, f.cell, cr), f.cell, lr.left, lr.top);
      if (next !== trailPath) {
        trailPath = next;
        apply();
      }
    });
    const offRegion = trail.region(card, "custom");
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
    const focus = () => gsap.to(state, { r: 47, x: 50, y: 50, duration: 0.55, onUpdate: apply, overwrite: true });
    // the hover circle collapses when the page transition starts (reference)
    const click = () => gsap.to(state, { r: 0, duration: 0.35, ease: "power3.inOut", onUpdate: apply, overwrite: true });
    el.addEventListener("pointerup", click);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focus", focus);
    el.addEventListener("blur", leave);
    return () => {
      offTrail();
      offRegion();
      el.removeEventListener("pointerup", click);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focus", focus);
      el.removeEventListener("blur", leave);
      gsap.killTweensOf(state);
    };
  }, []);

  const ink = item.colors.secondary;
  const label = (
    <p>
      {item.label} <span className={s.anno}>({item.anno})</span>
    </p>
  );

  return (
    <Link ref={ref} href={href} data-device={item.device} className={`${s.item} ${variant === "list" ? s.list : ""}`} aria-label={`${item.title} — ${item.description}`}>
      <div ref={cardRef} className={s.intrinsic}>
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
