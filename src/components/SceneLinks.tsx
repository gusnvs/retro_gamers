"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { prewarmSnapshot, runSceneTransition } from "@/lib/sceneNav";
import type { MVName } from "@/gl/stage";

// Every internal link (header, logo, back arrow, footers, grids, mobile menu) goes
// through the dot-grid scene transition, like every route change on the reference.
// Runs in the capture phase so it pre-empts next/link's own navigation.
export default function SceneLinks() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (url.pathname === location.pathname && url.hash) return;
      e.preventDefault();
      e.stopPropagation();
      const kb = e.detail === 0; // keyboard activation: start from the centre
      runSceneTransition({
        href: url.pathname + url.search,
        router,
        x: kb ? window.innerWidth / 2 : e.clientX,
        y: kb ? window.innerHeight / 2 : e.clientY,
        device: (a.dataset.device as MVName | undefined) || undefined,
      });
    };
    document.addEventListener("click", onClick, true);
    const idle = window.setTimeout(prewarmSnapshot, 4000);
    return () => {
      window.clearTimeout(idle);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);
  return null;
}
