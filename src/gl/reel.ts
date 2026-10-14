// Procedural "showreel" rendered on a 2D canvas.
// The reference plays /images/reel_desktop.mp4 (studio showreel) both in the reel
// section and projected on device screens. RetroGamers has no reel video yet, so
// this canvas is a clearly-identified substitute: short retro-game vignettes cut
// like a reel. Drop a video at /public/media/reel.mp4 and set USE_VIDEO = true in
// Reel to switch to a real file.

const BRAND = "#3da9f4";
const W = 1280;
const H = 720;
const SCENE_SECONDS = 3.2;

const INVADER = [
  "..X.....X..",
  "...X...X...",
  "..XXXXXXX..",
  ".XX.XXX.XX.",
  "XXXXXXXXXXX",
  "X.XXXXXXX.X",
  "X.X.....X.X",
  "...XX.XX...",
];

type Ctx = CanvasRenderingContext2D;

function pixelSprite(ctx: Ctx, rows: string[], x: number, y: number, px: number, color: string) {
  ctx.fillStyle = color;
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === "X") ctx.fillRect(x + i * px, y + j * px, px, px);
  });
}

function bigText(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center") {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px Archivo, Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

const scenes: ((ctx: Ctx, t: number) => void)[] = [
  // synthwave sun + grid
  (ctx, t) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#050414");
    g.addColorStop(0.55, "#1b0b3a");
    g.addColorStop(0.56, "#05030d");
    g.addColorStop(1, "#05030d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const sg = ctx.createLinearGradient(0, 120, 0, 400);
    sg.addColorStop(0, "#ffd36b");
    sg.addColorStop(1, "#ff3d8b");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(W / 2, 400, 200, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#1b0b3a";
    for (let i = 0; i < 7; i++) ctx.fillRect(W / 2 - 220, 300 + i * 15 + i * i, 440, 3 + i * 1.6);
    ctx.strokeStyle = BRAND;
    ctx.lineWidth = 2;
    const hz = 403;
    for (let i = -20; i <= 20; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 12, hz);
      ctx.lineTo(W / 2 + i * 140, H);
      ctx.stroke();
    }
    const off = (t * 60) % 40;
    for (let k = 0; k < 14; k++) {
      const z = (k * 40 + off) / 560;
      const y = hz + Math.pow(z, 2.2) * (H - hz);
      ctx.globalAlpha = Math.min(1, z * 2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    bigText(ctx, "RETRO GAMERS", W / 2, 170, 120, "#ffffff");
  },
  // invaders
  (ctx, t) => {
    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, 0, W, H);
    const dx = Math.sin(t * 1.6) * 90;
    const step = Math.floor(t * 4) % 2;
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 9; i++) {
        const rows = step ? INVADER : INVADER.map((r) => r.split("").reverse().join(""));
        pixelSprite(ctx, rows, 190 + i * 100 + dx, 90 + j * 80 + Math.floor(t) * 2, 6, j === 0 ? "#ffffff" : BRAND);
      }
    const px = W / 2 + Math.sin(t * 2.3) * 380;
    ctx.fillStyle = "#39ff88";
    ctx.fillRect(px - 40, 640, 80, 22);
    ctx.fillRect(px - 8, 622, 16, 18);
    ctx.fillStyle = "#ffffff";
    for (let k = 0; k < 3; k++) {
      const by = 600 - ((t * 700 + k * 230) % 560);
      ctx.fillRect(px - 3 + Math.sin(k) * 10, by, 6, 22);
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 34px Archivo, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE ${String(2013 + Math.floor(t * 37)).padStart(6, "0")}`, 60, 50);
    ctx.textAlign = "right";
    ctx.fillText("HI 999999", W - 60, 50);
  },
  // pong
  (ctx, t) => {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e9e9e9";
    for (let y = 20; y < H; y += 40) ctx.fillRect(W / 2 - 4, y, 8, 22);
    const bx = W / 2 + Math.sin(t * 2.1) * 520;
    const by = H / 2 + Math.sin(t * 3.3) * 280;
    ctx.fillRect(bx - 12, by - 12, 24, 24);
    ctx.fillRect(70, by - 70 + Math.sin(t * 5) * 20, 22, 140);
    ctx.fillRect(W - 92, by - 70 - Math.sin(t * 4) * 20, 22, 140);
    bigText(ctx, String(Math.floor(t) % 10), W / 2 - 120, 90, 110, "#e9e9e9");
    bigText(ctx, String((Math.floor(t * 1.3) + 3) % 10), W / 2 + 120, 90, 110, "#e9e9e9");
  },
  // platformer runner
  (ctx, t) => {
    ctx.fillStyle = "#5c94fc";
    ctx.fillRect(0, 0, W, H);
    const scroll = (t * 260) % 64;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 330 - t * 50) % (W + 300)) + W;
      const x = (cx % (W + 300)) - 150;
      ctx.beginPath();
      ctx.ellipse(x, 120 + (i % 2) * 60, 90, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let x = -scroll; x < W; x += 64) {
      ctx.fillStyle = "#c84c0c";
      ctx.fillRect(x, 592, 62, 62);
      ctx.fillRect(x, 656, 62, 64);
      ctx.fillStyle = "#fcbcb0";
      ctx.fillRect(x + 4, 596, 54, 6);
    }
    for (let k = 0; k < 6; k++) {
      const x = ((k * 230 - t * 260) % (W + 230) + W + 230) % (W + 230) - 60;
      ctx.fillStyle = "#fcd800";
      ctx.fillRect(x, 420 - (k % 2) * 90, 26, 36);
      ctx.fillStyle = "#c88800";
      ctx.fillRect(x + 9, 426 - (k % 2) * 90, 8, 24);
    }
    const jump = Math.abs(Math.sin(t * 3.2)) * 170;
    const hx = 380, hy = 528 - jump;
    ctx.fillStyle = BRAND;
    ctx.fillRect(hx, hy, 48, 34);
    ctx.fillStyle = "#ffcf9c";
    ctx.fillRect(hx + 6, hy - 30, 36, 30);
    ctx.fillStyle = "#101010";
    ctx.fillRect(hx + 30, hy - 22, 6, 8);
    ctx.fillStyle = "#e52521";
    ctx.fillRect(hx - 2, hy - 40, 52, 14);
    ctx.fillStyle = "#6b3a12";
    ctx.fillRect(hx, hy + 34, 18, 30);
    ctx.fillRect(hx + 30, hy + 34, 18, 30);
  },
  // shelf of rare games
  (ctx, t) => {
    ctx.fillStyle = "#14161a";
    ctx.fillRect(0, 0, W, H);
    const palette = ["#e52521", "#3da9f4", "#f6c90e", "#1db954", "#ffffff", "#7b2ff7", "#ff7a00", "#101010"];
    for (let row = 0; row < 3; row++) {
      const y = 70 + row * 210;
      ctx.fillStyle = "#3a2a1c";
      ctx.fillRect(0, y + 176, W, 18);
      const off = ((t * (row % 2 ? -90 : 120)) % 56 + 56) % 56;
      for (let i = -2; i < 26; i++) {
        const x = i * 56 + off;
        const c = palette[(i * 7 + row * 3 + 64) % palette.length];
        ctx.fillStyle = c;
        ctx.fillRect(x, y + 20 + ((i * 13) % 20), 50, 156 - ((i * 13) % 20));
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.fillRect(x + 6, y + 60, 38, 8);
        ctx.fillRect(x + 6, y + 120, 38, 18);
      }
    }
    ctx.fillStyle = "rgba(4,6,10,.72)";
    ctx.fillRect(0, H / 2 - 70, W, 140);
    bigText(ctx, "CURADORIA EM JOGOS RAROS", W / 2, H / 2, 80, "#ffffff");
  },
  // from Atari to PS5
  (ctx, t) => {
    ctx.fillStyle = BRAND;
    ctx.fillRect(0, 0, W, H);
    const k = Math.floor(t * 6) % 4;
    ctx.fillStyle = "#101010";
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 9; j++) if ((i + j + k) % 4 === 0) ctx.fillRect(i * 80, j * 80, 80, 80);
    }
    ctx.fillStyle = "#101010";
    ctx.fillRect(140, 250, W - 280, 220);
    bigText(ctx, "DO ATARI AO PS5", W / 2, H / 2, 132, BRAND);
  },
  // repair
  (ctx, t) => {
    ctx.fillStyle = "#06120c";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#1f6b3f";
    ctx.lineWidth = 6;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      const y = 30 + i * 40;
      ctx.moveTo(0, y);
      ctx.lineTo(300 + ((i * 97) % 400), y);
      ctx.lineTo(380 + ((i * 97) % 400), y + 40);
      ctx.lineTo(W, y + 40);
      ctx.stroke();
    }
    const p = (t * 0.6) % 1;
    ctx.fillStyle = "#7dffb0";
    for (let i = 0; i < 18; i++) {
      const x = ((p + i * 0.13) % 1) * W;
      ctx.fillRect(x, 26 + i * 40 + (x > 380 ? 40 : 0), 14, 10);
    }
    ctx.fillStyle = "#101010";
    ctx.fillRect(W / 2 - 300, H / 2 - 160, 600, 320);
    ctx.fillStyle = "#c0c0c0";
    for (let i = 0; i < 6; i++) ctx.fillRect(W / 2 - 280 + i * 100, H / 2 - 190, 40, 30);
    bigText(ctx, "CONSERTAMOS", W / 2, H / 2 - 40, 74, "#ffffff");
    bigText(ctx, "SEU VIDEOGAME", W / 2, H / 2 + 50, 74, BRAND);
  },
];

export class Reel {
  canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private start = performance.now();
  private lastDraw = 0;
  version = 0;
  scene = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext("2d")!;
    this.draw(0);
  }

  /** redraws at most ~30fps; returns true when the canvas changed */
  update(now: number) {
    if (now - this.lastDraw < 33) return false;
    this.lastDraw = now;
    this.draw(Math.max(0, now - this.start) / 1000);
    this.version++;
    return true;
  }

  private draw(time: number) {
    const ctx = this.ctx;
    const idx = ((Math.floor(time / SCENE_SECONDS) % scenes.length) + scenes.length) % scenes.length;
    this.scene = idx;
    const local = time % SCENE_SECONDS;
    ctx.save();
    scenes[idx](ctx, local + idx * 10);
    ctx.restore();
    // CRT scanlines + vignette
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
}

let shared: Reel | null = null;
export function getReel() {
  if (!shared) shared = new Reel();
  return shared;
}
