// Prop and pickup models for Retro Smash Racer, built from curves (bevelled
// extrusions, lathes, tori, tubes) in the soft-plastic toy style of the
// reference's floor items. Brand symbols are modelled freely from the shapes
// the client chose (PlayStation, Xbox, Nintendo, Sega, Mario items).
// Badge-like items are authored in the XY plane facing +Z and laid flat (face
// up), so they read from the top-down camera.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { WORDMARKS } from "./wordmarks";

export type Brand = "playstation" | "xbox" | "nintendo" | "sega";
export type ColliderSpec = { kind: "box"; hx: number; hy: number; hz: number } | { kind: "ball"; r: number };

export interface PropModel {
  id: string;
  brand: Brand | "bonus";
  points: number;
  count: number;
  object: THREE.Object3D;
  collider: ColliderSpec;
}

const toy = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18, ...extra });

const bevelled = (shape: THREE.Shape | THREE.Shape[], depth: number, bevel: number, curve = 24) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 5,
    curveSegments: curve,
  });
  g.translate(0, 0, -depth / 2);
  return g;
};

const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[]) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};

function roundedRect<T extends THREE.Path = THREE.Shape>(w: number, h: number, r: number, cx = 0, cy = 0, path: T = new THREE.Shape() as unknown as T): T {
  const x = cx - w / 2, y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - r);
  path.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(x + r, y + h);
  path.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + r);
  path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

function circlePath<T extends THREE.Path = THREE.Path>(r: number, cx = 0, cy = 0, path: T = new THREE.Path() as T): T {
  path.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return path;
}

function polygon<T extends THREE.Path = THREE.Shape>(points: [number, number][], path: T = new THREE.Shape() as unknown as T): T {
  points.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return path;
}

/** lay an XY-authored object flat (face up) and centre it on the origin */
function flat(o: THREE.Object3D) {
  const g = new THREE.Group();
  o.rotation.x = -Math.PI / 2;
  g.add(o);
  return centre(g);
}

function centre(o: THREE.Object3D) {
  o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o);
  const c = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  o.position.sub(c);
  wrap.add(o);
  return wrap;
}

function boxCollider(o: THREE.Object3D, shrink = 0.92): ColliderSpec {
  const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
  return { kind: "box", hx: (s.x / 2) * shrink, hy: (s.y / 2) * shrink, hz: (s.z / 2) * shrink };
}

function eyes(spacing: number, h: number, z: number) {
  const m = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });
  const g = new THREE.CapsuleGeometry(h * 0.22, h, 6, 12);
  const grp = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = mesh(g, m);
    e.position.set((s * spacing) / 2, 0, z);
    e.scale.z = 0.5;
    grp.add(e);
  }
  return grp;
}

function svgShapes(d: string) {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  return data.paths.flatMap((p) => SVGLoader.createShapes(p));
}

// ------------------------------------------------------------- PlayStation
function psTriangle() {
  const R = 0.85, r = 0.5;
  const tri = (rad: number) => [0, 1, 2].map((i) => [Math.cos(Math.PI / 2 + (i * 2 * Math.PI) / 3) * rad, Math.sin(Math.PI / 2 + (i * 2 * Math.PI) / 3) * rad] as [number, number]);
  const s = polygon(tri(R)) as THREE.Shape;
  s.holes.push(polygon(tri(r).reverse(), new THREE.Path()) as THREE.Path);
  return flat(mesh(bevelled(s, 0.22, 0.1), toy(0x2ec27e)));
}
function psCircle() {
  return flat(mesh(new THREE.TorusGeometry(0.62, 0.2, 20, 48), toy(0xe8413f)));
}
function psCross() {
  const g = new THREE.Group();
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const bar = mesh(new RoundedBoxGeometry(1.7, 0.36, 0.36, 4, 0.16), toy(0x3d8ee8));
    bar.rotation.z = a;
    g.add(bar);
  }
  return flat(g);
}
function psSquare() {
  const s = roundedRect(1.4, 1.4, 0.12);
  s.holes.push(roundedRect(0.8, 0.8, 0.06, 0, 0, new THREE.Path()) as THREE.Path);
  return flat(mesh(bevelled(s, 0.22, 0.1), toy(0xef80b5)));
}
function psLogo() {
  // upright red P standing on a flat, three-colour S
  const g = new THREE.Group();
  const p = new THREE.Shape();
  p.moveTo(0, 0);
  p.lineTo(0.36, 0);
  p.lineTo(0.36, 1.0);
  p.lineTo(0.6, 1.0);
  p.absarc(0.6, 1.6, 0.6, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(0, 2.2);
  p.closePath();
  const bowl = new THREE.Path();
  bowl.moveTo(0.36, 1.3);
  bowl.lineTo(0.6, 1.3);
  bowl.absarc(0.6, 1.6, 0.3, -Math.PI / 2, Math.PI / 2, false);
  bowl.lineTo(0.36, 1.9);
  bowl.closePath();
  p.holes.push(bowl);
  const P = mesh(bevelled(p, 0.28, 0.06), toy(0xe2231a));
  P.position.set(-0.3, 0.1, 0);
  g.add(P);
  const sCurve = (pts: [number, number][]) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.08, z)));
  const parts: [[number, number][], number][] = [
    [[[-1.3, 0.55], [-0.7, 0.75], [0.0, 0.55]], 0xf6b510],
    [[[0.0, 0.55], [0.5, 0.25], [0.3, -0.05]], 0x00a69c],
    [[[0.3, -0.05], [0.9, -0.3], [1.4, -0.25]], 0x2d6db5],
  ];
  for (const [pts, c] of parts) {
    const t = mesh(new THREE.TubeGeometry(sCurve(pts), 24, 0.16, 12, false), toy(c));
    t.scale.y = 0.55;
    g.add(t);
  }
  return centre(g);
}
function psPlus() {
  const g = new THREE.Group();
  const a = 0.5, b = 1.2, r = 0.16;
  const s = new THREE.Shape();
  // rounded plus outline
  const pts: [number, number][] = [[-a, b], [a, b], [a, a], [b, a], [b, -a], [a, -a], [a, -b], [-a, -b], [-a, -a], [-b, -a], [-b, a], [-a, a]];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const plus = mesh(bevelled(s, 0.4, r, 12), toy(0xf2b705));
  g.add(plus);
  const engr = toy(0xb57d00, { clearcoat: 0.4 });
  const ring = (rad: number, th: number) => {
    const sh = circlePath(rad, 0, 0, new THREE.Shape()) as THREE.Shape;
    sh.holes.push(circlePath(rad - th) as THREE.Path);
    return sh;
  };
  const top = 0.2 + r + 0.01;
  const sym = (geo: THREE.BufferGeometry, x: number, y: number) => {
    const m = mesh(geo, engr);
    m.position.set(x, y, top);
    g.add(m);
  };
  const flatSym = (sh: THREE.Shape) => new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false, curveSegments: 20 });
  sym(flatSym(ring(0.26, 0.07)), 0.82, 0);
  const tri = polygon([[0, 0.3], [-0.27, -0.17], [0.27, -0.17]]) as THREE.Shape;
  tri.holes.push(polygon([[0, 0.18], [0.16, -0.1], [-0.16, -0.1]], new THREE.Path()) as THREE.Path);
  sym(flatSym(tri), 0, 0.82);
  const sq = roundedRect(0.5, 0.5, 0.04);
  sq.holes.push(roundedRect(0.36, 0.36, 0.02, 0, 0, new THREE.Path()) as THREE.Path);
  sym(flatSym(sq), -0.82, 0);
  for (const r2 of [Math.PI / 4, -Math.PI / 4]) {
    const bar = mesh(new THREE.BoxGeometry(0.56, 0.08, 0.04), engr);
    bar.position.set(0, -0.82, top + 0.02);
    bar.rotation.z = r2;
    g.add(bar);
  }
  return flat(g);
}

// -------------------------------------------------------------------- Xbox
function xboxSphere() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.85, 40, 28), toy(0xf4f6f4)));
  const green = toy(0x76d12a, { emissive: 0x2f6a00, emissiveIntensity: 0.35 });
  for (const sx of [1, -1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = -1.15 + (i / 24) * 2.3;
      const d = new THREE.Vector3((sx * Math.sin(a)) / Math.SQRT2, Math.sin(a) / Math.SQRT2, Math.cos(a)).normalize();
      pts.push(d.multiplyScalar(0.86));
    }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.13, 12, false), green));
  }
  // face up so the X reads from the camera
  g.rotation.x = -Math.PI / 2;
  return centre(g);
}

// ---------------------------------------------------------------- Nintendo
function switchLogo() {
  const red = toy(0xe60012);
  const g = new THREE.Group();
  const left = roundedRect(0.62, 1.5, 0.3);
  left.holes.push(roundedRect(0.38, 1.26, 0.18, 0, 0, new THREE.Path()) as THREE.Path);
  const lm = mesh(bevelled(left, 0.2, 0.05), red);
  lm.position.x = -0.36;
  const dot = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 24), red);
  dot.rotation.x = Math.PI / 2;
  dot.position.set(-0.36, 0.32, 0);
  const right = roundedRect(0.62, 1.5, 0.3);
  right.holes.push(circlePath(0.12, 0, -0.3) as THREE.Path);
  const rm = mesh(bevelled(right, 0.2, 0.05), red);
  rm.position.x = 0.36;
  g.add(lm, dot, rm);
  return flat(g);
}
function gameCube() {
  const purple = toy(0x8a6de9);
  const dark = toy(0x6a4fc9);
  const g = new THREE.Group();
  const slab = (w: number, h: number, d: number, x: number, y: number, z: number, m = purple) => {
    const s = mesh(new RoundedBoxGeometry(w, h, d, 3, 0.05), m);
    s.position.set(x, y, z);
    g.add(s);
  };
  const S = 1.5, t = 0.26;
  slab(S, t, S, 0, -S / 2 + t / 2, 0); // floor
  slab(t, S, S, -S / 2 + t / 2, 0, 0); // left wall
  slab(S, S, t, 0, 0, -S / 2 + t / 2); // back wall
  slab(S, t, S * 0.55, 0, S / 2 - t / 2, -S * 0.22); // half lid (the open "G")
  slab(0.62, 0.62, 0.62, 0.12, -0.33, 0.2, dark); // inner cube
  return centre(g);
}
function mushroom() {
  const g = new THREE.Group();
  const capPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * (Math.PI / 2);
    capPts.push(new THREE.Vector2(Math.sin(a) * 1.0 + 0.001, Math.cos(a) * 0.82));
  }
  capPts.push(new THREE.Vector2(0.92, -0.08), new THREE.Vector2(0.001, -0.08));
  const cap = mesh(new THREE.LatheGeometry(capPts.reverse(), 40), toy(0xe52521));
  cap.position.y = 0.55;
  g.add(cap);
  const spotM = toy(0xffffff);
  for (const [th, ph, r] of [[0, 0, 0.36], [0.95, 0.4, 0.26], [0.95, 2.5, 0.26], [0.95, 4.4, 0.26], [1.15, 1.5, 0.2]] as const) {
    const n = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    const spot = mesh(new THREE.SphereGeometry(r, 20, 12), spotM);
    spot.scale.set(1, 0.28, 1);
    spot.position.set(n.x * 0.98, 0.55 + n.y * 0.8, n.z * 0.98);
    spot.lookAt(spot.position.clone().add(n));
    spot.rotateX(Math.PI / 2);
    g.add(spot);
  }
  const stemPts = [new THREE.Vector2(0.001, -0.5), new THREE.Vector2(0.5, -0.5), new THREE.Vector2(0.6, -0.2), new THREE.Vector2(0.58, 0.2), new THREE.Vector2(0.45, 0.55), new THREE.Vector2(0.001, 0.55)];
  g.add(mesh(new THREE.LatheGeometry(stemPts, 32), toy(0xf6dcb2)));
  const e = eyes(0.26, 0.22, 0.57);
  e.position.y = 0.05;
  g.add(e);
  return centre(g);
}
function fireFlower() {
  const g = new THREE.Group();
  const head = new THREE.Group();
  head.add(mesh(new THREE.TorusGeometry(0.62, 0.2, 18, 40), toy(0xf47a1f)));
  head.add(mesh(new THREE.TorusGeometry(0.4, 0.13, 16, 36), toy(0xfde03a)));
  const face = mesh(new THREE.SphereGeometry(0.32, 24, 16), toy(0xf8f8f2));
  face.scale.z = 0.55;
  head.add(face);
  head.add(eyes(0.18, 0.16, 0.17));
  head.position.y = 0.9;
  g.add(head);
  const green = toy(0x34b24a);
  const stem = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.9, 12), green);
  stem.position.y = 0.2;
  g.add(stem);
  const leaf = new THREE.Shape();
  leaf.moveTo(0, 0);
  leaf.quadraticCurveTo(0.35, 0.32, 0.78, 0.12);
  leaf.quadraticCurveTo(0.42, -0.08, 0, 0);
  for (const s of [1, -1]) {
    const l = mesh(bevelled(leaf, 0.04, 0.04, 16), green);
    l.scale.x = s;
    l.position.set(0.04 * s, -0.12, 0);
    g.add(l);
  }
  return centre(g);
}
function wordmark(key: "sega" | "nintendo", face: number, side: number, height: number) {
  const wm = WORDMARKS[key];
  const shapes = svgShapes(wm.d);
  const geo = bevelled(shapes, 18, 3, 10);
  geo.scale(1, -1, -1); // SVG y down (two axes flipped keeps the winding)
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const k = height / (bb.max.y - bb.min.y);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0);
  geo.scale(k, k, k);
  const g = new THREE.Group();
  g.add(mesh(geo, [toy(face), toy(side)]));
  return g;
}
function segaLogo() {
  return flat(wordmark("sega", 0x1f4fbf, 0xf4f4f4, 0.75));
}
function nintendoLogo() {
  const g = wordmark("nintendo", 0xe4000f, 0xe4000f, 0.42);
  const ring = roundedRect(3.3, 0.95, 0.47);
  ring.holes.push(roundedRect(3.04, 0.69, 0.34, 0, 0, new THREE.Path()) as THREE.Path);
  g.add(mesh(bevelled(ring, 0.14, 0.05), toy(0xe4000f)));
  return flat(g);
}

// --------------------------------------------------------------- bonus ? block
function questionBlock() {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(1.5, 1.5, 1.5, 5, 0.16), toy(0xf8b616)));
  const shapes = svgShapes(WORDMARKS.question.d);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 6, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.6, bevelSegments: 3, curveSegments: 12 });
  geo.scale(1, -1, -1);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0);
  const k = 0.9 / (bb.max.y - bb.min.y);
  geo.scale(k, k, k);
  // sit on the face, raised outwards
  geo.computeBoundingBox();
  geo.translate(0, 0, -geo.boundingBox!.min.z - 0.02);
  const q = toy(0xf2f2f2);
  const rivet = new THREE.SphereGeometry(0.07, 12, 8);
  const rivM = toy(0x6b4300);
  const faces: [THREE.Vector3, THREE.Euler][] = [
    [new THREE.Vector3(0, 0, 0.76), new THREE.Euler(0, 0, 0)],
    [new THREE.Vector3(0, 0, -0.76), new THREE.Euler(0, Math.PI, 0)],
    [new THREE.Vector3(0.76, 0, 0), new THREE.Euler(0, Math.PI / 2, 0)],
    [new THREE.Vector3(-0.76, 0, 0), new THREE.Euler(0, -Math.PI / 2, 0)],
    [new THREE.Vector3(0, 0.76, 0), new THREE.Euler(-Math.PI / 2, 0, 0)],
  ];
  for (const [p, e] of faces) {
    const f = new THREE.Group();
    f.position.copy(p);
    f.rotation.copy(e);
    f.add(mesh(geo, q));
    for (const [x, y] of [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]]) {
      const r = mesh(rivet, rivM);
      r.position.set(x, y, 0);
      r.scale.z = 0.5;
      f.add(r);
    }
    g.add(f);
  }
  return centre(g);
}

// ----------------------------------------------------------------- pickups
export function coinModel() {
  const pts = [
    new THREE.Vector2(0.001, -0.1),
    new THREE.Vector2(0.62, -0.1),
    new THREE.Vector2(0.7, -0.05),
    new THREE.Vector2(0.7, 0.05),
    new THREE.Vector2(0.62, 0.1),
    new THREE.Vector2(0.001, 0.1),
  ];
  const gold = toy(0xffc81a, { metalness: 0.35, emissive: 0x5a3c00, emissiveIntensity: 0.5 });
  const g = new THREE.Group();
  const disc = mesh(new THREE.LatheGeometry(pts, 40), gold);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  for (const z of [0.1, -0.1]) {
    const slot = mesh(new RoundedBoxGeometry(0.14, 0.62, 0.08, 3, 0.04), toy(0xe0a200, { metalness: 0.35 }));
    slot.position.z = z;
    g.add(slot);
  }
  return g;
}
export function starModel() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.42 : 0.95;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.Group();
  g.add(mesh(bevelled(s, 0.2, 0.16, 8), toy(0xffd21f, { emissive: 0x6a5200, emissiveIntensity: 0.45 })));
  const e = eyes(0.26, 0.24, 0.3);
  e.position.y = 0.04;
  g.add(e);
  return g;
}

// ------------------------------------------------------------------ catalog
export function buildPropModels(): PropModel[] {
  const def = (id: string, brand: PropModel["brand"], count: number, object: THREE.Object3D, points = 1, collider?: ColliderSpec): PropModel => ({
    id,
    brand,
    points,
    count,
    object,
    collider: collider ?? boxCollider(object),
  });
  return [
    def("ps-triangle", "playstation", 8, psTriangle()),
    def("ps-circle", "playstation", 8, psCircle()),
    def("ps-cross", "playstation", 8, psCross()),
    def("ps-square", "playstation", 8, psSquare()),
    def("ps-logo", "playstation", 5, psLogo()),
    def("ps-plus", "playstation", 6, psPlus()),
    def("xbox", "xbox", 14, xboxSphere(), 1, { kind: "ball", r: 0.9 }),
    def("switch", "nintendo", 8, switchLogo()),
    def("gamecube", "nintendo", 6, gameCube()),
    def("mushroom", "nintendo", 8, mushroom()),
    def("fire-flower", "nintendo", 5, fireFlower()),
    def("nintendo", "nintendo", 4, nintendoLogo()),
    def("sega", "sega", 8, segaLogo()),
    def("question-block", "bonus", 6, questionBlock(), 3),
  ];
}
