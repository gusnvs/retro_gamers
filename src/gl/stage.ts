// Single fixed WebGL canvas that renders every motion-vector object on top of the
// DOM, aligned to placeholder elements (same approach as the reference, where a
// fixed canvas draws GL layers bound to DOM rects).
import * as THREE from "three";
import manifest from "../../public/assets/mv/manifest.json";
import { mvFragment, mvVertex } from "./shaders";
import { getReel } from "./reel";

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
  velocity = { value: 0 };
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
      tDraw: { value: this.black },
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

  remove(item: MVItem) {
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
    if (any) this.renderer.render(this.scene, this.camera);
    else this.renderer.clear();
  };

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
