// Pixelated mouse-trail field (screen space).
// Reference: a "draw" buffer (R = pointer trail decaying x0.94/frame, G = fluid
// density) is read by every GL element: shapes swap uColor->uColor2 where
// fluid*2 > 0.5, text turns rainbow (fluid*2 > 0.5) then white (> 0.8..1.0).
// Here the same field lives on a coarse grid so the effect reads as pixels
// instead of a brush. Consumers subscribe and turn the cells into clip paths.

export type TrailMode = "invert" | "difference" | "custom";

export interface Run {
  y: number; // px (viewport)
  x0: number;
  x1: number;
  core: boolean; // value above the "white text" threshold
  mode: TrailMode;
}

export interface TrailFrame {
  cell: number;
  cols: number;
  rows: number;
  field: Float32Array;
  runs: Run[];
  active: boolean;
  time: number;
}

type Listener = (f: TrailFrame) => void;

const FRINGE = 0.25; // fluid*2 > 0.5
const CORE = 0.45; // fluid*2 > 0.9 (smoothstep(0.8,1.0))
const DECAY = 0.955; // between DrawShader uTrail (.94) and fluid density dissipation (.95..)
const RADIUS = 92; // px, splat radius

class TrailField {
  cell = 16;
  cols = 0;
  rows = 0;
  field = new Float32Array(0);
  private tmp = new Float32Array(0);
  private noise = new Float32Array(0);
  private listeners = new Set<Listener>();
  private regions: { el: HTMLElement; mode: TrailMode }[] = [];
  private mouse = { x: -1, y: -1, px: -1, py: -1, moved: false };
  private raf = 0;
  private last = performance.now();
  private start = performance.now();
  private enabled = false;
  private wasActive = false;
  private noiseTick = -1;

  init() {
    if (typeof window === "undefined" || this.enabled) return;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    this.enabled = true;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    this.raf = requestAnimationFrame(this.tick);
  }

  get isEnabled() {
    return this.enabled;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** later / smaller regions win; unregistered areas use "invert" */
  region(el: HTMLElement, mode: TrailMode) {
    const r = { el, mode };
    this.regions.push(r);
    return () => {
      this.regions = this.regions.filter((x) => x !== r);
    };
  }

  private resize = () => {
    this.cell = Math.max(12, Math.round(window.innerWidth / 90));
    this.cols = Math.ceil(window.innerWidth / this.cell);
    this.rows = Math.ceil(window.innerHeight / this.cell);
    this.field = new Float32Array(this.cols * this.rows);
    this.tmp = new Float32Array(this.cols * this.rows);
    this.noise = new Float32Array(this.cols * this.rows);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.mouse.moved = true;
  };

  private splat(ax: number, ay: number, bx: number, by: number, r: number) {
    const { cell, cols, rows, field } = this;
    const minX = Math.max(0, Math.floor((Math.min(ax, bx) - r) / cell));
    const maxX = Math.min(cols - 1, Math.floor((Math.max(ax, bx) + r) / cell));
    const minY = Math.max(0, Math.floor((Math.min(ay, by) - r) / cell));
    const maxY = Math.min(rows - 1, Math.floor((Math.max(ay, by) + r) / cell));
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    for (let j = minY; j <= maxY; j++) {
      for (let i = minX; i <= maxX; i++) {
        const px = (i + 0.5) * cell, py = (j + 0.5) * cell;
        // distance to segment (splatShader "l()")
        const h = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
        const d = Math.hypot(px - ax - dx * h, py - ay - dy * h);
        const t = Math.min(1, d / r);
        const f = t - 1;
        const v = 1 - (f * f * f + 1); // 1 - cubicOut
        const k = j * cols + i;
        // screen blend
        field[k] = 1 - (1 - field[k]) * (1 - v);
      }
    }
  }

  private modeAt(x: number, y: number, rects: { r: DOMRect; mode: TrailMode; area: number }[]): TrailMode {
    let best: TrailMode = "invert";
    let bestArea = Infinity;
    for (const { r, mode, area } of rects) {
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom && area <= bestArea) {
        best = mode;
        bestArea = area;
      }
    }
    return best;
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(64, now - this.last);
    this.last = now;
    const hz = dt / (1000 / 60);
    const { cols, rows, field, tmp, cell } = this;

    // splat along the pointer segment (speed widens the stroke slightly)
    const m = this.mouse;
    if (m.moved) {
      if (m.px < 0) {
        m.px = m.x;
        m.py = m.y;
      }
      const speed = Math.hypot(m.x - m.px, m.y - m.py);
      if (speed > 0.5) this.splat(m.px, m.py, m.x, m.y, RADIUS * (0.6 + Math.min(1, speed / 40) * 0.6));
      m.px = m.x;
      m.py = m.y;
      m.moved = false;
    }

    // decay + light diffusion (fluid-like spread)
    const decay = Math.pow(DECAY, hz);
    let any = false;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const c = field[k];
        const l = i > 0 ? field[k - 1] : c, r = i < cols - 1 ? field[k + 1] : c;
        const u = j > 0 ? field[k - cols] : c, d = j < rows - 1 ? field[k + cols] : c;
        // fluid-like spread: neighbours bleed in, so blobs grow while they fade
        const v = Math.max(c * 0.5 + (l + r + u + d) * 0.125, c * 0.92) * decay;
        tmp[k] = v < 0.01 ? 0 : v;
        if (tmp[k] > 0) any = true;
      }
    }
    field.set(tmp);

    // shimmering pixel noise on the edges (12 fps)
    const nt = Math.floor((now - this.start) / 83);
    if (nt !== this.noiseTick) {
      this.noiseTick = nt;
      for (let k = 0; k < this.noise.length; k++) this.noise[k] = (Math.random() - 0.5) * 0.12;
    }

    if (!any && !this.wasActive) return;
    this.wasActive = any;

    const rects = this.regions
      .map(({ el, mode }) => {
        const r = el.getBoundingClientRect();
        return { r, mode, area: r.width * r.height };
      })
      .filter((x) => x.area > 0);

    const runs: Run[] = [];
    if (any) {
      for (let j = 0; j < rows; j++) {
        let cur: Run | null = null;
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          const v = field[k] + (field[k] > 0.05 ? this.noise[k] : 0);
          const kind = v > CORE ? 2 : v > FRINGE ? 1 : 0;
          const mode = kind ? this.modeAt((i + 0.5) * cell, (j + 0.5) * cell, rects) : "invert";
          if (cur && kind && cur.core === (kind === 2) && cur.mode === mode && cur.x1 === i * cell) {
            cur.x1 = (i + 1) * cell;
          } else {
            if (cur) runs.push(cur);
            cur = kind ? { y: j * cell, x0: i * cell, x1: (i + 1) * cell, core: kind === 2, mode } : null;
          }
        }
        if (cur) runs.push(cur);
      }
    }

    const frame: TrailFrame = { cell, cols, rows, field, runs, active: any, time: (now - this.start) / 1000 };
    this.listeners.forEach((fn) => fn(frame));
  };
}

export const trail = new TrailField();

/** clockwise rectangles so nonzero unions work with other clockwise shapes */
export function runsToPath(runs: Run[], cell: number, ox = 0, oy = 0, filter?: (r: Run) => boolean) {
  let d = "";
  for (const r of runs) {
    if (filter && !filter(r)) continue;
    d += `M${r.x0 - ox} ${r.y - oy}H${r.x1 - ox}V${r.y + cell - oy}H${r.x0 - ox}Z`;
  }
  return d;
}

/** clip runs to a rectangle (viewport coords) */
export function clipRuns(runs: Run[], cell: number, rect: DOMRect): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (r.y + cell <= rect.top || r.y >= rect.bottom) continue;
    const x0 = Math.max(r.x0, rect.left), x1 = Math.min(r.x1, rect.right);
    if (x1 > x0) out.push({ ...r, x0, x1 });
  }
  return out;
}
