"use client";

import gsap from "gsap";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import type { FromMarquee, FromReel, MVName } from "@/gl/stage";

// Route transition, timed like the reference RootScene.navigate():
// uTransition 0->1 over TR_DURATION (2600ms, easeInOutCubic), uBlur 1->1.3 and
// uSize2 .35->-.2 (easeOutCubic), dots centred on the click.
// Like the reference, the "to" scene is the real new page: the old page becomes a
// texture, the route is swapped right away underneath, and the new page shows
// through the dot mask. At the end the quad is fully transparent, so removing it
// is invisible. The old page stays alive inside that texture (re-rendered every
// frame): its 3D objects keep following the mouse, the reel keeps playing and
// marquees keep scrolling over a DOM snapshot of the static parts.

const TR_DURATION = 2.6;
let active = false;
export const isSceneTransitioning = () => active;

type Router = { push: (href: string, opts?: { scroll?: boolean }) => void; prefetch: (href: string) => void };

let fontCSS: Promise<string> | null = null;

/** fetch/embed the web fonts once, ahead of the first transition */
export function prewarmSnapshot() {
  const main = document.querySelector("main");
  if (main && !fontCSS) fontCSS = getFontEmbedCSS(main).catch(() => "");
}

async function snapshotPage(W: number, H: number) {
  const main = document.querySelector("main") as HTMLElement;
  fontCSS ??= getFontEmbedCSS(main).catch(() => "");
  const fontEmbedCSS = await fontCSS;
  // only clone what is on screen (inlining styles is the expensive part) without
  // shifting the layout: drop anything below the fold, and keep containers that
  // sit above the viewport (their inlined height preserves the flow) but drop
  // their children. Live layers (reel video, its trail fx) are drawn by the stage.
  const visible = (node: HTMLElement) => {
    if (!(node instanceof Element)) return true;
    if (node.hasAttribute("data-scene-live") || node.hasAttribute("data-scene-skip")) return false;
    // marquee tracks keep their box but lose their content (drawn live)
    if (node.parentElement?.hasAttribute("data-scene-marquee")) return false;
    const r = node.getBoundingClientRect();
    if (r.top > H + 50 && r.height > 0) return false;
    const parent = node.parentElement;
    if (parent && parent !== main) {
      const pr = parent.getBoundingClientRect();
      if (pr.bottom < -50 && pr.height > 0) return false;
    }
    return true;
  };
  const onScreen = (r: DOMRect) => r.width > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;

  const reels: FromReel[] = [];
  main.querySelectorAll<HTMLElement>('[data-scene-live="reel"]').forEach((c) => {
    const rect = c.getBoundingClientRect();
    if (!onScreen(rect)) return;
    const holder = c.parentElement!;
    const hr = holder.getBoundingClientRect();
    const ins = insetOf(getComputedStyle(holder).clipPath, hr);
    reels.push({
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      clip: { left: hr.left + ins[3], top: hr.top + ins[0], right: hr.right - ins[1], bottom: hr.bottom - ins[2] },
    });
  });

  // data-scene-marquee="x|y": the track translates by -50% of its size along that
  // screen axis in a linear infinite loop
  const marqueeJobs = [...main.querySelectorAll<HTMLElement>("[data-scene-marquee]")].map(async (el): Promise<FromMarquee | null> => {
    const holder = el.parentElement!;
    const strip = holder.getBoundingClientRect();
    if (!onScreen(strip)) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const m = cs.transform && cs.transform !== "none" ? new DOMMatrix(cs.transform) : new DOMMatrix();
    const offset = { x: m.m41, y: m.m42 };
    m.m41 = m.m42 = 0;
    const w = el.offsetWidth, h = el.offsetHeight;
    const axis = el.dataset.sceneMarquee === "y" ? "y" : "x";
    const loop = (axis === "x" ? w : h) / 2;
    const dur = Number(el.getAnimations()[0]?.effect?.getComputedTiming().duration) || 0;
    const speed = dur > 0 ? -loop / (dur / 1000) : 0;
    const canvas = await toCanvas(el, {
      width: w,
      height: h,
      canvasWidth: w,
      canvasHeight: h,
      pixelRatio: 1,
      skipAutoScale: true,
      fontEmbedCSS,
      style: { transform: m.toString(), animation: "none", margin: "0" },
    });
    const top = Math.min(strip.top, r.top), bottom = Math.max(strip.bottom, r.bottom);
    const left = Math.max(0, strip.left), right = Math.min(W, strip.right);
    return {
      canvas,
      clip: { left, top, width: right - left, height: bottom - top, radius: parseFloat(getComputedStyle(holder).borderTopLeftRadius) || 0 },
      box: { left: r.left - offset.x, top: r.top - offset.y, width: w, height: h },
      offset,
      velocity: axis === "x" ? { x: speed, y: 0 } : { x: 0, y: speed },
      loop,
    };
  });

  const [page, ...marquees] = await Promise.all([
    toCanvas(main, {
      filter: visible,
      width: W,
      height: H,
      canvasWidth: W,
      canvasHeight: H,
      pixelRatio: 1,
      skipAutoScale: true,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      fontEmbedCSS,
      style: { transform: `translateY(${-window.scrollY}px)`, transformOrigin: "0 0", margin: "0" },
    }),
    ...marqueeJobs,
  ]);
  return { page: page as HTMLCanvasElement, reels, marquees: marquees.filter((m): m is FromMarquee => !!m) };
}

/** clip-path inset() of an element in px: [top, right, bottom, left] */
function insetOf(clip: string, r: DOMRect): [number, number, number, number] {
  const m = /inset\(([^)]*)\)/.exec(clip);
  if (!m) return [0, 0, 0, 0];
  const v = m[1].split(/\s+/).filter(Boolean).slice(0, 4);
  const px = (s: string, size: number) => (s.endsWith("%") ? (parseFloat(s) / 100) * size : parseFloat(s) || 0);
  const [t = "0", rr = t, b = t, l = rr] = v;
  return [px(t, r.height), px(rr, r.width), px(b, r.height), px(l, r.width)];
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

export async function runSceneTransition(opts: { href: string; router: Router; x: number; y: number; device?: MVName }) {
  const { href, router } = opts;
  if (active) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    router.push(href);
    return;
  }
  active = true;
  window.dispatchEvent(new CustomEvent("rg:navigate-start"));
  router.prefetch(href);
  const { getStage } = await import("@/gl/stage");
  const stage = await getStage();
  if (opts.device) stage.preload(opts.device, "high");
  const W = window.innerWidth, H = window.innerHeight;

  // let the hover circle collapse before capturing the old scene
  if (opts.device) await new Promise((r) => setTimeout(r, 380));
  let snap: Awaited<ReturnType<typeof snapshotPage>>;
  try {
    snap = await snapshotPage(W, H);
  } catch {
    active = false;
    router.push(href);
    return;
  }

  // the quad's first frame is identical to the page, so the swap below is hidden
  const live = stage.liveFrom(snap.page, { reels: snap.reels, marquees: snap.marquees });
  const quad = stage.sceneQuad(live.texture, 0, { x: opts.x / W, y: opts.y / H });
  await frame();
  await frame();
  // the quad now hides the page: reset the scroll before the new route paints
  window.dispatchEvent(new CustomEvent("rg:scroll-top"));
  window.scrollTo(0, 0);
  router.push(href, { scroll: false });

  const tl = gsap.timeline();
  tl.to(quad.uniforms.uTransition, { value: 1, duration: TR_DURATION, ease: "power3.inOut" }, 0);
  // the (DOM) header follows the new scene once the dots start revealing it
  tl.call(() => window.dispatchEvent(new CustomEvent("rg:header-swap")), [], TR_DURATION * 0.55);
  tl.to(quad.uniforms.uBlur, { value: 1.3, duration: TR_DURATION, ease: "power3.out" }, 0);
  tl.to(quad.uniforms.uSize2, { value: -0.2, duration: TR_DURATION, ease: "power3.out" }, 0);
  await tl.then();
  quad.dispose();
  live.release();
  active = false;
}

/** first-load reveal: black "from" scene opened by the same dot grid, centred */
export async function runFirstReveal(onCovered?: () => void, duration = 1.7) {
  const { getStage } = await import("@/gl/stage");
  const stage = await getStage();
  const quad = stage.sceneQuad(null, 1, { x: 0.5, y: 0.5 });
  // wait until the black quad is on screen before removing the DOM loader
  await frame();
  await frame();
  onCovered?.();
  gsap.to(quad.uniforms.uFirst, { value: 0, duration, ease: "power4.in" });
  gsap.to(quad.uniforms.uBlur, { value: 1.3, duration, ease: "power3.out" });
  gsap.to(quad.uniforms.uSize2, { value: -0.2, duration, ease: "power3.out" });
  await gsap.to(quad.uniforms.uTransition, { value: 1, duration, ease: "power3.inOut" }).then();
  quad.dispose();
}
