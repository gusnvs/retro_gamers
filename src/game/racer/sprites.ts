// Original pixel-art icons for the Retro Smash Racer props (Retro Gamers'
// own characters and generic retro objects — no third-party characters or logos).
import * as THREE from "three";

export const SPRITES = {
  invader: [
    "..X.....X..",
    "...X...X...",
    "..XXXXXXX..",
    ".XX.XXX.XX.",
    "XXXXXXXXXXX",
    "X.XXXXXXX.X",
    "X.X.....X.X",
    "...XX.XX...",
  ],
  gamepad: [
    "..XXXXXXXXX..",
    ".XXXXXXXXXXX.",
    "XX.XXXXXXX.XX",
    "X...XXXXX.X.X",
    "XX.XXXXXX..XX",
    "XXXXXX.XXXXXX",
    "XXXX.....XXXX",
    ".XX.......XX.",
  ],
  cartridge: [
    "XXXXXXXXX",
    "X.......X",
    "X.XXXXX.X",
    "X.X...X.X",
    "X.XXXXX.X",
    "X.......X",
    "XXXXXXXXX",
    ".X.X.X.X.",
  ],
  console: [
    ".XXXXXXXXXXX.",
    "XX.........XX",
    "X..XXX.XXX..X",
    "X...........X",
    "X.XX.....XX.X",
    "XX.........XX",
    ".XXXXXXXXXXX.",
  ],
  joystick: [
    "....XXX....",
    "....XXX....",
    ".....X.....",
    ".....X.....",
    "..XXXXXXX..",
    ".XX.XXXXXX.",
    ".XXXXXXXXX.",
  ],
  coin: [
    "..XXXX..",
    ".X....X.",
    "X..XX..X",
    "X.X..X.X",
    "X..XX..X",
    "X.X..X.X",
    ".X....X.",
    "..XXXX..",
  ],
  heart: [
    ".XX.XX.",
    "XXXXXXX",
    "XXXXXXX",
    ".XXXXX.",
    "..XXX..",
    "...X...",
  ],
} as const;

export type SpriteName = keyof typeof SPRITES;

/** square canvas texture: background colour + centred pixel sprite (+ optional border) */
export function spriteTexture(name: SpriteName, bg: string, fg: string, size = 128, border?: string) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = size * 0.06;
    ctx.strokeRect(size * 0.03, size * 0.03, size * 0.94, size * 0.94);
  }
  const rows = SPRITES[name];
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const px = Math.floor((size * 0.62) / Math.max(w, h));
  const ox = Math.round((size - w * px) / 2), oy = Math.round((size - h * px) / 2);
  ctx.fillStyle = fg;
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === "X") ctx.fillRect(ox + i * px, oy + j * px, px, px);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.anisotropy = 4;
  return t;
}
