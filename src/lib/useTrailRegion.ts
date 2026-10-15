"use client";

import { useEffect, type RefObject } from "react";
import { trail, type TrailMode } from "./trail";

/** Declare how the mouse trail behaves over an element (see TrailOverlay). */
export function useTrailRegion(ref: RefObject<HTMLElement | null>, mode: TrailMode | null) {
  useEffect(() => {
    if (!ref.current || !mode) return;
    return trail.region(ref.current, mode);
  }, [ref, mode]);
}
