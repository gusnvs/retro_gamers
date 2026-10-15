// Single fixed WebGL canvas that renders every motion-vector object on top of the
// DOM, aligned to placeholder elements (same approach as the reference, where a
// fixed canvas draws GL layers bound to DOM rects).
import * as THREE from "three";
import manifest from "../../public/assets/mv/manifest.json";
import { mvFragment, mvVertex } from "./shaders";
import { getReel } from "./reel";
import { trail } from "@/lib/trail";
import { sceneFragment, sceneVertex } from "./sceneTransition";

export type MVName = keyof typeof manifest;
export const MV_NAMES = Object.keys(manifest) as MVName[];

const BRAND = new THREE.Color("#3da9f4");
const BASE = "/assets/mv/";

export interface MVOptions {
  useMask?: boolean;
  quality?: "high" | "med";
  renderOrder?: number;
  small?: boolean;
}

export interface SceneQuad {
  uniforms: Record<string, THREE.IUniform>;
  dispose: () => void;
}

/** live layers of the outgoing page, kept moving during a scene transition */
export interface FromReel {
  rect: { left: number; top: number; width: number; height: number };
  clip: { left: number; top: number; right: number; bottom: number };
}
export interface FromMarquee {
  /** the marquee track rendered without its animated translate */
  canvas: HTMLCanvasElement;
  /** visible strip (screen px) and its corner radius */
  clip: { left: number; top: number; width: number; height: number; radius: number };
  /** track box without its animated translate */
  box: { left: number; top: number; width: number; height: number };
  /** current translate (screen px) */
  offset: { x: number; y: number };
  /** px/s along the track; wraps every `loop` px */
  velocity: { x: number; y: number };
  loop: number;
}
export interface LiveFrom {
  texture: THREE.Texture;
  release: () => void;
}

const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const pageFragment = /* glsl */ `
uniform sampler2D tMap;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(tMap, vUv).rgb, 1.0); }
`;
// reel canvas: object-fit cover inside its box, clipped by the holder's inset
const reelFragment = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uCover;
uniform vec4 uClip;
varying vec2 vUv;
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y);
  if (p.x < uClip.x || p.y < uClip.y || p.x > uClip.z || p.y > uClip.w) discard;
  vec2 st = (vUv - 0.5) * uCover + 0.5;
  gl_FragColor = vec4(texture2D(tMap, st).rgb, 1.0);
}
`;
// marquee track: its texture keeps scrolling inside the (rounded) strip
const marqueeFragment = /* glsl */ `
uniform sampler2D tMap;
uniform vec4 uClip;
uniform float uRadius;
uniform vec4 uBox;
uniform vec2 uOffset;
varying vec2 vUv;
void main() {
  vec2 p = uClip.xy + vec2(vUv.x, 1.0 - vUv.y) * uClip.zw;
  vec2 q = abs(p - uClip.xy - uClip.zw * 0.5) - (uClip.zw * 0.5 - uRadius);
  if (length(max(q, 0.0)) > uRadius) discard;
  vec2 l = (p - uBox.xy - uOffset) / uBox.zw;
  if (l.x < 0.0 || l.y < 0.0 || l.x > 1.0 || l.y > 1.0) discard;
  gl_FragColor = texture2D(tMap, vec2(l.x, 1.0 - l.y));
}
`;

export interface MVItem {
  el: HTMLElement;
  name: MVName;
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  hovered: boolean;
  ready: Promise<void>;
  alpha?: { data: Uint8ClampedArray; size: number };
  disposed: boolean;
}

type Tex = THREE.Texture;

class GLStage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  items = new Set<MVItem>();
  mouse = new THREE.Vector2(0.5, 0.5);
  mouseRaw = new THREE.Vector2(0.5, 0.5);
  pointer = { x: -1, y: -1, inside: false };
  geometry: THREE.PlaneGeometry;
  noise: THREE.DataTexture;
  black: THREE.DataTexture;
  reelTex: THREE.CanvasTexture;
  drawTex: THREE.DataTexture;
  velocity = { value: 0 };
  private quads = new Set<THREE.Mesh>();
  // outgoing page during a transition: its MV items (frozen at their last rect),
  // reels and marquees keep animating, rendered into fromRT each frame
  private fromScene: THREE.Scene | null = null;
  private fromRT: THREE.WebGLRenderTarget | null = null;
  private fromItems = new Map<MVItem, { left: number; top: number; width: number; height: number }>();
  private fromRemoved = new Set<MVItem>();
  private fromTicks: ((dt: number) => void)[] = [];
  private texCache = new Map<string, Promise<Tex>>();
  private alphaCache = new Map<string, Promise<{ data: Uint8ClampedArray; size: number }>>();
  private lastScroll = 0;
  private last = performance.now();
  private start = performance.now();
  private raf = 0;
  private desktop: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.desktop = !matchMedia("(pointer: coarse)").matches;

    this.geometry = new THREE.PlaneGeometry(1, 1, 8, 8);
    this.geometry.translate(0.5, -0.5, 0); // top-left anchored like GLUI planes

    const size = 128;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 255;
    this.noise = new THREE.DataTexture(data, size, size);
    this.noise.wrapS = this.noise.wrapT = THREE.RepeatWrapping;
    this.noise.magFilter = this.noise.minFilter = THREE.LinearFilter;
    this.noise.needsUpdate = true;
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;

    this.drawTex = this.makeDrawTex(1, 1);
    trail.subscribe((f) => {
      const img = this.drawTex.image as { width: number; height: number; data: Uint8Array };
      if (img.width !== f.cols || img.height !== f.rows) {
        this.drawTex.dispose();
        this.drawTex = this.makeDrawTex(f.cols, f.rows);
        this.items.forEach((it) => (it.uniforms.tDraw.value = this.drawTex));
      }
      const data = (this.drawTex.image as { data: Uint8Array }).data;
      for (let j = 0; j < f.rows; j++) {
        const row = (f.rows - 1 - j) * f.cols; // texture v=0 is the bottom
        for (let i = 0; i < f.cols; i++) data[(row + i) * 4] = Math.min(255, f.field[j * f.cols + i] * 255);
      }
      this.drawTex.needsUpdate = true;
    });

    this.reelTex = new THREE.CanvasTexture(getReel().canvas);
    this.reelTex.wrapS = this.reelTex.wrapT = THREE.MirroredRepeatWrapping;

    window.addEventListener("pointermove", this.onPointer, { passive: true });
    window.addEventListener("pointerdown", this.onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => (this.pointer.inside = false));
    window.addEventListener("resize", this.resize);
    this.resize();
    this.lastScroll = window.scrollY;
    this.raf = requestAnimationFrame(this.tick);
  }

  private makeDrawTex(w: number, h: number) {
    const t = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.pointer.inside = true;
    this.mouseRaw.set(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
  };

  private resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  };

  private loadTexture(url: string): Promise<Tex> {
    let p = this.texCache.get(url);
    if (!p) {
      p = new Promise<Tex>((resolve, reject) => {
        new THREE.TextureLoader().load(url, (t) => {
          t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
          t.generateMipmaps = true;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          resolve(t);
        }, undefined, reject);
      });
      this.texCache.set(url, p);
    }
    return p;
  }

  private loadAlpha(name: string, v = "") {
    let p = this.alphaCache.get(name);
    if (!p) {
      p = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const size = 512;
          const c = document.createElement("canvas");
          c.width = c.height = size;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0, size, size);
          resolve({ data: ctx.getImageData(0, 0, size, size).data, size });
        };
        img.src = `${BASE}${name}_alpha.jpg${v}`;
      });
      this.alphaCache.set(name, p);
    }
    return p;
  }

  add(el: HTMLElement, name: MVName, opts: MVOptions = {}): MVItem {
    const meta = manifest[name];
    const uniforms: Record<string, THREE.IUniform> = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
      tDiffuse: { value: this.black },
      tAlpha: { value: this.black },
      tMotion: { value: this.black },
      tPosition: { value: this.black },
      tData: { value: this.black },
      tDraw: { value: this.drawTex },
      tReel: { value: this.reelTex },
      tNoise: { value: this.noise },
      uTransition: { value: 0 },
      uColumns: { value: meta.columns },
      uRows: { value: meta.rows },
      uRandom: { value: Math.random() * 1000 },
      uDisplacementStrength: { value: meta.displacementStrength },
      uMouse: { value: this.mouse.clone() },
      uColor: { value: new THREE.Color() },
      uStrengthColor: { value: 0.45 },
      uStrengthDraw: { value: 0 },
      uClickUv: { value: new THREE.Vector2(0.5, 0.5) },
      uClickTime: { value: 1e6 },
      uInside: { value: 0 },
      uSmall: { value: opts.small ? 1 : 0 },
      uLightColor: { value: BRAND.clone() },
      uLightColorStr: { value: 0 },
      uUseMask: { value: opts.useMask ? 1 : 0 },
      uRTMask: { value: 0 },
      uVelocity: this.velocity,
      uOpacity: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: mvVertex,
      fragmentShader: mvFragment,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      defines: this.desktop ? { DESKTOP: "" } : {},
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = opts.renderOrder ?? 0;
    this.scene.add(mesh);

    const item: MVItem = { el, name, mesh, uniforms, hovered: false, disposed: false, ready: Promise.resolve() };
    const q = opts.quality ?? "med";
    const v = `?v=${(meta as { v?: string }).v ?? "0"}`;
    const diffuseUrl = q === "high" ? `${BASE}${name}_diffuse.jpg${v}` : `${BASE}${name}_diffuse-med.jpg${v}`;
    item.ready = Promise.all([
      this.loadTexture(diffuseUrl),
      this.loadTexture(`${BASE}${name}_alpha.jpg${v}`),
      this.loadTexture(`${BASE}${name}_mv.png${v}`),
      this.loadTexture(`${BASE}${name}_position.png${v}`),
      this.loadTexture(`${BASE}${name}_data.png${v}`),
      this.loadAlpha(name, v),
    ]).then(([d, a, m, p, dt, alpha]) => {
      uniforms.tDiffuse.value = d;
      uniforms.tAlpha.value = a;
      uniforms.tMotion.value = m;
      uniforms.tPosition.value = p;
      uniforms.tData.value = dt;
      item.alpha = alpha;
    });
    this.items.add(item);
    return item;
  }

  /** warm the texture cache for an object (e.g. before a page transition) */
  preload(name: MVName, quality: "high" | "med" = "med") {
    const meta = manifest[name] as { v?: string };
    const v = `?v=${meta.v ?? "0"}`;
    const diffuse = quality === "high" ? `${BASE}${name}_diffuse.jpg${v}` : `${BASE}${name}_diffuse-med.jpg${v}`;
    for (const u of [diffuse, `${BASE}${name}_alpha.jpg${v}`, `${BASE}${name}_mv.png${v}`, `${BASE}${name}_position.png${v}`, `${BASE}${name}_data.png${v}`]) this.loadTexture(u);
    this.loadAlpha(name, v);
  }

  remove(item: MVItem) {
    if (this.fromItems.has(item)) {
      // still drawn by the outgoing scene: dispose once the transition ends
      item.disposed = true;
      this.fromRemoved.add(item);
      return;
    }
    item.disposed = true;
    this.items.delete(item);
    this.scene.remove(item.mesh);
    (item.mesh.material as THREE.Material).dispose();
  }

  /** alpha of the object under a local uv (0..1, y down) at the current frame */
  private hitAlpha(item: MVItem, u: number, v: number) {
    const a = item.alpha;
    if (!a) return 0;
    const t = item.uniforms.uTransition.value as number;
    const mx = (item.uniforms.uMouse.value as THREE.Vector2).x;
    const ss = (e0: number, e1: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return k * k * (3 - 2 * k);
    };
    const controller = ss(0.1, 0.4, t) * (1 - ss(0.2, 1, t)) + mx * ss(0.2, 1, t);
    const cols = item.uniforms.uColumns.value as number, rows = item.uniforms.uRows.value as number;
    const index = Math.round(Math.min(cols * rows - 1, Math.max(1, 1 + controller * (cols * rows - 2))));
    const col = index % cols, row = Math.floor(index / cols) % rows;
    const cell = a.size / cols;
    const px = Math.floor((col + u) * cell), py = Math.floor((row + v) * cell);
    if (px < 0 || py < 0 || px >= a.size || py >= a.size) return 0;
    return a.data[(py * a.size + px) * 4] / 255;
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(64, now - this.last);
    this.last = now;
    const hz = dt / (1000 / 60);
    const time = (now - this.start) / 1000;

    // reference: mouse.x += .1*sin(.001*t); mouse.x = smoothstep(.1,.9,mouse.x); lerp .08
    const target = this.mouseRaw.clone();
    target.x += 0.1 * Math.sin(0.001 * (now - this.start));
    const k = Math.min(1, Math.max(0, (target.x - 0.1) / 0.8));
    target.x = k * k * (3 - 2 * k);

    const sy = window.scrollY;
    const vel = (sy - this.lastScroll) / Math.max(1, hz);
    this.lastScroll = sy;
    this.velocity.value += (Math.abs(vel) * 0.05 - this.velocity.value) * 0.1;

    const reel = getReel();
    if (reel.update(now)) this.reelTex.needsUpdate = true;

    const W = window.innerWidth, H = window.innerHeight;
    const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    let any = false;
    for (const item of this.items) {
      const u = item.uniforms;
      const r = item.el.getBoundingClientRect();
      const onScreen = r.width > 0 && r.bottom > -100 && r.top < H + 100 && r.right > -100 && r.left < W + 100;
      const visible = onScreen && (u.uTransition.value as number) > 0.001 && (u.uOpacity.value as number) > 0.001 && !!item.alpha;
      item.mesh.visible = visible;
      (u.uMouse.value as THREE.Vector2).lerp(target, 0.08 * hz);
      u.time.value = time;
      (u.resolution.value as THREE.Vector2).copy(buf);
      u.uClickTime.value = (u.uClickTime.value as number) + dt / 1200;
      if ((u.uInside.value as number) > 0) u.uInside.value = Math.max(0, (u.uInside.value as number) - 0.01 * hz);
      if (!visible) { item.hovered = false; continue; }
      any = true;
      item.mesh.position.set(r.left, -r.top, 0);
      item.mesh.scale.set(r.width, r.height, 1);

      // hover: pulse starts where the pointer enters the object's silhouette
      let hovered = false;
      if (this.pointer.inside && this.pointer.x >= r.left && this.pointer.x <= r.right && this.pointer.y >= r.top && this.pointer.y <= r.bottom) {
        const lu = (this.pointer.x - r.left) / r.width, lv = (this.pointer.y - r.top) / r.height;
        hovered = this.hitAlpha(item, lu, lv) > 0.5;
        if (hovered && !item.hovered) {
          (u.uClickUv.value as THREE.Vector2).set(lu, 1 - lv);
          u.uClickTime.value = 0;
          u.uInside.value = 1;
        }
      }
      item.hovered = hovered;
    }
    if (this.fromScene && this.fromRT) {
      for (const [item, r] of this.fromItems) {
        const u = item.uniforms;
        (u.uMouse.value as THREE.Vector2).lerp(target, 0.08 * hz);
        u.time.value = time;
        (u.resolution.value as THREE.Vector2).copy(buf);
        u.uClickTime.value = (u.uClickTime.value as number) + dt / 1200;
        if ((u.uInside.value as number) > 0) u.uInside.value = Math.max(0, (u.uInside.value as number) - 0.01 * hz);
        item.mesh.position.set(r.left, -r.top, 0);
        item.mesh.scale.set(r.width, r.height, 1);
        item.mesh.visible = true;
      }
      this.fromTicks.forEach((f) => f(dt));
      if (this.fromRT.width !== buf.x || this.fromRT.height !== buf.y) this.fromRT.setSize(buf.x, buf.y);
      this.renderer.setRenderTarget(this.fromRT);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      this.renderer.render(this.fromScene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.setClearColor(0x000000, 0);
    }
    for (const q of this.quads) {
      const u = (q.material as THREE.ShaderMaterial).uniforms;
      u.time.value = time;
      (u.resolution.value as THREE.Vector2).copy(buf);
      q.scale.set(W, H, 1);
      any = true;
    }
    if (any) this.renderer.render(this.scene, this.camera);
    else this.renderer.clear();
  };

  /** full-screen dot-grid scene transition (reference SceneTransition.fs) */
  sceneQuad(from: THREE.Texture | HTMLCanvasElement | null, mode: 0 | 1, mouse: { x: number; y: number }): SceneQuad {
    const owned = from instanceof HTMLCanvasElement;
    const tex = from instanceof THREE.Texture ? from : from ? new THREE.CanvasTexture(from) : this.black;
    if (owned) {
      tex.colorSpace = THREE.NoColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
    }
    const uniforms: Record<string, THREE.IUniform> = {
      tFrom: { value: tex },
      uVelocity: this.velocity,
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      uMousePosition: { value: new THREE.Vector2(mouse.x, mouse.y) },
      uTransition: { value: 0 },
      uFirst: { value: mode === 1 ? 1 : 0 },
      uBlur: { value: 1 },
      uSize2: { value: 0.35 },
      uZoom: { value: 23 },
      uMode: { value: mode },
      uFade: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: sceneVertex, fragmentShader: sceneFragment, uniforms, transparent: true, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(this.geometry, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10000;
    mesh.position.set(0, 0, 0);
    mesh.scale.set(window.innerWidth, window.innerHeight, 1);
    this.scene.add(mesh);
    this.quads.add(mesh);
    return {
      uniforms,
      dispose: () => {
        this.quads.delete(mesh);
        this.scene.remove(mesh);
        mat.dispose();
        if (owned) tex.dispose();
      },
    };
  }

  private canvasTex(c: HTMLCanvasElement) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }

  private fromQuad(fragmentShader: string, uniforms: Record<string, THREE.IUniform>, r: { left: number; top: number; width: number; height: number }, order: number) {
    const mat = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(this.geometry, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.position.set(r.left, -r.top, 0);
    mesh.scale.set(r.width, r.height, 1);
    this.fromScene!.add(mesh);
    return mesh;
  }

  /**
   * Keeps the current page alive as the "from" scene of a transition: the DOM
   * snapshot (`page`, taken without the live layers) at the back, reels and
   * marquees re-drawn every frame on top, and the page's motion-vector objects
   * adopted from the main scene (still following the mouse, still pulsing). The
   * returned texture is re-rendered every frame until `release()`.
   */
  liveFrom(page: HTMLCanvasElement, layers: { reels?: FromReel[]; marquees?: FromMarquee[] } = {}): LiveFrom {
    this.releaseFrom();
    const W = window.innerWidth, H = window.innerHeight;
    const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const scene = new THREE.Scene();
    this.fromScene = scene;
    this.fromRT = new THREE.WebGLRenderTarget(buf.x, buf.y, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    const disposables: { dispose: () => void }[] = [];

    const pageTex = this.canvasTex(page);
    const pageQuad = this.fromQuad(pageFragment, { tMap: { value: pageTex } }, { left: 0, top: 0, width: W, height: H }, -3);
    disposables.push(pageTex, pageQuad.material as THREE.Material);

    for (const m of layers.marquees ?? []) {
      const tex = this.canvasTex(m.canvas);
      const off = new THREE.Vector2(m.offset.x, m.offset.y);
      const u: Record<string, THREE.IUniform> = {
        tMap: { value: tex },
        uClip: { value: new THREE.Vector4(m.clip.left, m.clip.top, m.clip.width, m.clip.height) },
        uRadius: { value: Math.min(m.clip.radius, m.clip.width / 2, m.clip.height / 2) },
        uBox: { value: new THREE.Vector4(m.box.left, m.box.top, m.box.width, m.box.height) },
        uOffset: { value: off },
      };
      const q = this.fromQuad(marqueeFragment, u, m.clip, -2);
      (q.material as THREE.ShaderMaterial).transparent = true;
      this.fromTicks.push((dt) => {
        off.x += (m.velocity.x * dt) / 1000;
        off.y += (m.velocity.y * dt) / 1000;
        // the track holds its content twice: jump back by one copy
        if (m.loop > 0 && Math.hypot(off.x, off.y) >= m.loop) off.multiplyScalar(1 - m.loop / Math.hypot(off.x, off.y));
      });
      disposables.push(tex, q.material as THREE.Material);
    }

    for (const r of layers.reels ?? []) {
      const img = this.reelTex.image as HTMLCanvasElement;
      const ca = img.width / img.height, ra = r.rect.width / r.rect.height;
      const cover = ra > ca ? new THREE.Vector2(1, ca / ra) : new THREE.Vector2(ra / ca, 1);
      const clip = new THREE.Vector4(
        (r.clip.left - r.rect.left) / r.rect.width,
        (r.clip.top - r.rect.top) / r.rect.height,
        (r.clip.right - r.rect.left) / r.rect.width,
        (r.clip.bottom - r.rect.top) / r.rect.height,
      );
      const q = this.fromQuad(reelFragment, { tMap: { value: this.reelTex }, uCover: { value: cover }, uClip: { value: clip } }, r.rect, -1);
      disposables.push(q.material as THREE.Material);
    }

    for (const item of [...this.items]) {
      if (!item.mesh.visible) continue;
      const r = item.el.getBoundingClientRect();
      this.items.delete(item);
      this.fromItems.set(item, { left: r.left, top: r.top, width: r.width, height: r.height });
      this.scene.remove(item.mesh);
      scene.add(item.mesh);
      item.hovered = false;
    }

    const rt = this.fromRT;
    return {
      texture: rt.texture,
      release: () => {
        if (this.fromRT === rt) this.releaseFrom();
        disposables.forEach((d) => d.dispose());
      },
    };
  }

  private releaseFrom() {
    if (!this.fromScene) return;
    for (const item of this.fromItems.keys()) {
      this.fromScene.remove(item.mesh);
      if (this.fromRemoved.has(item)) {
        (item.mesh.material as THREE.Material).dispose();
      } else {
        // the component outlived the route change: hand it back to the page
        this.items.add(item);
        this.scene.add(item.mesh);
      }
    }
    this.fromItems.clear();
    this.fromRemoved.clear();
    this.fromTicks = [];
    this.fromRT?.dispose();
    this.fromRT = null;
    this.fromScene = null;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("pointermove", this.onPointer);
    window.removeEventListener("pointerdown", this.onPointer);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }
}

let stage: GLStage | null = null;
let resolveStage: (s: GLStage) => void;
const stagePromise = new Promise<GLStage>((r) => (resolveStage = r));

export function initStage(canvas: HTMLCanvasElement) {
  if (!stage) {
    stage = new GLStage(canvas);
    resolveStage(stage);
  }
  return stage;
}

export function getStage() {
  return stagePromise;
}
