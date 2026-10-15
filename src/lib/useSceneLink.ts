"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { GridEntry } from "@/data/site";
import { runSceneTransition } from "./sceneNav";

/** onClick for links into a detail page: plays the dot-grid scene transition */
export function useSceneLink(href: string, item: Pick<GridEntry, "colors" | "title"> & { device?: GridEntry["device"] }) {
  const router = useRouter();
  return useCallback(
    (e: React.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // keyboard activation has no pointer position: start from the centre
      const kb = e.detail === 0;
      runSceneTransition({ href, router, item, x: kb ? window.innerWidth / 2 : e.clientX, y: kb ? window.innerHeight / 2 : e.clientY });
    },
    [href, router, item],
  );
}
