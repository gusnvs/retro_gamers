"use client";

import { useEffect, useRef } from "react";
import { renderReelScene } from "@/gl/reel";

// Static frame of a reel scene (stands in for the reference's case-study screenshots).
export default function ReelShot({ scene, className }: { scene: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    (fonts?.ready ?? Promise.resolve()).then(() => renderReelScene(ctx, scene));
  }, [scene]);
  return <canvas ref={ref} className={className} width={1280} height={720} role="img" aria-label="Cena retrô do reel" />;
}
