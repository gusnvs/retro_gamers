// Signed-distance-field modelling helpers for the baker.
// Organic, molded-plastic parts (controller shells, the logo) are described as SDFs and
// polygonised with Surface Nets, which gives dense, smooth meshes with exact gradient normals.
import * as THREE from 'three';

// ---------- scalar helpers ----------
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const mix = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// polynomial smooth min / max (k = blend radius)
export function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}
export const smax = (a, b, k) => -smin(-a, -b, k);

// ---------- 3D primitives (all take plain numbers to stay allocation free) ----------
export function sdRoundBox(x, y, z, bx, by, bz, r) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

export function sdSphere(x, y, z, r) { return Math.hypot(x, y, z) - r; }

// cylinder along z, radius r, half height h, edge rounding e
export function sdCylZ(x, y, z, r, h, e = 0) {
  const dx = Math.hypot(x, y) - r + e, dz = Math.abs(z) - h + e;
  return Math.min(Math.max(dx, dz), 0) + Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) - e;
}

// capsule / round cone between a and b with radii ra, rb (Inigo Quilez)
export function sdRoundCone(px, py, pz, a, b, ra, rb) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const cx = pax * l2 - bax * y, cy = pay * l2 - bay * y, cz = paz * l2 - baz * y;
  const x2 = cx * cx + cy * cy + cz * cz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - ra;
}

// 2D signed distance -> rounded 3D extrusion around a (possibly varying) mid plane
export function roundedExtrusion(d2, dz, halfT, r) {
  const wx = d2 + r, wy = Math.abs(dz) - halfT + r;
  return Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - r;
}

// ---------- 2D polygon distance, cached on a grid ----------
function polyDistExact(pts, x, y) {
  let d = Infinity, s = 1;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
    const qx = wx - ex * t, qy = wy - ey * t;
    d = Math.min(d, qx * qx + qy * qy);
    const c1 = y >= ay, c2 = y < by, c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

// returns f(x, y) -> signed distance (negative inside) for a closed polygon [[x,y],...]
export function polygonSDF(pts, res = 0.005, margin = 0.7) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 -= margin; y0 -= margin; x1 += margin; y1 += margin;
  const nx = Math.ceil((x1 - x0) / res) + 1, ny = Math.ceil((y1 - y0) / res) + 1;
  const grid = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) grid[i + j * nx] = polyDistExact(pts, x0 + i * res, y0 + j * res);
  return (x, y) => {
    const fx = (x - x0) / res, fy = (y - y0) / res;
    if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return polyDistExact(pts, x, y);
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = i + j * nx;
    return mix(mix(grid[k], grid[k + 1], tx), mix(grid[k + nx], grid[k + nx + 1], tx), ty);
  };
}

// samples a THREE.Shape (or point list) into [[x,y],...]
export function shapePoints(shape, n = 300) {
  return shape.getSpacedPoints ? shape.getSpacedPoints(n).slice(0, -1).map((p) => [p.x, p.y]) : shape;
}

// ---------- Surface Nets mesher ----------
// f(x,y,z) -> signed distance; returns an indexed BufferGeometry with gradient normals.
// opts.attr(x,y,z,nx,ny,nz) -> number adds a per-vertex float attribute "aMix".
export function meshSDF(f, bmin, bmax, step, opts = {}) {
  const nx = Math.ceil((bmax[0] - bmin[0]) / step) + 2;
  const ny = Math.ceil((bmax[1] - bmin[1]) / step) + 2;
  const nz = Math.ceil((bmax[2] - bmin[2]) / step) + 2;
  const ox = bmin[0] - step * 0.5, oy = bmin[1] - step * 0.5, oz = bmin[2] - step * 0.5;
  const F = new Float32Array(nx * ny * nz);
  const sxy = nx * ny;

  // narrow band: evaluate blocks coarsely, only refine near the surface
  const B = 4;
  for (let k0 = 0; k0 < nz; k0 += B) {
    const k1 = Math.min(k0 + B, nz) - 1;
    for (let j0 = 0; j0 < ny; j0 += B) {
      const j1 = Math.min(j0 + B, ny) - 1;
      for (let i0 = 0; i0 < nx; i0 += B) {
        const i1 = Math.min(i0 + B, nx) - 1;
        const dc = f(ox + ((i0 + i1) / 2) * step, oy + ((j0 + j1) / 2) * step, oz + ((k0 + k1) / 2) * step);
        const rad = (Math.hypot(i1 - i0, j1 - j0, k1 - k0) / 2) * step;
        const far = Math.abs(dc) > rad * 1.3 + 2 * step; // slack for fields that are not exact distances
        for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          F[i + j * nx + k * sxy] = far ? dc : f(ox + i * step, oy + j * step, oz + k * step);
        }
      }
    }
  }

  const cellV = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const h = step * 0.35;
  const grad = (x, y, z) => {
    const gx = f(x + h, y, z) - f(x - h, y, z);
    const gy = f(x, y + h, z) - f(x, y - h, z);
    const gz = f(x, y, z + h) - f(x, y, z - h);
    const l = Math.hypot(gx, gy, gz) || 1;
    return [gx / l, gy / l, gz / l];
  };
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = F[(i + (c & 1)) + (j + ((c >> 1) & 1)) * nx + (k + (c >> 2)) * sxy];
      cv[c] = v; if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let ax = 0, ay = 0, az = 0, n = 0;
    for (const [a, b] of EDGES) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      ax += (a & 1) + (((b & 1) - (a & 1)) * t);
      ay += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t);
      az += (a >> 2) + (((b >> 2) - (a >> 2)) * t);
      n++;
    }
    let px = ox + (i + ax / n) * step, py = oy + (j + ay / n) * step, pz = oz + (k + az / n) * step;
    // project onto the surface (keeps flat faces flat and edges crisp), clamped to the cell
    for (let it = 0; it < 3; it++) {
      const d = f(px, py, pz);
      if (Math.abs(d) < step * 1e-3) break;
      const g = grad(px, py, pz);
      px -= d * g[0]; py -= d * g[1]; pz -= d * g[2];
    }
    px = clamp(px, ox + (i - 0.5) * step, ox + (i + 1.5) * step);
    py = clamp(py, oy + (j - 0.5) * step, oy + (j + 1.5) * step);
    pz = clamp(pz, oz + (k - 0.5) * step, oz + (k + 1.5) * step);
    cellV[i + j * nx + k * sxy] = pos.length / 3;
    pos.push(px, py, pz);
  }

  const idx = [];
  const P = (v, c) => pos[v * 3 + c];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    const d1 = (P(a, 0) - P(c, 0)) ** 2 + (P(a, 1) - P(c, 1)) ** 2 + (P(a, 2) - P(c, 2)) ** 2;
    const d2 = (P(b, 0) - P(d, 0)) ** 2 + (P(b, 1) - P(d, 1)) ** 2 + (P(b, 2) - P(d, 2)) ** 2;
    if (d1 < d2) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
  };
  const cell = (i, j, k) => cellV[i + j * nx + k * sxy];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = F[i + j * nx + k * sxy] < 0;
    // x edge -> quad in (y,z)
    if (v0 !== (F[i + 1 + j * nx + k * sxy] < 0)) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), !v0);
    // y edge -> quad in (z,x)
    if (v0 !== (F[i + (j + 1) * nx + k * sxy] < 0)) quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), !v0);
    // z edge -> quad in (x,y)
    if (v0 !== (F[i + j * nx + (k + 1) * sxy] < 0)) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), !v0);
  }

  const vCount = pos.length / 3;
  const nrm = new Float32Array(vCount * 3);
  const mixA = opts.attr ? new Float32Array(vCount) : null;
  for (let v = 0; v < vCount; v++) {
    const g = grad(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    nrm[v * 3] = g[0]; nrm[v * 3 + 1] = g[1]; nrm[v * 3 + 2] = g[2];
    if (mixA) mixA[v] = opts.attr(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], g[0], g[1], g[2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (mixA) geo.setAttribute('aMix', new THREE.BufferAttribute(mixA, 1));
  geo.setIndex(vCount > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// ---------- placement on an SDF surface ----------
// marches from z = z0 towards -z and returns the hit point and surface normal
export function surfaceAt(f, x, y, z0 = 3) {
  let z = z0;
  for (let i = 0; i < 400; i++) {
    const d = f(x, y, z);
    if (d < 1e-4) break;
    z -= Math.max(d * 0.9, 1e-4);
  }
  const e = 1e-3;
  const n = new THREE.Vector3(f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)).normalize();
  return { z, n };
}

const Z = new THREE.Vector3(0, 0, 1);
// puts obj on the surface at (x,y), +Z aligned with the surface normal (blend < 1 keeps it closer to +Z)
export function placeOn(f, obj, x, y, lift = 0, blend = 1) {
  const { z, n } = surfaceAt(f, x, y);
  const dir = Z.clone().lerp(n, blend).normalize();
  obj.quaternion.setFromUnitVectors(Z, dir);
  obj.position.set(x, y, z).addScaledVector(dir, lift);
  return obj;
}

// ---------- 2D raster distance fields (for shapes like pixel art) ----------
const EDT_INF = 1e20;
function edt1d(f, n, out, v, z) {
  let k = 0; v[0] = 0; z[0] = -EDT_INF; z[1] = EDT_INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = EDT_INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; out[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
// squared pixel distance to the nearest pixel where mask === target
function edt2d(mask, nx, ny, target) {
  const d = new Float64Array(nx * ny);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] === target ? 0 : EDT_INF;
  const n = Math.max(nx, ny);
  const f = new Float64Array(n), o = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) f[j] = d[i + j * nx];
    edt1d(f, ny, o, v, z);
    for (let j = 0; j < ny; j++) d[i + j * nx] = o[j];
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) f[i] = d[i + j * nx];
    edt1d(f, nx, o, v, z);
    for (let i = 0; i < nx; i++) d[i + j * nx] = o[i];
  }
  return d;
}
function maskSDF(mask, nx, ny, res) {
  const dIn = edt2d(mask, nx, ny, 1), dOut = edt2d(mask, nx, ny, 0);
  const s = new Float32Array(nx * ny);
  for (let i = 0; i < s.length; i++) s[i] = mask[i] ? -(Math.sqrt(dOut[i]) - 0.5) * res : (Math.sqrt(dIn[i]) - 0.5) * res;
  return s;
}
// rasterises inside(x,y) and applies morphological ops: [['open', r], ['close', r]] (rounded corners / fillets)
export function morphSDF(inside, [x0, y0, x1, y1], res, ops = []) {
  const nx = Math.ceil((x1 - x0) / res), ny = Math.ceil((y1 - y0) / res);
  let mask = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) mask[i + j * nx] = inside(x0 + (i + 0.5) * res, y0 + (j + 0.5) * res) ? 1 : 0;
  const threshold = (sdf, t) => { const m = new Uint8Array(sdf.length); for (let i = 0; i < m.length; i++) m[i] = sdf[i] < t ? 1 : 0; return m; };
  for (const [op, r] of ops) {
    const s = maskSDF(mask, nx, ny, res);
    mask = op === 'open' ? threshold(maskSDF(threshold(s, -r), nx, ny, res), r) : threshold(maskSDF(threshold(s, r), nx, ny, res), -r);
  }
  const sdf = maskSDF(mask, nx, ny, res);
  return (x, y) => {
    const fx = clamp((x - x0) / res - 0.5, 0, nx - 1.001), fy = clamp((y - y0) / res - 0.5, 0, ny - 1.001);
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = i + j * nx;
    const v = mix(mix(sdf[k], sdf[k + 1], tx), mix(sdf[k + nx], sdf[k + nx + 1], tx), ty);
    // outside the raster: add the distance to the raster box so the field keeps growing
    const ox = Math.max(x0 - x, 0, x - x1), oy = Math.max(y0 - y, 0, y - y1);
    return v + Math.hypot(ox, oy);
  };
}

export function sdRoundRect(x, y, bx, by, r) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
