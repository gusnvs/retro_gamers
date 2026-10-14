"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { MVItem, MVName } from "@/gl/stage";
import { onLoaded } from "@/lib/appState";

interface Props {
  name: MVName;
  className?: string;
  quality?: "high" | "med";
  useMask?: boolean;
  small?: boolean;
  /** "inview": transition in when scrolled into view; "loaded": after the preloader */
  trigger?: "inview" | "loaded";
  duration?: number;
  label?: string;
}

// DOM placeholder bound to a motion-vector object drawn by the fixed GL stage.
export default function MVObject({ name, className, quality = "med", useMask = false, small = false, trigger = "inview", duration = 2, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    let item: MVItem | null = null;
    let stage: Awaited<ReturnType<typeof import("@/gl/stage").getStage>> | null = null;
    let io: IntersectionObserver | null = null;
    let tween: gsap.core.Tween | null = null;
    let cancelled = false;
    let offLoaded = () => {};

    const show = () => {
      if (!item) return;
      tween?.kill();
      tween = gsap.to(item.uniforms.uTransition, { value: 1, duration, ease: "power3.inOut" });
    };

    import("@/gl/stage").then(async ({ getStage }) => {
      stage = await getStage();
      if (cancelled) return;
      item = stage.add(el, name, { quality, useMask, small });
      await item.ready;
      if (cancelled) return;
      offLoaded = onLoaded(() => {
        if (trigger === "loaded") show();
        else {
          io = new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting)) {
                show();
                io?.disconnect();
              }
            },
            { rootMargin: "0px 0px 25% 0px" },
          );
          io.observe(el);
        }
      });
    });

    return () => {
      cancelled = true;
      offLoaded();
      io?.disconnect();
      tween?.kill();
      if (stage && item) stage.remove(item);
    };
  }, [name, quality, useMask, small, trigger, duration]);

  return <div ref={ref} className={className} role={label ? "img" : undefined} aria-label={label} />;
}
