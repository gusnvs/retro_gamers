"use client";

import { useEffect, useRef } from "react";
import manifest from "../../../public/assets/mv/manifest.json";
import type { MVName } from "@/gl/stage";

// Product "photo" of a 3D object: one frame of its baked flipbook (diffuse x alpha)
// over a soft studio backdrop. Uses the same assets the WebGL stage uses.
export default function AngleShot({ name, frame, bg, className }: { name: MVName; frame: number; bg: [string, string]; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [bg0, bg1] = bg;
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const meta = manifest[name] as { columns: number; rows: number; v?: string };
    const v = `?v=${meta.v ?? "0"}`;
    const load = (src: string) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });
    let cancelled = false;
    Promise.all([load(`/assets/mv/${name}_diffuse-med.jpg${v}`), load(`/assets/mv/${name}_alpha.jpg${v}`)]).then(([d, a]) => {
      if (cancelled) return;
      const S = c.width;
      const col = frame % meta.columns, row = Math.floor(frame / meta.columns) % meta.rows;
      const cut = document.createElement("canvas");
      cut.width = cut.height = S;
      const cx = cut.getContext("2d", { willReadFrequently: true })!;
      const dw = d.width / meta.columns, aw = a.width / meta.columns;
      cx.drawImage(a, col * aw, row * aw, aw, aw, 0, 0, S, S);
      const mask = cx.getImageData(0, 0, S, S);
      cx.clearRect(0, 0, S, S);
      cx.drawImage(d, col * dw, row * dw, dw, dw, 0, 0, S, S);
      const img = cx.getImageData(0, 0, S, S);
      let x0 = S, y0 = S, x1 = 0, y1 = 0;
      for (let p = 0; p < img.data.length; p += 4) {
        const a = mask.data[p];
        img.data[p + 3] = a;
        if (a > 40) {
          const q = p / 4, x = q % S, y = (q / S) | 0;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      cx.putImageData(img, 0, 0);
      if (x1 <= x0) {
        x0 = y0 = 0;
        x1 = y1 = S;
      }
      const g = ctx.createRadialGradient(S / 2, S * 0.45, S * 0.05, S / 2, S / 2, S * 0.75);
      g.addColorStop(0, bg0);
      g.addColorStop(1, bg1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, c.height);
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = S * 0.05;
      ctx.shadowOffsetY = S * 0.03;
      // crop to the object's silhouette and fit it to ~78% of the frame
      const bw = x1 - x0, bh = y1 - y0;
      const k = Math.min((S * 0.78) / bw, (c.height * 0.78) / bh);
      const w = bw * k, h = bh * k;
      ctx.drawImage(cut, x0, y0, bw, bh, (S - w) / 2, (c.height - h) / 2, w, h);
    });
    return () => {
      cancelled = true;
    };
  }, [name, frame, bg0, bg1]);
  return <canvas ref={ref} className={className} width={1024} height={1024} role="img" aria-label="Foto do produto em 3D" />;
}
