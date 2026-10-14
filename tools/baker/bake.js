// Offline baker: renders a model into 4x4 motion-vector flipbook sheets,
// reproducing the pass layout used by the reference (diffuse/alpha/position/mv/data).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MODELS } from './models.js';

const COLS = 4, ROWS = 4, FRAMES = COLS * ROWS;
const SS = 2; // supersampling factor

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

const passVS = /* glsl */`
  uniform mat4 uDelta;
  uniform mat4 uInvPivot;
  varying vec3 vObj;
  varying vec4 vClipCur;
  varying vec4 vClipNext;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vObj = (uInvPivot * world).xyz;
    vClipCur = projectionMatrix * viewMatrix * world;
    vClipNext = projectionMatrix * viewMatrix * (uDelta * world);
    gl_Position = vClipCur;
  }
`;

const passFS = /* glsl */`
  uniform int uMode;          // 0 position, 1 motion, 2 data
  uniform vec3 uBMin;
  uniform vec3 uBSize;
  uniform float uScreen;
  uniform float uMVScale;     // converts cell-uv delta into encoded range
  varying vec3 vObj;
  varying vec4 vClipCur;
  varying vec4 vClipNext;
  void main() {
    if (uMode == 0) {
      gl_FragColor = vec4(clamp((vObj - uBMin) / uBSize, 0.0, 1.0), 1.0);
    } else if (uMode == 1) {
      vec2 a = vClipCur.xy / vClipCur.w;
      vec2 b = vClipNext.xy / vClipNext.w;
      vec2 d = (b - a) * 0.5;            // delta in cell uv
      gl_FragColor = vec4(clamp(0.5 + d * uMVScale, 0.0, 1.0), 0.5, 1.0);
    } else {
      gl_FragColor = vec4(uScreen, 0.0, 0.0, 1.0);
    }
  }
`;

function frameYaw(cfg, i) {
  const t = i / (FRAMES - 1);
  return THREE.MathUtils.degToRad(THREE.MathUtils.lerp(cfg.yaw[0], cfg.yaw[1], t));
}

window.bakeModel = async function bakeModel(name, cell = 1024) {
  const cfg = MODELS[name];
  const scene = new THREE.Scene();
  scene.environment = envTex;

  // lighting: studio env + key/rim lights
  scene.environmentIntensity = 0.85;
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-3, 4, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.1, far: 20 });
  scene.add(key);
  // brand-blue rim (the reference uses warm/gold reflections that match its yellow)
  const rim = new THREE.DirectionalLight(0x6cc4ff, 3.0); rim.position.set(4, 2, -3); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0x3da9f4, 1.6); rim2.position.set(-4, -1, -2); scene.add(rim2);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(2, -3, 4); scene.add(fill);

  const yawGroup = new THREE.Group();
  const baseGroup = new THREE.Group();
  const model = cfg.build();
  baseGroup.add(model);
  baseGroup.rotation.set(THREE.MathUtils.degToRad(cfg.pitch), 0, THREE.MathUtils.degToRad(cfg.roll));
  yawGroup.add(baseGroup);
  scene.add(yawGroup);

  // centre model and compute framing over all frames
  const box0 = new THREE.Box3().setFromObject(model);
  const c0 = box0.getCenter(new THREE.Vector3());
  model.position.sub(c0);
  yawGroup.updateMatrixWorld(true);
  const objBox = new THREE.Box3();
  // bounding box in yaw-local space (stable across frames)
  model.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      objBox.union(b);
    }
  });
  const bSize = objBox.getSize(new THREE.Vector3());
  const bMin = objBox.min.clone();

  // frame the camera so the projected silhouette over all frames fills cfg.fill of the cell
  const fov = 22;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  const samplePts = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(p.count / 400));
    for (let k = 0; k < p.count; k += step) samplePts.push([o, new THREE.Vector3().fromBufferAttribute(p, k)]);
  });
  const projectedExtent = () => {
    const c = new THREE.Vector2(Infinity, -Infinity), r = new THREE.Vector2(Infinity, -Infinity);
    for (let i = 0; i < FRAMES; i++) {
      yawGroup.rotation.y = frameYaw(cfg, i);
      yawGroup.updateMatrixWorld(true);
      for (const [o, v] of samplePts) {
        const q = v.clone().applyMatrix4(o.matrixWorld).project(camera);
        c.x = Math.min(c.x, q.x); c.y = Math.max(c.y, q.x); r.x = Math.min(r.x, q.y); r.y = Math.max(r.y, q.y);
      }
    }
    return { minX: c.x, maxX: c.y, minY: r.x, maxY: r.y };
  };
  let dist = 10;
  const target = new THREE.Vector3();
  for (let it = 0; it < 6; it++) {
    camera.position.set(target.x, target.y, dist);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    const e = projectedExtent();
    const ext = Math.max(e.maxX - e.minX, e.maxY - e.minY) / 2;
    // re-centre on the silhouette (shift in world units at the origin plane)
    const halfH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * dist;
    target.x += ((e.maxX + e.minX) / 2) * halfH;
    target.y += ((e.maxY + e.minY) / 2) * halfH;
    dist *= ext / cfg.fill;
  }
  camera.position.set(target.x, target.y, dist);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);

  const S = cell * SS;
  renderer.setSize(S, S, false);

  const atlas = {
    diffuse: makeCanvas(cell * COLS),
    alpha: makeCanvas((cell * COLS) / 2),
    position: makeCanvas((cell * COLS) / 4),
    mv: makeCanvas((cell * COLS) / 4),
    data: makeCanvas((cell * COLS) / 4),
  };
  const ctx = Object.fromEntries(Object.entries(atlas).map(([k, c]) => [k, c.getContext('2d', { willReadFrequently: true })]));
  for (const k of ['diffuse']) { ctx[k].fillStyle = '#16181b'; ctx[k].fillRect(0, 0, atlas[k].width, atlas[k].height); }
  ctx.alpha.fillStyle = '#000'; ctx.alpha.fillRect(0, 0, atlas.alpha.width, atlas.alpha.height);
  ctx.position.fillStyle = '#000'; ctx.position.fillRect(0, 0, atlas.position.width, atlas.position.height);
  ctx.mv.fillStyle = 'rgb(128,128,128)'; ctx.mv.fillRect(0, 0, atlas.mv.width, atlas.mv.height);
  ctx.data.fillStyle = '#000'; ctx.data.fillRect(0, 0, atlas.data.width, atlas.data.height);

  // keep original materials, build pass materials per mesh
  const meshes = [];
  model.traverse((o) => { if (o.isMesh) { meshes.push(o); o.castShadow = true; o.receiveShadow = true; } });
  const original = new Map(meshes.map((m) => [m, m.material]));
  const passMat = new Map(meshes.map((m) => [m, new THREE.ShaderMaterial({
    vertexShader: passVS, fragmentShader: passFS, side: THREE.DoubleSide,
    uniforms: {
      uMode: { value: 0 }, uBMin: { value: bMin }, uBSize: { value: bSize }, uScreen: { value: m.userData.screen ? 1 : 0 },
      uMVScale: { value: 1 }, uDelta: { value: new THREE.Matrix4() }, uInvPivot: { value: new THREE.Matrix4() },
    },
  })]));

  // pass 0: measure max motion to choose displacement strength
  const yawMat = (i) => new THREE.Matrix4().makeRotationY(frameYaw(cfg, Math.min(i, FRAMES - 1)));
  // largest per-frame motion estimate from bbox corners
  let maxD = 0;
  const corners = [];
  for (const x of [objBox.min.x, objBox.max.x]) for (const y of [objBox.min.y, objBox.max.y]) for (const z of [objBox.min.z, objBox.max.z]) corners.push(new THREE.Vector3(x, y, z));
  for (let i = 0; i < FRAMES - 1; i++) {
    for (const c of corners) {
      const a = c.clone().applyMatrix4(yawMat(i)).project(camera);
      const b = c.clone().applyMatrix4(yawMat(i + 1)).project(camera);
      maxD = Math.max(maxD, Math.abs(b.x - a.x) * 0.5, Math.abs(b.y - a.y) * 0.5);
    }
  }
  // runtime: displacement(atlas uv) = (rg*2-1) * strength * 0.01 ; atlas uv = cell uv / COLS
  // encode: rg = 0.5 + d_cell * mvScale  -> d_atlas = (rg-0.5)*2*strength*0.01 = d_cell/COLS
  const strength = Math.ceil(((maxD / COLS) / 0.5 / 0.01) * 1.15 * 100) / 100;
  const mvScale = 1 / (COLS * 2 * strength * 0.01);

  const drawCell = (k, i) => {
    const size = atlas[k].width / COLS;
    const col = i % COLS, row = Math.floor(i / COLS);
    ctx[k].drawImage(renderer.domElement, col * size, row * size, size, size);
  };

  for (let i = 0; i < FRAMES; i++) {
    yawGroup.rotation.y = frameYaw(cfg, i);
    yawGroup.updateMatrixWorld(true);
    const invPivot = yawGroup.matrixWorld.clone().invert();
    const delta = yawMat(i + 1).multiply(yawMat(i).invert());

    // diffuse (transparent background) -> diffuse + alpha
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    meshes.forEach((m) => { m.material = original.get(m); });
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);

    // alpha cell from the render's alpha channel
    {
      const size = atlas.alpha.width / COLS;
      const tmpC = makeCanvas(size); const tctx = tmpC.getContext('2d', { willReadFrequently: true });
      tctx.drawImage(renderer.domElement, 0, 0, size, size);
      const img = tctx.getImageData(0, 0, size, size);
      for (let p = 0; p < img.data.length; p += 4) { const a = img.data[p + 3]; img.data[p] = img.data[p + 1] = img.data[p + 2] = a; img.data[p + 3] = 255; }
      tctx.putImageData(img, 0, 0);
      ctx.alpha.drawImage(tmpC, (i % COLS) * size, Math.floor(i / COLS) * size);
    }
    // diffuse: dilate colours outward so edges never sample the background
    {
      const size = atlas.diffuse.width / COLS;
      const tmpC = makeCanvas(size); const tctx = tmpC.getContext('2d');
      tctx.drawImage(renderer.domElement, 0, 0, size, size);
      const dil = makeCanvas(size); const dctx = dil.getContext('2d');
      dctx.drawImage(tmpC, 0, 0);
      dctx.globalCompositeOperation = 'destination-over';
      for (let r = 1; r <= 6; r++) {
        for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) dctx.drawImage(tmpC, dx, dy);
      }
      dctx.fillStyle = '#16181b'; dctx.fillRect(0, 0, size, size);
      ctx.diffuse.drawImage(dil, (i % COLS) * size, Math.floor(i / COLS) * size);
    }

    // data passes
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    meshes.forEach((m) => {
      const pm = passMat.get(m);
      pm.uniforms.uInvPivot.value.copy(invPivot);
      pm.uniforms.uDelta.value.copy(delta);
      pm.uniforms.uMVScale.value = mvScale;
      m.material = pm;
    });
    for (const [mode, key, clear] of [[0, 'position', [0, 0, 0]], [1, 'mv', [0.5, 0.5, 0.5]], [2, 'data', [0, 0, 0]]]) {
      meshes.forEach((m) => { passMat.get(m).uniforms.uMode.value = mode; });
      renderer.setClearColor(new THREE.Color(...clear), 1);
      renderer.render(scene, camera);
      drawCell(key, i);
    }
  }
  meshes.forEach((m) => { m.material = original.get(m); });

  const out = {
    diffuse: atlas.diffuse.toDataURL('image/jpeg', 0.9),
    alpha: atlas.alpha.toDataURL('image/jpeg', 0.92),
    position: atlas.position.toDataURL('image/png'),
    mv: atlas.mv.toDataURL('image/png'),
    data: atlas.data.toDataURL('image/png'),
  };
  return { name, passes: out, meta: { columns: COLS, rows: ROWS, displacementStrength: strength, cell } };
};

window.bakerReady = true;
