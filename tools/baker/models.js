// Procedural 3D models baked into motion-vector impostor sheets.
// Every builder returns a THREE.Group centred at the origin, face towards +Z.
// Meshes flagged with userData.screen = true end up in the "data" mask, where the
// runtime shader projects the reel (same role as the screen mask in the reference).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const BRAND = 0x3da9f4; // azul smurf

const mats = () => ({
  white: new THREE.MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.36, clearcoat: 0.4, clearcoatRoughness: 0.35 }),
  black: new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
  matteBlack: new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.72 }),
  glossBlack: new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 }),
  darkGray: new THREE.MeshPhysicalMaterial({ color: 0x2b2d31, roughness: 0.35, clearcoat: 0.6 }),
  gray: new THREE.MeshPhysicalMaterial({ color: 0x8d8f94, roughness: 0.45, clearcoat: 0.3 }),
  lightGray: new THREE.MeshPhysicalMaterial({ color: 0xc9cbce, roughness: 0.4, clearcoat: 0.3 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xe8eef4, metalness: 1, roughness: 0.16 }),
  blueChrome: new THREE.MeshStandardMaterial({ color: BRAND, metalness: 1, roughness: 0.2 }),
  blue: new THREE.MeshPhysicalMaterial({ color: BRAND, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  deepBlue: new THREE.MeshPhysicalMaterial({ color: 0x1f6fb8, roughness: 0.4, clearcoat: 0.4 }),
  blueGlow: new THREE.MeshStandardMaterial({ color: BRAND, emissive: BRAND, emissiveIntensity: 2.2 }),
  whiteGlow: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 }),
  red: new THREE.MeshPhysicalMaterial({ color: 0xd8262f, roughness: 0.3, clearcoat: 0.8 }),
  green: new THREE.MeshPhysicalMaterial({ color: 0x2fae4f, roughness: 0.3, clearcoat: 0.8 }),
  yellow: new THREE.MeshPhysicalMaterial({ color: 0xf2c418, roughness: 0.3, clearcoat: 0.8 }),
  orangeGlow: new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a00, emissiveIntensity: 1.4 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.55 }),
  screen: new THREE.MeshPhysicalMaterial({ color: 0x07090c, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }),
});

// ---------- helpers ----------
function mesh(geo, mat, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (opts.screen) m.userData.screen = true;
  return m;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// rounded rect with independent corner radii [tl, tr, br, bl]
function cornerRectShape(w, h, [tl, tr, br, bl]) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + bl, y);
  s.lineTo(x + w - br, y);
  s.absarc(x + w - br, y + br, br, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - tr);
  s.absarc(x + w - tr, y + h - tr, tr, 0, Math.PI / 2, false);
  s.lineTo(x + tl, y + h);
  s.absarc(x + tl, y + h - tl, tl, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + bl);
  s.absarc(x + bl, y + bl, bl, Math.PI, Math.PI * 1.5, false);
  return s;
}

// closed smooth outline from the right half (top centre -> bottom centre), mirrored
function mirroredShape(half, samples = 260) {
  const right = half.map(([x, y]) => new THREE.Vector3(x, y, 0));
  const left = half.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector3(-x, y, 0));
  const curve = new THREE.CatmullRomCurve3([...right, ...left], true, 'centripetal');
  return new THREE.Shape(curve.getPoints(samples).map((p) => new THREE.Vector2(p.x, p.y)));
}

function extrude(shape, depth, bevel = 0.02, segs = 6) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9,
    bevelSegments: segs, curveSegments: 48,
  });
  g.translate(0, 0, -depth / 2);
  return toCreasedNormals(g, THREE.MathUtils.degToRad(38));
}

// z of the top face of an extrusion made with extrude(depth, bevel)
const topZ = (depth, bevel) => depth / 2 + bevel;

function lathe(points, segs = 64) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  g.rotateX(Math.PI / 2); // axis Y -> Z
  return g;
}

function thumbstick(m, ringMat = m.blueChrome, capMat = m.black) {
  const g = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.06, 64).rotateX(Math.PI / 2), m.glossBlack);
  base.position.z = 0.0;
  const ring = mesh(new THREE.TorusGeometry(0.215, 0.018, 16, 80), ringMat);
  ring.position.z = 0.03;
  const stem = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 32).rotateX(Math.PI / 2), m.darkGray);
  stem.position.z = 0.09;
  // concave cap with a raised rim
  const cap = mesh(lathe([[0, 0.05], [0.09, 0.04], [0.15, 0.06], [0.175, 0.085], [0.18, 0.06], [0.17, 0.0], [0.12, -0.03], [0, -0.03]]), capMat);
  cap.position.z = 0.17;
  g.add(base, ring, stem, cap);
  return g;
}

function roundButton(r, h, mat) {
  const g = new THREE.Group();
  const b = mesh(lathe([[0, h], [r * 0.82, h], [r, h * 0.7], [r, 0], [0, 0]]), mat);
  g.add(b);
  return g;
}

function crossShape(len, w) {
  const s = new THREE.Shape();
  const a = w / 2, b = len / 2;
  s.moveTo(-a, b); s.lineTo(a, b); s.lineTo(a, a); s.lineTo(b, a); s.lineTo(b, -a); s.lineTo(a, -a);
  s.lineTo(a, -b); s.lineTo(-a, -b); s.lineTo(-a, -a); s.lineTo(-b, -a); s.lineTo(-b, a); s.lineTo(-a, a); s.lineTo(-a, b);
  return s;
}

function letterTexture(ch, fg = '#ffffff', bg = null) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, 256, 256); }
  x.fillStyle = fg; x.font = '700 150px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(ch, 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// tiny invader icon (used on guide/home buttons), drawn on a canvas
const INVADER = [
  '...X.....X...',
  '....X...X....',
  '..XXXXXXXXX..',
  '.XXXXXXXXXXX.',
  'XXX.XXXXX.XXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XX.XXXXXXX.XX',
  'XX.XX...XX.XX',
];
export const INVADER_GRID = INVADER;

function invaderTexture(fg = '#ffffff', bg = '#0a0a0a') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
  const px = 13, ox = (256 - 13 * px) / 2, oy = (256 - 9 * px) / 2;
  x.fillStyle = fg;
  INVADER.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') x.fillRect(ox + i * px, oy + j * px, px, px); }));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function symbolTexture(kind, fg = '#d9dde2', bg = '#07080a') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = fg; x.lineWidth = 16; x.lineJoin = 'round'; x.lineCap = 'round';
  x.beginPath();
  if (kind === 'triangle') { x.moveTo(128, 70); x.lineTo(186, 170); x.lineTo(70, 170); x.closePath(); }
  else if (kind === 'circle') { x.arc(128, 128, 56, 0, Math.PI * 2); }
  else if (kind === 'cross') { x.moveTo(82, 82); x.lineTo(174, 174); x.moveTo(174, 82); x.lineTo(82, 174); }
  else { x.rect(80, 80, 96, 96); }
  x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function capWithTexture(r, h, sideMat, tex, emissive = false) {
  const g = new THREE.Group();
  const side = mesh(new THREE.CylinderGeometry(r, r, h, 64, 1, true).rotateX(Math.PI / 2), sideMat);
  const topMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.2, clearcoat: 1, ...(emissive ? { emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.9 } : {}) });
  const top = mesh(new THREE.CircleGeometry(r, 64), topMat);
  top.position.z = h / 2;
  g.add(side, top);
  return g;
}

// ---------- models ----------

// PlayStation-style (DualSense-like) controller
function buildPlaystation() {
  const m = mats();
  const g = new THREE.Group();
  const depth = 0.3, bev = 0.15;
  const outline = mirroredShape([
    [0, 0.84], [0.7, 0.86], [1.15, 0.87], [1.45, 0.76], [1.63, 0.46], [1.7, 0.02], [1.7, -0.52],
    [1.62, -1.02], [1.44, -1.36], [1.16, -1.4], [0.94, -1.12], [0.8, -0.7], [0.55, -0.46], [0, -0.4],
  ]);
  g.add(mesh(extrude(outline, depth, bev, 10), m.white));
  const tz = topZ(depth, bev);

  const center = mirroredShape([[0, 0.8], [0.55, 0.81], [0.8, 0.7], [0.86, 0.25], [0.8, -0.25], [0.58, -0.42], [0, -0.36]]);
  const panel = mesh(extrude(center, 0.02, 0.012, 4), m.black);
  panel.position.z = tz - 0.004;
  g.add(panel);

  // touchpad (reel mask)
  const pad = mesh(extrude(roundedRectShape(1.08, 0.58, 0.08), 0.03, 0.012, 4), m.screen, { screen: true });
  pad.position.set(0, 0.47, tz + 0.03);
  g.add(pad);
  for (const sx of [-1, 1]) {
    const bar = mesh(extrude(roundedRectShape(0.035, 0.5, 0.017), 0.02, 0.006, 3), m.blueGlow);
    bar.position.set(sx * 0.6, 0.42, tz + 0.025); bar.rotation.z = sx * -0.12;
    g.add(bar);
    const opt = mesh(extrude(roundedRectShape(0.05, 0.13, 0.025), 0.03, 0.01, 3), m.darkGray);
    opt.position.set(sx * 0.7, 0.78, tz + 0.01); opt.rotation.z = sx * 0.35;
    g.add(opt);
  }

  for (const sx of [-1, 1]) {
    const st = thumbstick(m);
    st.position.set(sx * 0.48, -0.1, tz + 0.02);
    g.add(st);
  }

  // d-pad
  const dpad = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Shape();
    s.moveTo(-0.075, 0.06); s.lineTo(0.075, 0.06); s.lineTo(0.075, 0.26); s.lineTo(-0.075, 0.26); s.lineTo(-0.075, 0.06);
    s.moveTo(-0.075, 0.06);
    const sh = new THREE.Shape([new THREE.Vector2(0, 0.03), new THREE.Vector2(0.075, 0.1), new THREE.Vector2(0.075, 0.27), new THREE.Vector2(-0.075, 0.27), new THREE.Vector2(-0.075, 0.1)]);
    const b = mesh(extrude(sh, 0.05, 0.018, 4), m.darkGray);
    b.rotation.z = (i * Math.PI) / 2;
    dpad.add(b);
  }
  dpad.position.set(-1.07, 0.3, tz + 0.03);
  g.add(dpad);

  // face buttons with symbols
  const fb = new THREE.Group();
  const kinds = ['triangle', 'circle', 'cross', 'square'];
  const pos = [[0, 0.25], [0.25, 0], [0, -0.25], [-0.25, 0]];
  pos.forEach(([x, y], i) => {
    const b = capWithTexture(0.112, 0.07, m.glossBlack, symbolTexture(kinds[i]));
    b.position.set(x, y, 0.035);
    fb.add(b);
  });
  fb.position.set(1.07, 0.3, tz);
  g.add(fb);

  // home button (invader) + mic
  const home = capWithTexture(0.075, 0.05, m.blueChrome, invaderTexture('#7cc8ff', '#06080b'), true);
  home.position.set(0, -0.2, tz + 0.03);
  g.add(home);
  const mic = mesh(extrude(roundedRectShape(0.16, 0.035, 0.017), 0.02, 0.006, 3), m.blueGlow);
  mic.position.set(0, -0.32, tz + 0.01);
  g.add(mic);

  // shoulder buttons
  for (const sx of [-1, 1]) {
    const l1 = mesh(new RoundedBoxGeometry(0.62, 0.16, 0.26, 4, 0.07), m.black);
    l1.position.set(sx * 1.12, 0.9, -0.02); l1.rotation.z = sx * -0.12;
    g.add(l1);
  }
  return g;
}

// Xbox-style controller
function buildXbox() {
  const m = mats();
  const g = new THREE.Group();
  const depth = 0.3, bev = 0.16;
  const outline = mirroredShape([
    [0, 0.74], [0.5, 0.79], [1.05, 0.88], [1.43, 0.78], [1.66, 0.42], [1.77, -0.12], [1.72, -0.62],
    [1.54, -1.04], [1.28, -1.2], [1.04, -1.06], [0.84, -0.74], [0.6, -0.52], [0, -0.5],
  ]);
  g.add(mesh(extrude(outline, depth, bev, 10), m.matteBlack));
  const tz = topZ(depth, bev);

  // blue chrome trim line around the face
  const trimShape = mirroredShape([[0, 0.66], [0.5, 0.71], [1.02, 0.79], [1.36, 0.7], [1.56, 0.38], [1.66, -0.1], [1.62, -0.58], [1.46, -0.96], [1.27, -1.1], [1.07, -0.98], [0.88, -0.68], [0.62, -0.46], [0, -0.44]]);
  const trimOuter = trimShape;
  const trim = mesh(extrude(trimOuter, 0.004, 0.004, 2), m.black);
  trim.position.z = tz - 0.006;
  g.add(trim);

  const ls = thumbstick(m); ls.position.set(-0.82, 0.3, tz); g.add(ls);
  const rs = thumbstick(m); rs.position.set(0.42, -0.3, tz); g.add(rs);

  const dpadBase = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 64).rotateX(Math.PI / 2), m.glossBlack);
  dpadBase.position.set(-0.42, -0.3, tz + 0.01);
  const dp = mesh(extrude(crossShape(0.36, 0.11), 0.05, 0.018, 4), m.darkGray);
  dp.position.set(-0.42, -0.3, tz + 0.05);
  g.add(dpadBase, dp);

  const colors = [['Y', m.yellow, '#f2c418', [0, 0.21]], ['B', m.red, '#e0373f', [0.21, 0]], ['A', m.green, '#36c25b', [0, -0.21]], ['X', m.deepBlue, '#3d8fe6', [-0.21, 0]]];
  for (const [ch, , col, [x, y]] of colors) {
    const b = capWithTexture(0.1, 0.08, m.glossBlack, letterTexture(ch, col, '#08090a'), true);
    b.position.set(0.88 + x, 0.3 + y, tz + 0.04);
    g.add(b);
  }

  const guide = capWithTexture(0.13, 0.06, m.chrome, invaderTexture('#ffffff', '#0b0c0e'), true);
  guide.position.set(0, 0.56, tz + 0.03);
  g.add(guide);
  const glowRing = mesh(new THREE.TorusGeometry(0.135, 0.012, 12, 80), m.whiteGlow);
  glowRing.position.set(0, 0.56, tz + 0.06);
  g.add(glowRing);
  for (const sx of [-1, 1]) {
    const b = roundButton(0.05, 0.04, m.darkGray); b.position.set(sx * 0.27, 0.3, tz); g.add(b);
    const lb = mesh(new RoundedBoxGeometry(0.7, 0.15, 0.26, 4, 0.07), m.black);
    lb.position.set(sx * 1.12, 0.88, -0.02); lb.rotation.z = sx * -0.16;
    g.add(lb);
  }
  const share = mesh(extrude(roundedRectShape(0.09, 0.05, 0.02), 0.02, 0.008, 3), m.darkGray);
  share.position.set(0, 0.24, tz + 0.01);
  g.add(share);
  return g;
}

// Nintendo Switch-style console (screen = reel mask)
function buildSwitch() {
  const m = mats();
  const g = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(2.1, 1.26, 0.15, 6, 0.05), m.black);
  g.add(body);
  const screen = mesh(extrude(roundedRectShape(1.86, 1.06, 0.03), 0.004, 0.002, 2), m.screen, { screen: true });
  screen.position.z = 0.078;
  g.add(screen);

  const jcW = 0.44, jcH = 1.26;
  const left = mesh(extrude(cornerRectShape(jcW, jcH, [0.22, 0.02, 0.02, 0.22]), 0.12, 0.018, 5), m.blue);
  left.position.x = -1.05 - jcW / 2 - 0.005;
  const right = mesh(extrude(cornerRectShape(jcW, jcH, [0.02, 0.22, 0.22, 0.02]), 0.12, 0.018, 5), m.blue);
  right.position.x = 1.05 + jcW / 2 + 0.005;
  g.add(left, right);
  const jz = 0.06 + 0.018;
  const small = (x, y, s = 0.4) => {
    const st = thumbstick(m, m.blueChrome, m.black); st.scale.setScalar(s); st.position.set(x, y, jz); return st;
  };
  const lx = left.position.x, rx = right.position.x;
  g.add(small(lx + 0.02, 0.3), small(rx - 0.02, -0.12));
  const diamond = (cx, cy, mat) => {
    for (const [x, y] of [[0, 0.1], [0.1, 0], [0, -0.1], [-0.1, 0]]) {
      const b = roundButton(0.045, 0.03, mat); b.position.set(cx + x, cy + y, jz); g.add(b);
    }
  };
  diamond(lx + 0.02, -0.14, m.darkGray);
  diamond(rx - 0.02, 0.3, m.darkGray);
  const minus = mesh(new RoundedBoxGeometry(0.07, 0.02, 0.02, 2, 0.008), m.darkGray);
  minus.position.set(lx + 0.15, 0.53, jz + 0.01);
  const plusA = mesh(new RoundedBoxGeometry(0.07, 0.02, 0.02, 2, 0.008), m.darkGray);
  const plusB = plusA.clone(); plusB.rotation.z = Math.PI / 2;
  const plus = new THREE.Group(); plus.add(plusA, plusB); plus.position.set(rx - 0.15, 0.53, jz + 0.01);
  const cap = mesh(new RoundedBoxGeometry(0.07, 0.07, 0.03, 2, 0.012), m.darkGray);
  cap.position.set(lx + 0.06, -0.42, jz);
  const home = capWithTexture(0.045, 0.03, m.blueChrome, invaderTexture('#7cc8ff', '#06080b'), true);
  home.position.set(rx - 0.06, -0.42, jz);
  g.add(minus, plus, cap, home);
  // kickstand hint + vents on top
  for (let i = 0; i < 10; i++) {
    const v = mesh(new THREE.BoxGeometry(0.06, 0.01, 0.03), m.darkGray);
    v.position.set(0.3 + i * 0.07, 0.635, 0);
    g.add(v);
  }
  return g;
}

// RetroGamers invader logo: voxel extrusion, white front, blue sides
function buildLogo() {
  const m = mats();
  const g = new THREE.Group();
  const px = 0.2, depth = 0.42;
  const white = new THREE.MeshPhysicalMaterial({ color: 0xe9edf2, roughness: 0.34, clearcoat: 0.45, clearcoatRoughness: 0.25 });
  const side = new THREE.MeshPhysicalMaterial({ color: 0x2f8fd8, roughness: 0.35, clearcoat: 0.5 });
  const inner = new THREE.MeshPhysicalMaterial({ color: 0x1d5f99, roughness: 0.5 });
  const matsFull = [side, side, side, side, white, side];
  const cols = INVADER[0].length, rows = INVADER.length;
  INVADER.forEach((row, j) => [...row].forEach((ch, i) => {
    const x = (i - (cols - 1) / 2) * px, y = ((rows - 1) / 2 - j) * px;
    if (ch === 'X') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(px, px, depth), matsFull);
      b.position.set(x, y, 0);
      g.add(b);
    } else if (ch === '.' && j === 4 && (i === 3 || i === 9)) {
      // recessed eye: shallow block at the back plus a tiny pupil
      const b = new THREE.Mesh(new THREE.BoxGeometry(px, px, depth * 0.45), [inner, inner, inner, inner, inner, inner]);
      b.position.set(x, y, -depth * 0.275);
      const p = new THREE.Mesh(new THREE.BoxGeometry(px * 0.38, px * 0.38, 0.02), m.glossBlack);
      p.position.set(x, y, -depth * 0.05 + 0.01);
      g.add(b, p);
    }
  }));
  return g;
}

// Game Boy-like handheld (screen = reel mask)
function buildHandheld() {
  const m = mats();
  const g = new THREE.Group();
  const body = mesh(extrude(cornerRectShape(1.5, 2.4, [0.08, 0.08, 0.42, 0.08]), 0.32, 0.06, 6), m.lightGray);
  g.add(body);
  const tz = topZ(0.32, 0.06);
  const bezel = mesh(extrude(cornerRectShape(1.26, 1.0, [0.05, 0.05, 0.2, 0.05]), 0.02, 0.01, 3), m.darkGray);
  bezel.position.set(0, 0.55, tz);
  const scr = mesh(extrude(roundedRectShape(0.86, 0.74, 0.02), 0.01, 0.004, 2), m.screen, { screen: true });
  scr.position.set(0.02, 0.56, tz + 0.02);
  const led = mesh(new THREE.SphereGeometry(0.025, 16, 16), m.blueGlow);
  led.position.set(-0.53, 0.66, tz + 0.02);
  g.add(bezel, scr, led);
  const dp = mesh(extrude(crossShape(0.42, 0.13), 0.06, 0.02, 4), m.glossBlack);
  dp.position.set(-0.38, -0.42, tz + 0.02);
  g.add(dp);
  for (const [x, y] of [[0.48, -0.32], [0.22, -0.48]]) {
    const b = roundButton(0.11, 0.07, m.blue); b.position.set(x, y, tz); g.add(b);
  }
  for (const x of [-0.18, 0.12]) {
    const b = mesh(extrude(roundedRectShape(0.2, 0.05, 0.025), 0.02, 0.01, 3), m.gray);
    b.position.set(x, -0.84, tz + 0.01); b.rotation.z = 0.45; g.add(b);
  }
  for (let i = 0; i < 6; i++) {
    const s = mesh(extrude(roundedRectShape(0.035, 0.26, 0.017), 0.02, 0.008, 2), m.darkGray);
    s.position.set(0.42 + i * 0.07, -0.98 + i * 0.0, tz - 0.01); s.rotation.z = 0.5; g.add(s);
  }
  return g;
}

// Game cartridge (label = reel mask)
function buildCartridge() {
  const m = mats();
  const g = new THREE.Group();
  const body = mesh(extrude(cornerRectShape(1.7, 2.0, [0.06, 0.18, 0.06, 0.06]), 0.28, 0.04, 5), m.gray);
  g.add(body);
  const tz = topZ(0.28, 0.04);
  const label = mesh(extrude(roundedRectShape(1.3, 1.15, 0.04), 0.01, 0.004, 2), m.screen, { screen: true });
  label.position.set(0, 0.2, tz + 0.005);
  g.add(label);
  for (let i = 0; i < 7; i++) {
    const r = mesh(new RoundedBoxGeometry(1.3, 0.035, 0.02, 2, 0.01), m.darkGray);
    r.position.set(0, -0.62 - i * 0.055, tz); g.add(r);
  }
  const notch = mesh(new RoundedBoxGeometry(0.5, 0.12, 0.05, 2, 0.02), m.blueChrome);
  notch.position.set(0, 0.9, tz - 0.01);
  g.add(notch);
  return g;
}

// Atari-style joystick
function buildJoystick() {
  const m = mats();
  const g = new THREE.Group();
  const base = mesh(new RoundedBoxGeometry(1.6, 1.6, 0.42, 6, 0.1), m.black);
  g.add(base);
  const plate = mesh(new RoundedBoxGeometry(1.38, 1.38, 0.05, 4, 0.04), m.blueChrome);
  plate.position.z = 0.2;
  g.add(plate);
  const boot = mesh(lathe([[0.36, 0], [0.32, 0.1], [0.2, 0.2], [0.12, 0.26], [0.09, 0.3], [0, 0.3]]), m.matteBlack);
  boot.position.z = 0.22;
  const stick = mesh(new THREE.CylinderGeometry(0.075, 0.085, 1.1, 32).rotateX(Math.PI / 2), m.black);
  stick.position.z = 0.75;
  const knob = mesh(new THREE.SphereGeometry(0.12, 32, 24), m.black);
  knob.position.z = 1.3;
  g.add(boot, stick, knob);
  const btn = roundButton(0.17, 0.09, m.red); btn.position.set(-0.52, 0.52, 0.22); g.add(btn);
  g.rotation.x = 0; // stick points to camera; tilted by orientation
  return g;
}

// CRT TV (screen = reel mask)
function buildCRT() {
  const m = mats();
  const g = new THREE.Group();
  const shell = mesh(new RoundedBoxGeometry(2.3, 1.85, 1.3, 8, 0.18), m.lightGray);
  shell.position.z = -0.3;
  g.add(shell);
  const back = mesh(new RoundedBoxGeometry(1.5, 1.2, 0.9, 6, 0.2), m.gray);
  back.position.z = -1.1;
  g.add(back);
  const bezel = mesh(extrude(roundedRectShape(1.72, 1.36, 0.22), 0.06, 0.03, 4), m.darkGray);
  bezel.position.set(-0.18, 0, 0.38);
  // slightly bulged screen
  const sg = new THREE.PlaneGeometry(1.5, 1.16, 32, 32);
  const p = sg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, 0.07 - (x * x + y * y) * 0.05);
  }
  sg.computeVertexNormals();
  const scr = mesh(sg, m.screen, { screen: true });
  scr.position.set(-0.18, 0, 0.42);
  g.add(bezel, scr);
  for (let i = 0; i < 2; i++) {
    const k = roundButton(0.08, 0.06, m.blueChrome); k.position.set(0.88, 0.35 - i * 0.28, 0.35); g.add(k);
  }
  for (let i = 0; i < 6; i++) {
    const v = mesh(new THREE.BoxGeometry(0.18, 0.025, 0.02), m.darkGray);
    v.position.set(0.88, -0.2 - i * 0.07, 0.36); g.add(v);
  }
  const led = mesh(new THREE.SphereGeometry(0.025, 16, 16), m.blueGlow); led.position.set(0.88, -0.66, 0.36); g.add(led);
  return g;
}

// Gaming headset
function buildHeadset() {
  const m = mats();
  const g = new THREE.Group();
  const band = new THREE.TorusGeometry(1.0, 0.09, 24, 96, Math.PI);
  const b = mesh(band, m.black); b.position.y = 0.05; g.add(b);
  const band2 = mesh(new THREE.TorusGeometry(1.0, 0.03, 12, 96, Math.PI), m.blueChrome);
  band2.position.set(0, 0.05, 0.09); g.add(band2);
  for (const sx of [-1, 1]) {
    const cup = mesh(new RoundedBoxGeometry(0.55, 0.85, 0.42, 6, 0.2), m.black);
    cup.position.set(sx * 1.0, -0.42, 0); g.add(cup);
    const ring = mesh(new THREE.TorusGeometry(0.2, 0.03, 16, 64), m.blueGlow);
    ring.scale.set(1, 1.45, 1);
    ring.position.set(sx * 1.0, -0.42, 0.22); ring.rotation.y = 0; g.add(ring);
    const plate = mesh(new THREE.CircleGeometry(0.17, 48), m.chrome);
    plate.scale.set(1, 1.45, 1); plate.position.set(sx * 1.0, -0.42, 0.215); g.add(plate);
    const pad = mesh(new RoundedBoxGeometry(0.5, 0.8, 0.16, 4, 0.07), m.darkGray);
    pad.position.set(sx * 1.0, -0.42, -0.25); g.add(pad);
  }
  const mic = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.0, -0.65, 0.15), new THREE.Vector3(-0.85, -0.95, 0.45), new THREE.Vector3(-0.45, -1.05, 0.6)]), 32, 0.03, 12), m.black);
  const micTip = mesh(new THREE.SphereGeometry(0.07, 24, 16), m.blueGlow); micTip.position.set(-0.45, -1.05, 0.6);
  g.add(mic, micTip);
  return g;
}

// view settings per model: base orientation + yaw sweep (degrees)
export const MODELS = {
  playstation: { build: buildPlaystation, pitch: -48, roll: 0, yaw: [-32, 32], fill: 0.94 },
  switch: { build: buildSwitch, pitch: -14, roll: 0, yaw: [-30, 30], fill: 0.94 },
  xbox: { build: buildXbox, pitch: -48, roll: 0, yaw: [-32, 32], fill: 0.94 },
  logo: { build: buildLogo, pitch: -8, roll: 0, yaw: [-34, 34], fill: 0.94 },
  handheld: { build: buildHandheld, pitch: -10, roll: -6, yaw: [-30, 30], fill: 0.94 },
  cartridge: { build: buildCartridge, pitch: -12, roll: 6, yaw: [-34, 34], fill: 0.94 },
  joystick: { build: buildJoystick, pitch: -62, roll: 0, yaw: [-34, 34], fill: 0.94 },
  crt: { build: buildCRT, pitch: -8, roll: 0, yaw: [-30, 30], fill: 0.94 },
  headset: { build: buildHeadset, pitch: -6, roll: 0, yaw: [-30, 30], fill: 0.94 },
};
