// Loads a ready-made model (e.g. downloaded from Sketchfab as .glb/.gltf) and
// prepares it for the motion-vector bake: centred, normalised size, shadows on,
// and screen meshes flagged (userData.screen) so the reel plays on them.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const draco = new DRACOLoader().setDecoderPath('/node_modules/three/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

export const MODEL_DIR = '/tools/baker/models/';

/** true when tools/baker/models/<file> exists */
export async function hasModel(file) {
  try {
    const r = await fetch(MODEL_DIR + file, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * opts:
 *  file      — file name inside tools/baker/models
 *  size      — target width of the model's largest horizontal extent (scene units)
 *  rotation  — [x, y, z] degrees applied before centring (fix the asset's up/front)
 *  screen    — RegExp tested against mesh and material names → reel mask
 *  hide      — RegExp of meshes to drop (stands, ground planes, cables…)
 *  alphaTest — discard texels below this alpha (glass covers that would cast shadows)
 *  screenPlane — optional fallback { x, y, z, w, h, rx, ry, rz, radius, lift, snap } in
 *                normalised model space (-0.5..0.5) when the asset has no separate screen mesh
 */
export async function loadModel(opts) {
  const gltf = await loader.loadAsync(MODEL_DIR + opts.file);
  const root = gltf.scene;
  // KHR_materials_pbrSpecularGlossiness was dropped from three.js: rebuild those
  // materials as metal/rough with the diffuse texture so the asset keeps its colours
  const jobs = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const ext = m?.userData?.gltfExtensions?.KHR_materials_pbrSpecularGlossiness;
      if (!ext || m.userData.sgFixed) continue;
      m.userData.sgFixed = true;
      if (ext.diffuseFactor) m.color.setRGB(ext.diffuseFactor[0], ext.diffuseFactor[1], ext.diffuseFactor[2]);
      m.metalness = 0;
      m.roughness = 1 - (ext.glossinessFactor ?? 0.5) * 0.8;
      if (ext.diffuseTexture) {
        jobs.push(gltf.parser.getDependency('texture', ext.diffuseTexture.index).then((t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          m.map = t;
          m.needsUpdate = true;
        }));
      }
    }
  });
  await Promise.all(jobs);
  const [rx = 0, ry = 0, rz = 0] = opts.rotation ?? [];
  root.rotation.set(THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), THREE.MathUtils.degToRad(rz));
  root.updateMatrixWorld(true);

  const drop = [];
  let screens = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const names = [o.name, o.parent?.name, ...(Array.isArray(o.material) ? o.material : [o.material]).map((m) => m?.name)].filter(Boolean).join(' ');
    if (opts.hide && opts.hide.test(names)) {
      drop.push(o);
      return;
    }
    o.castShadow = true;
    o.receiveShadow = true;
    if (opts.screen && opts.screen.test(names)) {
      o.userData.screen = true;
      screens++;
    }
    // baked flipbooks are lit by the studio environment; keep PBR inputs sane
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      if ('envMapIntensity' in m) m.envMapIntensity = 1;
      m.side = THREE.FrontSide;
      // alphaTest: drop nearly transparent texels (e.g. a glass cover), which would
      // otherwise still cast a solid shadow on what is under them
      if (opts.alphaTest) {
        m.alphaTest = opts.alphaTest;
        m.transparent = false;
        m.depthWrite = true;
      }
    }
  });
  drop.forEach((o) => o.parent.remove(o));

  // centre and normalise
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const k = (opts.size ?? 3.4) / Math.max(size.x, size.y, size.z);
  const wrap = new THREE.Group();
  root.position.sub(box.getCenter(new THREE.Vector3()));
  wrap.add(root);
  wrap.scale.setScalar(k);

  if (!screens && opts.screenPlane) {
    const p = opts.screenPlane;
    const pw = p.w * size.x, ph = p.h * (p.snap === 'y' || p.snap === '-y' ? size.z : size.y);
    // radius (fraction of the shorter side) rounds the corners like the real panel
    let geo = new THREE.PlaneGeometry(pw, ph);
    if (p.radius) {
      const r = Math.min(pw, ph) * p.radius, x = -pw / 2, y = -ph / 2;
      const sh = new THREE.Shape();
      sh.moveTo(x + r, y);
      sh.lineTo(x + pw - r, y);
      sh.quadraticCurveTo(x + pw, y, x + pw, y + r);
      sh.lineTo(x + pw, y + ph - r);
      sh.quadraticCurveTo(x + pw, y + ph, x + pw - r, y + ph);
      sh.lineTo(x + r, y + ph);
      sh.quadraticCurveTo(x, y + ph, x, y + ph - r);
      sh.lineTo(x, y + r);
      sh.quadraticCurveTo(x, y, x + r, y);
      geo = new THREE.ShapeGeometry(sh, 12);
    }
    const plane = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0x07090c, roughness: 0.06, clearcoat: 1 }));
    plane.position.set(p.x * size.x, p.y * size.y, p.z * size.z);
    plane.rotation.set(THREE.MathUtils.degToRad(p.rx ?? 0), THREE.MathUtils.degToRad(p.ry ?? 0), THREE.MathUtils.degToRad(p.rz ?? 0));
    if (p.snap) {
      // drop the plane onto the surface under (x, y), aligned to its normal
      // work in wrap-local units (wrap carries the normalising scale)
      wrap.updateMatrixWorld(true);
      // snap: true / 'z' casts along -Z (face towards camera); 'y' from +Y down;
      // '-y' from -Y up (face pointing down in the asset)
      const alongY = p.snap === 'y' || p.snap === '-y';
      const sy = p.snap === '-y' ? -1 : 1;
      const origin = wrap.localToWorld(alongY ? new THREE.Vector3(p.x * size.x, sy * size.y * 2, p.z * size.z) : new THREE.Vector3(p.x * size.x, p.y * size.y, size.z * 2));
      const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, alongY ? -sy : 0, alongY ? 0 : -1));
      // some exports flip the winding: test both faces
      const sides = [];
      root.traverse((o) => o.isMesh && (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { sides.push([m, m.side]); m.side = THREE.DoubleSide; }));
      const hit = ray.intersectObject(root, true)[0];
      if (alongY) {
        const probe = [];
        for (let zz = -0.45; zz <= 0.451; zz += 0.15) {
          const r2 = new THREE.Raycaster(wrap.localToWorld(new THREE.Vector3(p.x * size.x, sy * size.y * 2, zz * size.z)), new THREE.Vector3(0, -sy, 0));
          const h2 = r2.intersectObject(root, true)[0];
          probe.push(`z${zz.toFixed(2)}:${h2 ? (wrap.worldToLocal(h2.point.clone()).y / size.y).toFixed(2) : '-'}`);
        }
        console.log('[bake] probe ' + probe.join(' '));
      }
      sides.forEach(([m, s]) => (m.side = s));
      if (hit) {
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
        const at = wrap.worldToLocal(hit.point.clone());
        // lift: clearance over a slightly curved surface (fraction of the model depth)
        plane.position.copy(at).addScaledVector(n, size.z * (p.lift ?? 0.004));
        plane.lookAt(wrap.localToWorld(at.clone().add(n)));
        if (alongY) plane.rotateZ(Math.PI); // keep the texture upright when looking down
      } else {
        const wb = new THREE.Box3().setFromObject(root);
        console.log(`[bake] screenPlane snap: no surface hit; origin ${origin.toArray().map((v) => v.toFixed(2))} box ${wb.min.toArray().map((v) => v.toFixed(2))} .. ${wb.max.toArray().map((v) => v.toFixed(2))}`);
      }
    }
    plane.userData.screen = true;
    plane.userData.noCastShadow = true; // it sits on the lens: its shadow would show
    wrap.add(plane);
  }

  const out = new THREE.Group();
  out.add(wrap);
  // per-mesh boxes in normalised model space (-0.5..0.5), to place screen planes
  wrap.updateMatrixWorld(true);
  const sz = new THREE.Vector3(size.x * k, size.y * k, size.z * k);
  out.userData.meshBoxes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    const f = (v) => [+(v.x / sz.x).toFixed(2), +(v.y / sz.y).toFixed(2), +(v.z / sz.z).toFixed(2)];
    out.userData.meshBoxes.push(`${o.parent?.name || o.name}: min ${f(b.min)} max ${f(b.max)}`);
  });
  out.userData.meshNames = [];
  root.traverse((o) => o.isMesh && out.userData.meshNames.push(`${o.name} [${(Array.isArray(o.material) ? o.material : [o.material]).map((m) => m?.name).join(',')}]`));
  return out;
}
