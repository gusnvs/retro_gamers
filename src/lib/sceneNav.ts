"use client";

import gsap from "gsap";
import type { GridEntry } from "@/data/site";

// Grid -> detail page transition, timed like the reference RootScene.navigate():
// uTransition 0->1 over TR_DURATION (2600ms, easeInOutCubic), uBlur 1->1.3 and
// uSize2 .35->-.2 (easeOutCubic). The old page (DOM) zooms/rotates from the click
// point like the shader's uvFrom; the new page is drawn into the dot mask and the
// real route is swapped in once the mask covers the screen.

const TR_DURATION = 2.6;
let active = false;
export const isSceneTransitioning = () => active;

type Router = { push: (href: string, opts?: { scroll?: boolean }) => void; prefetch: (href: string) => void };

function drawDestination(item: Pick<GridEntry, "colors" | "title"> & { device?: GridEntry["device"] }, W: number, H: number) {
  const scale = Math.min(1, 1600 / W);
  const c = document.createElement("canvas");
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = item.colors.primary;
  ctx.fillRect(0, 0, W, H);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
  const size = W >= 1200 ? 29 * rem : W >= 1025 ? 15 * rem : 10 * rem;
  const y = W >= 1025 ? 245 : 125;
  const family = getComputedStyle(document.body).fontFamily;
  ctx.font = `600 ${size}px ${family}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${-0.05 * size}px`;
  ctx.fillStyle = item.colors.secondary;
  ctx.textBaseline = "middle";
  const text = `${item.title.toUpperCase()} `;
  const w = ctx.measureText(text).width || W;
  for (let x = 0; x < W; x += w) ctx.fillText(text, x, y + size * 0.06);
  return c;
}

export async function runSceneTransition(opts: { href: string; router: Router; item: Pick<GridEntry, "colors" | "title"> & { device?: GridEntry["device"] }; x: number; y: number }) {
  const { href, router, item } = opts;
  if (active) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    router.push(href);
    return;
  }
  active = true;
  router.prefetch(href);
  const { getStage } = await import("@/gl/stage");
  const stage = await getStage();
  const W = window.innerWidth, H = window.innerHeight;
  const mx = opts.x / W, my = opts.y / H;
  const quad = stage.sceneQuad(drawDestination(item, W, H), 0, { x: mx, y: my });
  const main = document.querySelector("main") as HTMLElement;

  // shader scaleOrigin = mix(mouse, .5, .2), drifting with the transition
  const ox = (mx * 0.8 + 0.1) * W;
  const baseOy = (my * 0.8 + 0.1) * H;

  const target = new URL(href, location.href).pathname;
  const arrived = new Promise<void>((resolve) => {
    const check = () => (location.pathname === target ? resolve() : requestAnimationFrame(check));
    requestAnimationFrame(check);
  });

  const t0 = performance.now();
  if (item.device) stage.preload(item.device, "high");
  const tl = gsap.timeline();
  tl.to(
    quad.uniforms.uTransition,
    {
      value: 1,
      duration: TR_DURATION,
      ease: "power3.inOut",
      onUpdate: () => {
        const e = quad.uniforms.uTransition.value as number;
        if (!main.dataset.sceneSwapped) {
          const oy = baseOy - (0.2 - e * 0.5) * H + window.scrollY;
          main.style.transformOrigin = `${ox}px ${oy}px`;
          main.style.transform = `scale(${1 + e * 1.2}) rotate(${-e * mx * 0.3}rad)`;
          main.style.filter = `blur(${e * 2}px)`;
        }
      },
    },
    0,
  );
  tl.to(quad.uniforms.uBlur, { value: 1.3, duration: TR_DURATION, ease: "power3.out" }, 0);
  tl.to(quad.uniforms.uSize2, { value: -0.2, duration: TR_DURATION, ease: "power3.out" }, 0);
  // swap the route once the dots + circle cover the viewport
  tl.call(
    () => {
      main.dataset.sceneSwapped = "1";
      main.style.transform = "";
      main.style.filter = "";
      main.style.transformOrigin = "";
      router.push(href, { scroll: false });
    },
    [],
    TR_DURATION * 0.58, // dots + circle already cover the viewport here
  );

  await arrived;
  await new Promise((r) => setTimeout(r, Math.max(0, TR_DURATION * 0.62 * 1000 - (performance.now() - t0))));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  tl.kill();
  main.style.transform = "";
  main.style.filter = "";
  main.style.transformOrigin = "";
  delete main.dataset.sceneSwapped;
  gsap.to(quad.uniforms.uFade, {
    value: 0,
    duration: 0.3,
    ease: "power2.out",
    onComplete: () => {
      quad.dispose();
      active = false;
    },
  });
}

/** first-load reveal: black "from" scene opened by the same dot grid, centred */
export async function runFirstReveal(onCovered?: () => void, duration = 1.7) {
  const { getStage } = await import("@/gl/stage");
  const stage = await getStage();
  const quad = stage.sceneQuad(null, 1, { x: 0.5, y: 0.5 });
  // wait until the black quad is on screen before removing the DOM loader
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  onCovered?.();
  gsap.to(quad.uniforms.uFirst, { value: 0, duration, ease: "power4.in" });
  gsap.to(quad.uniforms.uBlur, { value: 1.3, duration, ease: "power3.out" });
  gsap.to(quad.uniforms.uSize2, { value: -0.2, duration, ease: "power3.out" });
  await gsap.to(quad.uniforms.uTransition, { value: 1, duration, ease: "power3.inOut" }).then();
  quad.dispose();
}
