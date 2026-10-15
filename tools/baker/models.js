// Procedural 3D models baked into motion-vector impostor sheets.
// Every builder returns a THREE.Group centred at the origin, face towards +Z.
// Meshes flagged with userData.screen = true end up in the "data" mask, where the
// runtime shader projects the reel (same role as the screen mask in the reference).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  clamp, smoothstep, smin, smax, sdRoundBox, sdSphere, sdCylZ, sdRoundCone, sdRoundRect, roundedExtrusion,
  polygonSDF, shapePoints, morphSDF, meshSDF, surfaceAt, placeOn,
} from './sdf.js';

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

// ---------- hero-quality parts ----------

// object-space micro texture: roughness variation + derivative bump (stable across frames)
const GRAIN_GLSL = /* glsl */`
varying vec3 vGPos;
uniform float uGScale, uGBump, uGRough;
float gHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 gPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;
function grained(mat, { scale = 140, bump = 0.0004, rough = 0.18 } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uGScale: { value: scale }, uGBump: { value: bump }, uGRough: { value: rough } });
    sh.vertexShader = 'varying vec3 vGPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGPos = position;');
    sh.fragmentShader = GRAIN_GLSL + sh.fragmentShader
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float gN = gNoise(vGPos * uGScale) * 0.65 + gNoise(vGPos * uGScale * 2.9) * 0.35;
        roughnessFactor = clamp(roughnessFactor * (1.0 + (gN - 0.5) * 2.0 * uGRough), 0.02, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = gPerturb(-vViewPosition, normal, vec2(dFdx(gN), dFdy(gN)) * uGBump * 400.0, faceDirection);`);
  };
  mat.customProgramCacheKey = () => `grain-${scale}-${bump}-${rough}`;
  return mat;
}

const heroMats = () => ({
  ...mats(),
  satinBlack: grained(new THREE.MeshPhysicalMaterial({ color: 0x121316, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }), { bump: 0.00025, rough: 0.2 }),
  rubber: grained(new THREE.MeshPhysicalMaterial({ color: 0x18191c, roughness: 0.62, sheen: 0.4, sheenRoughness: 0.6, sheenColor: 0x50555e }), { scale: 260, bump: 0.0007, rough: 0.25 }),
  btnBlack: new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 }),
  btnGray: new THREE.MeshPhysicalMaterial({ color: 0x2c2f35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 }),
  blueChrome: new THREE.MeshPhysicalMaterial({ color: 0x4fb4f7, metalness: 1, roughness: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.08 }),
  chrome: new THREE.MeshPhysicalMaterial({ color: 0xe6ebf0, metalness: 1, roughness: 0.1, clearcoat: 0.4 }),
});

// lathe around +Z; profile [[r, z], ...] goes from the bottom axis outwards, up, and back to the top axis
function latheZ(profile, segs = 72) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

// spherical cap of base radius r and height h with planar (top-view) UVs, base at z = 0
function domeCap(r, h, segs = 64) {
  const R = (r * r + h * h) / (2 * h);
  const g = new THREE.SphereGeometry(R, segs, 16, 0, Math.PI * 2, 0, Math.asin(Math.min(1, r / R)));
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -(R - h));
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * r), 0.5 + p.getY(i) / (2 * r));
  return g;
}

function decalMat(tex, { color = 0xffffff, rough = 0.18, glow = 0 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    map: tex, color, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.05,
    ...(glow ? { emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow } : {}),
  });
}

// cylindrical button with a rounded rim and a slightly domed, printed top; sits in a hole, top at z = top
function capButton(r, tex, sideMat, { top = 0.022, dome = 0.01, glow = 0, depth = 0.07 } = {}) {
  const g = new THREE.Group();
  const e = Math.min(0.014, r * 0.2);
  g.add(mesh(latheZ([[0, -depth], [r, -depth], [r, top - dome - e], [r - e * 0.3, top - dome - e * 0.3], [r - e, top - dome], [0, top - dome]]), sideMat));
  const cap = mesh(domeCap(r - e, dome), tex ? decalMat(tex, { glow }) : sideMat);
  cap.position.z = top - dome - 0.0004;
  g.add(cap);
  return g;
}

// analog stick: dome in the well, shaft, concave rubber cap with a grippy rim, optional chrome ring
function stick(m, { ring = m.blueChrome, scale = 1, well = 0.237 } = {}) {
  const g = new THREE.Group();
  const dome = mesh(new THREE.SphereGeometry(0.2, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), m.btnBlack);
  dome.position.z = -0.085;
  const shaft = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 40).rotateX(Math.PI / 2), m.satinBlack);
  shaft.position.z = 0.06;
  const cap = mesh(latheZ([[0, 0.1], [0.11, 0.1], [0.155, 0.112], [0.174, 0.135], [0.18, 0.165], [0.172, 0.19], [0.155, 0.198], [0.135, 0.192], [0.08, 0.178], [0, 0.174]], 96), m.rubber);
  // grip ridges around the cap edge
  const ridges = new THREE.Group();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rb = mesh(new THREE.BoxGeometry(0.008, 0.012, 0.05), m.rubber);
    rb.position.set(Math.cos(a) * 0.179, Math.sin(a) * 0.179, 0.15);
    rb.rotation.z = a;
    ridges.add(rb);
  }
  g.add(dome, shaft, cap, ridges);
  if (ring) {
    const t = mesh(new THREE.TorusGeometry(well - 0.004, 0.011, 20, 120), ring);
    t.position.z = -0.006;
    g.add(t);
  }
  g.scale.setScalar(scale);
  return g;
}

function pill(w, h, d, mat, r = Math.min(w, h) / 2 - 0.001) {
  return mesh(new RoundedBoxGeometry(w, h, d, 6, r), mat);
}

const rot2 = (x, y, a) => [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)];

// carving helpers: every cut is a signed distance of the removed volume
const holeCyl = (cx, cy, zt, r, depth = 0.08) => (x, y, z) => sdCylZ(x - cx, y - cy, z - zt, r, depth);
const holeBox = (cx, cy, zt, bx, by, rr, a = 0, depth = 0.08) => (x, y, z) => { const [lx, ly] = rot2(x - cx, y - cy, a); return sdRoundBox(lx, ly, z - zt, bx, by, depth, rr); };
const holeWell = (cx, cy, zt, rTop, depth) => { const R = (rTop * rTop + depth * depth) / (2 * depth); return (x, y, z) => sdSphere(x - cx, y - cy, z - (zt + R - depth), R); };
function carve(base, cuts, k = 0.006) {
  return (x, y, z) => {
    let d = base(x, y, z);
    if (d > 0.08) return d;
    for (const c of cuts) d = smax(d, -c(x, y, z), k);
    return d;
  };
}
// parting line between top and bottom shells
const seam = (d, z, zs, w = 0.0065, depth = 0.016) => Math.max(d, -Math.max(Math.abs(z - zs) - w, -d - depth));
const seamCut = (f, zs) => (x, y, z) => seam(f(x, y, z), z, zs(x, y));

// controller shell: rounded extrusion of the outline that thickens and droops into tubular grips
function controllerBase(outlinePts, { grip, gripCone, halfT = 0.26, gripT = 0.05, droop = 0.15, crown = 0.03 }) {
  const dOut = polygonSDF(shapePoints(mirroredShape(outlinePts), 420), 0.005, 0.5);
  const gf = (x, y) => smoothstep(grip[0], grip[1], y) * smoothstep(grip[2], grip[3], Math.abs(x));
  const midZ = (x, y) => -droop * gf(x, y);
  const crownF = (x, y) => crown * Math.max(0, 1 - (x * x) / 2.4 - ((y - 0.2) * (y - 0.2)) / 1.3);
  const base = (x, y, z) => {
    const g = gf(x, y), c = crownF(x, y);
    const t = halfT + gripT * g;
    let d = roundedExtrusion(dOut(x, y), z - midZ(x, y) - c / 2, t + c / 2, 0.2 + 0.07 * g);
    d = smin(d, sdRoundCone(Math.abs(x), y, z, ...gripCone), 0.22);
    return d;
  };
  return { base, midZ, zAt: (x, y) => surfaceAt(base, x, y).z };
}

function meshPart(f, bmin, bmax, step, mat, opts) {
  return mesh(meshSDF(f, bmin, bmax, step), mat, opts);
}

// ---------- models ----------

// PlayStation-style (DualSense-like) controller
const PS_OUTLINE = [
  [0, 0.84], [0.7, 0.86], [1.15, 0.87], [1.45, 0.76], [1.63, 0.46], [1.7, 0.02], [1.7, -0.52],
  [1.62, -1.02], [1.44, -1.36], [1.16, -1.4], [0.94, -1.12], [0.8, -0.7], [0.55, -0.46], [0, -0.4],
];
function buildPlaystation() {
  const m = heroMats();
  const g = new THREE.Group();
  const white = grained(new THREE.MeshPhysicalMaterial({ color: 0xf3f3f0, roughness: 0.44, clearcoat: 0.3, clearcoatRoughness: 0.42 }), { bump: 0.0002, rough: 0.15 });
  const { base, midZ, zAt } = controllerBase(PS_OUTLINE, {
    grip: [-0.05, -1.0, 0.55, 1.05], gripCone: [[1.3, -0.32, -0.06], [1.27, -1.1, -0.22], 0.32, 0.285],
  });

  const STICKS = [[-0.48, -0.1], [0.48, -0.1]];
  const FB = [1.07, 0.3], FB_OFF = [[0, 0.25], [0.25, 0], [0, -0.25], [-0.25, 0]];
  const DP = [-1.07, 0.3];
  const OPT = [[-0.7, 0.78, -0.35], [0.7, 0.78, 0.35]];
  const TP = [0, 0.47, 0.54, 0.29, 0.08];
  const cuts = [];
  for (const [sx, sy] of STICKS) cuts.push(holeWell(sx, sy, zAt(sx, sy), 0.237, 0.06));
  for (const [ox, oy] of FB_OFF) { const cx = FB[0] + ox, cy = FB[1] + oy; cuts.push(holeCyl(cx, cy, zAt(cx, cy), 0.124)); }
  {
    const zt = zAt(...DP);
    cuts.push((x, y, z) => Math.min(sdRoundBox(x - DP[0], y - DP[1], z - zt, 0.29, 0.088, 0.045, 0.02), sdRoundBox(x - DP[0], y - DP[1], z - zt, 0.088, 0.29, 0.045, 0.02)));
  }
  cuts.push(holeCyl(0, -0.2, zAt(0, -0.2), 0.088));
  cuts.push(holeBox(0, -0.32, zAt(0, -0.32), 0.088, 0.024, 0.02));
  for (const [ox, oy, a] of OPT) cuts.push(holeBox(ox, oy, zAt(ox, oy), 0.032, 0.072, 0.03, a));
  // speaker grille between the sticks
  {
    const zt = zAt(0, 0.05), sp = 0.042;
    cuts.push((x, y, z) => {
      const ix = clamp(Math.round(x / sp), -3, 3), iy = clamp(Math.round((y - 0.05) / sp), -1, 1);
      return sdCylZ(x - ix * sp, y - 0.05 - iy * sp, z - zt, 0.0115, 0.05);
    });
  }
  const carved = carve(base, cuts);
  const zs = (x, y) => midZ(x, y) - 0.04;

  const dPanel = polygonSDF(shapePoints(mirroredShape([[0, 0.8], [0.55, 0.81], [0.8, 0.7], [0.86, 0.25], [0.8, -0.25], [0.64, -0.56], [0, -0.66]]), 300), 0.005, 0.3);
  const ztp = zAt(TP[0], TP[1]);
  const tpd = (x, y) => sdRoundRect(x - TP[0], y - TP[1], TP[2], TP[3], TP[4]);
  // the black centre is a separate skin following the surface, split from the white shell by a gap
  const shellF = (x, y, z) => { const c = carved(x, y, z); const zsv = zs(x, y); return smax(seam(c, z, zsv), -Math.max(dPanel(x, y) - 0.013, -c - 0.05, zsv - z), 0.005); };
  const panelF = (x, y, z) => {
    const c = carved(x, y, z);
    let p = Math.max(smax(c + 0.005, dPanel(x, y), 0.008), -c - 0.07);
    p = smax(p, zs(x, y) + 0.0065 - z, 0.004); // ends at the parting line
    return smax(p, -Math.max(tpd(x, y) - 0.011, ztp - 0.05 - z), 0.004);
  };
  const touchF = (x, y, z) => Math.max(smax(base(x, y, z) + 0.007, tpd(x, y), 0.014), ztp - 0.07 - z);

  g.add(meshPart(shellF, [-1.8, -1.5, -0.62], [1.8, 0.95, 0.42], 0.0095, white));
  g.add(meshPart(panelF, [-0.92, -0.72, -0.2], [0.92, 0.86, 0.38], 0.0055, m.satinBlack));
  g.add(meshPart(touchF, [-0.6, 0.14, ztp - 0.09], [0.6, 0.8, ztp + 0.03], 0.005, m.screen, { screen: true }));

  // light bars beside the touchpad
  for (const sx of [-1, 1]) {
    const bar = pill(0.026, 0.46, 0.03, m.blueGlow);
    placeOn(panelF, bar, sx * 0.6, 0.45, -0.008, 0.5);
    bar.rotateZ(sx * -0.1);
    g.add(bar);
  }
  for (const [sx, sy] of STICKS) g.add(placeOn(base, stick(m), sx, sy, 0, 0.7));

  const kinds = ['triangle', 'circle', 'cross', 'square'];
  FB_OFF.forEach(([ox, oy], i) => {
    const b = capButton(0.11, symbolTexture(kinds[i], '#cfd5dc', '#0d0e11'), m.btnBlack);
    g.add(placeOn(base, b, FB[0] + ox, FB[1] + oy, 0, 0.6));
  });
  for (let i = 0; i < 4; i++) {
    const sh = new THREE.Shape([new THREE.Vector2(0, 0.035), new THREE.Vector2(0.074, 0.1), new THREE.Vector2(0.074, 0.27), new THREE.Vector2(-0.074, 0.27), new THREE.Vector2(-0.074, 0.1)]);
    const arrow = mesh(extrude(sh, 0.05, 0.016, 5), m.btnGray);
    arrow.rotation.z = (i * Math.PI) / 2;
    arrow.position.z = -0.026;
    const holder = new THREE.Group(); holder.add(arrow);
    g.add(placeOn(base, holder, DP[0], DP[1], 0, 0.6));
  }
  g.add(placeOn(base, capButton(0.078, invaderTexture('#7cc8ff', '#06080b'), m.blueChrome, { top: 0.014, dome: 0.008, glow: 0.9 }), 0, -0.2, 0, 0.6));
  const mute = pill(0.15, 0.03, 0.05, m.blueGlow);
  g.add(placeOn(base, mute, 0, -0.32, -0.022, 0.6));
  for (const [ox, oy, a] of OPT) {
    const o = pill(0.05, 0.13, 0.07, m.btnGray);
    placeOn(base, o, ox, oy, -0.028, 0.6); o.rotateZ(a);
    g.add(o);
  }
  // shoulder buttons and triggers
  for (const sx of [-1, 1]) {
    const l1 = mesh(new RoundedBoxGeometry(0.6, 0.15, 0.24, 6, 0.07), m.satinBlack);
    l1.position.set(sx * 1.12, 0.88, -0.04); l1.rotation.z = sx * -0.12;
    const l2 = mesh(new RoundedBoxGeometry(0.5, 0.34, 0.24, 6, 0.1), m.satinBlack);
    l2.position.set(sx * 1.15, 0.84, -0.3); l2.rotation.set(-0.5, 0, sx * -0.12);
    g.add(l1, l2);
  }
  return g;
}

// Xbox-style controller
const XB_OUTLINE = [
  [0, 0.74], [0.5, 0.79], [1.05, 0.88], [1.43, 0.78], [1.66, 0.42], [1.77, -0.12], [1.72, -0.62],
  [1.54, -1.04], [1.28, -1.2], [1.04, -1.06], [0.84, -0.74], [0.6, -0.52], [0, -0.5],
];
function buildXbox() {
  const m = heroMats();
  const g = new THREE.Group();
  const top = grained(new THREE.MeshPhysicalMaterial({ color: 0x17181b, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5 }), { bump: 0.0003, rough: 0.2 });
  const grip = grained(new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.72 }), { scale: 300, bump: 0.0012, rough: 0.3 });
  const { base, midZ, zAt } = controllerBase(XB_OUTLINE, {
    grip: [0.0, -0.95, 0.6, 1.1], gripCone: [[1.32, -0.2, -0.06], [1.33, -0.98, -0.24], 0.36, 0.31],
    halfT: 0.27, gripT: 0.06, droop: 0.16, crown: 0.04,
  });
  const LS = [-0.82, 0.3], RS = [0.42, -0.3], DP = [-0.42, -0.3], FB = [0.88, 0.3];
  const FB_OFF = [['Y', '#f2c418', 0, 0.21], ['B', '#e0373f', 0.21, 0], ['A', '#36c25b', 0, -0.21], ['X', '#3da9f4', -0.21, 0]];
  const cuts = [holeWell(...LS, zAt(...LS), 0.237, 0.06), holeWell(...RS, zAt(...RS), 0.237, 0.06), holeWell(...DP, zAt(...DP), 0.225, 0.035)];
  for (const [, , ox, oy] of FB_OFF) { const cx = FB[0] + ox, cy = FB[1] + oy; cuts.push(holeCyl(cx, cy, zAt(cx, cy), 0.112)); }
  cuts.push(holeCyl(0, 0.56, zAt(0, 0.56), 0.142));
  for (const sx of [-1, 1]) cuts.push(holeCyl(sx * 0.27, 0.3, zAt(sx * 0.27, 0.3), 0.055));
  cuts.push(holeBox(0, 0.22, zAt(0, 0.22), 0.05, 0.03, 0.025));
  const carved = carve(base, cuts);
  const zs = (x, y) => midZ(x, y) - 0.03;
  const shell = seamCut(carved, zs);
  g.add(meshPart((x, y, z) => Math.max(shell(x, y, z), zs(x, y) - z), [-1.85, -1.55, -0.3], [1.85, 0.95, 0.45], 0.0095, top));
  g.add(meshPart((x, y, z) => Math.max(shell(x, y, z), z - zs(x, y)), [-1.85, -1.55, -0.66], [1.85, 0.95, 0.05], 0.0095, grip));

  g.add(placeOn(base, stick(m), ...LS, 0, 0.7));
  g.add(placeOn(base, stick(m), ...RS, 0, 0.7));
  // brand-blue chrome d-pad in a dish
  {
    const holder = new THREE.Group();
    const dp = mesh(extrude(crossShape(0.36, 0.115), 0.035, 0.016, 5), m.blueChrome);
    dp.position.z = -0.012;
    const hub = mesh(domeCap(0.05, 0.012), m.blueChrome); hub.position.z = 0.022;
    holder.add(dp, hub);
    g.add(placeOn(base, holder, ...DP, -0.03, 0.6));
  }
  for (const [ch, col, ox, oy] of FB_OFF) {
    const b = capButton(0.1, letterTexture(ch, col, '#08090b'), m.btnBlack, { top: 0.03, dome: 0.022, glow: 0.8 });
    g.add(placeOn(base, b, FB[0] + ox, FB[1] + oy, 0, 0.6));
  }
  {
    const guide = capButton(0.13, invaderTexture('#ffffff', '#0b0c0e'), m.chrome, { top: 0.026, dome: 0.016, glow: 1.0 });
    const ring = mesh(new THREE.TorusGeometry(0.133, 0.009, 16, 120), m.whiteGlow); ring.position.z = 0.012;
    guide.add(ring);
    g.add(placeOn(base, guide, 0, 0.56, 0, 0.6));
  }
  for (const sx of [-1, 1]) g.add(placeOn(base, capButton(0.05, null, m.btnGray, { top: 0.018, dome: 0.008 }), sx * 0.27, 0.3, 0, 0.6));
  g.add(placeOn(base, pill(0.09, 0.05, 0.07, m.btnGray), 0, 0.22, -0.02, 0.6));
  for (const sx of [-1, 1]) {
    const lb = mesh(new RoundedBoxGeometry(0.6, 0.15, 0.24, 6, 0.07), m.satinBlack);
    lb.position.set(sx * 1.06, 0.86, -0.04); lb.rotation.z = sx * -0.14;
    const lt = mesh(new RoundedBoxGeometry(0.42, 0.32, 0.24, 6, 0.1), m.satinBlack);
    lt.position.set(sx * 1.06, 0.78, -0.3); lt.rotation.set(-0.5, 0, sx * -0.14);
    g.add(lb, lt);
  }
  return g;
}

// Nintendo Switch-style console (screen = reel mask)
function buildSwitch() {
  const m = heroMats();
  const g = new THREE.Group();
  const shellMat = grained(new THREE.MeshPhysicalMaterial({ color: 0x1b1c1f, roughness: 0.55, clearcoat: 0.15 }), { bump: 0.0003 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, reflectivity: 0.6 });
  const W = 2.1, H = 1.26, T = 0.075;
  // tablet: slab with softly rounded edges
  const tablet = (x, y, z) => sdRoundBox(x, y, z, W / 2, H / 2, T, 0.045);
  const vents = (x, y, z) => { // top vents
    if (y < H / 2 - 0.05 || x < 0.25 || x > 1.0) return 1;
    const ix = clamp(Math.round((x - 0.3) / 0.06), 0, 11);
    return sdRoundBox(x - 0.3 - ix * 0.06, y - H / 2, z, 0.018, 0.03, 0.022, 0.008);
  };
  const tabletF = (x, y, z) => smax(tablet(x, y, z), -vents(x, y, z), 0.004);
  g.add(meshPart(tabletF, [-W / 2 - 0.02, -H / 2 - 0.02, -T - 0.02], [W / 2 + 0.02, H / 2 + 0.02, T + 0.02], 0.007, shellMat));
  const front = mesh(extrude(roundedRectShape(W - 0.09, H - 0.09, 0.03), 0.004, 0.003, 3), glass);
  front.position.z = T - 0.001;
  g.add(front);
  const screen = mesh(extrude(roundedRectShape(1.8, 1.02, 0.012), 0.002, 0.001, 2), m.screen, { screen: true });
  screen.position.z = T + 0.007;
  g.add(screen);
  // top edge: power + volume, game-card cover, headphone jack
  const topY = H / 2;
  const power = pill(0.1, 0.03, 0.05, m.btnGray); power.position.set(-0.85, topY + 0.006, 0.0);
  const volA = pill(0.11, 0.03, 0.05, m.btnGray); volA.position.set(-0.68, topY + 0.006, 0.0);
  const volB = volA.clone(); volB.position.x = -0.55;
  const card = mesh(new RoundedBoxGeometry(0.42, 0.02, 0.1, 4, 0.008), shellMat); card.position.set(-0.15, topY + 0.004, -0.005);
  const jack = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 24), m.glossBlack); jack.position.set(-0.4, topY + 0.002, 0);
  g.add(power, volA, volB, card, jack);

  // Joy-Cons
  const jcW = 0.44, jcT = 0.065;
  const jcMat = grained(new THREE.MeshPhysicalMaterial({ color: BRAND, roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.28 }), { bump: 0.0002, rough: 0.15 });
  const joycon = (side) => {
    const outline = side < 0 ? cornerRectShape(jcW, H, [0.22, 0.012, 0.012, 0.22]) : cornerRectShape(jcW, H, [0.012, 0.22, 0.22, 0.012]);
    const d2 = polygonSDF(shapePoints(outline, 300), 0.004, 0.2);
    const base = (x, y, z) => roundedExtrusion(d2(x, y), z, jcT, 0.032);
    const zt = jcT;
    const cx = side * 0.02;
    const stickPos = side < 0 ? [cx, 0.3] : [cx, -0.12];
    const btnPos = side < 0 ? [cx, -0.14] : [cx, 0.3];
    const cuts = [holeWell(...stickPos, zt, 0.105, 0.03)];
    for (const [ox, oy] of [[0, 0.1], [0.1, 0], [0, -0.1], [-0.1, 0]]) cuts.push(holeCyl(btnPos[0] + ox, btnPos[1] + oy, zt, 0.05));
    const small = [[0.15 * -side, 0.53], [0.06 * -side, -0.42]]; // minus/plus, capture/home (inner side)
    for (const [sx, sy] of small) cuts.push(holeCyl(sx, sy, zt, 0.042));
    const f = carve(base, cuts, 0.004);
    const jc = new THREE.Group();
    jc.add(meshPart(f, [-jcW / 2 - 0.02, -H / 2 - 0.02, -jcT - 0.02], [jcW / 2 + 0.02, H / 2 + 0.02, jcT + 0.02], 0.0055, jcMat));
    jc.add(placeOn(base, stick(m, { scale: 0.47, ring: m.btnGray, well: 0.105 / 0.47 }), ...stickPos, 0, 1));
    const glyphs = side < 0 ? ['▲', '▶', '▼', '◀'] : ['X', 'A', 'B', 'Y'];
    [[0, 0.1], [0.1, 0], [0, -0.1], [-0.1, 0]].forEach(([ox, oy], i) => {
      const b = capButton(0.043, letterTexture(glyphs[i], '#c9ced6', '#16181c'), m.btnGray, { top: 0.014, dome: 0.006, depth: 0.04 });
      b.position.set(btnPos[0] + ox, btnPos[1] + oy, zt);
      jc.add(b);
    });
    // minus / plus
    const [mx, my] = small[0];
    const bar = pill(0.06, 0.018, 0.03, m.btnGray); bar.position.set(mx, my, zt + 0.006); jc.add(bar);
    if (side > 0) { const bar2 = bar.clone(); bar2.rotation.z = Math.PI / 2; jc.add(bar2); }
    // capture (left) / home (right)
    const [hx, hy] = small[1];
    if (side < 0) {
      const cap = pill(0.07, 0.07, 0.04, m.btnGray, 0.012); cap.position.set(hx, hy, zt - 0.006); jc.add(cap);
    } else {
      const home = capButton(0.04, invaderTexture('#7cc8ff', '#06080b'), m.blueChrome, { top: 0.012, dome: 0.005, glow: 0.9, depth: 0.04 });
      home.position.set(hx, hy, zt); jc.add(home);
    }
    // shoulder button on the top edge
    const sb = mesh(new RoundedBoxGeometry(0.24, 0.05, 0.09, 4, 0.02), m.satinBlack);
    sb.position.set(side * -0.04, H / 2 - 0.012, -0.02);
    jc.add(sb);
    jc.position.x = side * (W / 2 + jcW / 2 + 0.006);
    return jc;
  };
  g.add(joycon(-1), joycon(1));
  return g;
}

// RetroGamers invader logo: blue-chrome badge with a white enamel face
function buildLogo() {
  const m = heroMats();
  const g = new THREE.Group();
  const px = 0.2, depth = 0.4, rim = 0.032;
  const cols = INVADER[0].length, rows = INVADER.length;
  const cellAt = (x, y) => {
    const i = Math.floor(x / px + cols / 2), j = Math.floor(rows / 2 - y / px);
    return i >= 0 && j >= 0 && i < cols && j < rows && INVADER[j][i] === 'X';
  };
  const W = (cols / 2) * px + 0.15, Hh = (rows / 2) * px + 0.15;
  const d2 = morphSDF(cellAt, [-W, -Hh, W, Hh], 0.002, [['open', 0.03], ['close', 0.045]]);
  const zf = depth / 2;
  const enamelD = (x, y) => d2(x, y) + rim;
  const metalF = (x, y, z) => {
    const d = roundedExtrusion(d2(x, y), z, zf, 0.035);
    return smax(d, -Math.max(enamelD(x, y), zf - 0.024 - z), 0.006);
  };
  const enamelF = (x, y, z) => roundedExtrusion(enamelD(x, y) + 0.003, z - (zf - 0.07), 0.06, 0.012);
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x45aef6, metalness: 1, roughness: 0.16, clearcoat: 0.5, clearcoatRoughness: 0.1 });
  const enamel = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 });
  g.add(meshPart(metalF, [-W, -Hh, -zf - 0.03], [W, Hh, zf + 0.03], 0.0055, metal));
  g.add(meshPart(enamelF, [-W, -Hh, zf - 0.16], [W, Hh, zf], 0.0045, enamel));
  // eyes: recessed floor inside each socket with a glossy pupil
  INVADER.forEach((row, j) => [...row].forEach((ch, i) => {
    if (!(ch === '.' && j === 4 && (i === 3 || i === 9))) return;
    const x = (i - (cols - 1) / 2) * px, y = ((rows - 1) / 2 - j) * px;
    const floor = mesh(new RoundedBoxGeometry(px + 0.02, px + 0.02, 0.06, 4, 0.01), m.blueChrome);
    floor.position.set(x, y, -0.06);
    const pupil = mesh(new RoundedBoxGeometry(px * 0.4, px * 0.4, 0.04, 4, 0.01), m.glossBlack);
    pupil.position.set(x, y, -0.02);
    g.add(floor, pupil);
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
// legacyEnv/ao: 0 keep the grid objects' original look (RoomEnvironment, no AO) until they get hero-level models
export const MODELS = {
  // `glb`: ready-made model used instead of the procedural one when the file exists in
  // tools/baker/models (Sketchfab CC-BY downloads — see docs/3d-pipeline.md for credits)
  playstation: { build: buildPlaystation, pitch: -48, roll: 0, yaw: [-32, 32], fill: 0.94, glb: { file: 'playstation_5_dualsense.glb', size: 3.4, rotation: [-90, 0, 180], screenPlane: { x: 0, y: 0, z: 0.33, w: 0.37, h: 0.27, snap: '-y' } } },
  switch: { build: buildSwitch, pitch: -14, roll: 0, yaw: [-30, 30], fill: 0.94, glb: { file: 'nintendo_switch.glb', size: 3.4, screen: /screen_19|screen001|cube_screen_glass/i } },
  xbox: { build: buildXbox, pitch: -48, roll: 0, yaw: [-32, 32], fill: 0.94, envIntensity: 1.35, glb: { file: 'xbox_controller.glb', size: 3.4 } },
  logo: { build: buildLogo, pitch: -8, roll: 0, yaw: [-34, 34], fill: 0.94 },
  handheld: { build: buildHandheld, pitch: -10, roll: -6, yaw: [-30, 30], fill: 0.94, legacyEnv: true, envIntensity: 0.85, ao: 0, glb: { file: 'gameboy.glb', size: 3.0, screenPlane: { x: 0.025, y: 0.215, z: 0.452, w: 0.5, h: 0.31 } } },
  cartridge: { build: buildCartridge, pitch: -12, roll: 6, yaw: [-34, 34], fill: 0.94, legacyEnv: true, envIntensity: 0.85, ao: 0 },
  joystick: { build: buildJoystick, pitch: -62, roll: 0, yaw: [-34, 34], fill: 0.94, legacyEnv: true, envIntensity: 0.85, ao: 0 },
  crt: { build: buildCRT, pitch: -8, roll: 0, yaw: [-30, 30], fill: 0.94, legacyEnv: true, envIntensity: 0.85, ao: 0 },
  headset: { build: buildHeadset, pitch: -6, roll: 0, yaw: [-30, 30], fill: 0.94, legacyEnv: true, envIntensity: 0.85, ao: 0 },
};
