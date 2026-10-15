// Offline baker: renders a model into 4x4 motion-vector flipbook sheets,
// reproducing the pass layout used by the reference (diffuse/alpha/position/mv/data).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MODELS } from './models.js';
import { hasModel, loadModel } from './gltf.js';

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

// product-photography studio: dark room, big softboxes and two strip lights (one in brand blue)
function studioEnvironment() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float t = normalize(vP).y; vec3 c = mix(vec3(0.03,0.032,0.038), vec3(0.3,0.31,0.33), smoothstep(-0.6,0.9,t)); gl_FragColor = vec4(c,1.0); }',
  }));
  s.add(room);
  const panel = (w, h, color, intensity, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(12, 9, 0xffffff, 3.2, [0, 13, 2]);          // overhead softbox
  panel(7, 9, 0xfff8f0, 5.5, [-11, 5, 10]);         // key softbox, front-left
  panel(2.2, 16, 0x6cc4ff, 6.0, [14, 1, -4]);       // brand-blue strip, right/back
  panel(1.6, 16, 0xffffff, 3.0, [-14, 0, -5]);      // white strip, left/back
  panel(16, 2.5, 0xffffff, 0.9, [0, -9, 11]);       // low front bounce
  panel(5, 5, 0x3da9f4, 1.6, [6, -8, -8]);          // blue kicker from below
  return s;
}
const envTex = pmrem.fromScene(studioEnvironment(), 0.02).texture;
const legacyEnvTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- ambient occlusion (shadow-map ray casting, accumulated over many directions) ----------
const AO_SAMPLES = 72;
const fsQuad = (mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); m.frustumCulled = false; const s = new THREE.Scene(); s.add(m); return s; };
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const accumMat = new THREE.ShaderMaterial({
  uniforms: { tSrc: { value: null }, uW: { value: 1 } }, vertexShader: fsVS,
  fragmentShader: 'uniform sampler2D tSrc; uniform float uW; varying vec2 vUv; void main(){ vec4 c = texture2D(tSrc, vUv); gl_FragColor = vec4(c.r, c.r, c.r, c.a) * uW; }',
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, depthTest: false, depthWrite: false, toneMapped: false,
});
const accumScene = fsQuad(accumMat);
const compositeMat = new THREE.ShaderMaterial({
  uniforms: { tBeauty: { value: null }, tAO: { value: null }, uAO: { value: 0.88 }, uDebug: { value: 0 } }, vertexShader: fsVS,
  fragmentShader: `
    uniform sampler2D tBeauty; uniform sampler2D tAO; uniform float uAO; uniform int uDebug; varying vec2 vUv;
    void main() {
      vec4 b = texture2D(tBeauty, vUv);
      vec4 o = texture2D(tAO, vUv);
      float a = clamp(b.a, 0.0, 1.0);
      vec3 c = a > 0.0 ? b.rgb / a : vec3(0.0);
      float ao = o.a > 1e-4 ? clamp(4.0 * o.r / o.a, 0.0, 1.0) : 1.0;
      ao = mix(1.0, smoothstep(0.0, 1.0, ao), uAO);
      gl_FragColor = vec4(uDebug == 1 ? vec3(ao) : uDebug == 2 ? c : c * ao, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor = vec4(gl_FragColor.rgb * a, a);
    }`,
  blending: THREE.NoBlending, depthTest: false, depthWrite: false, toneMapped: true,
});
const compositeScene = fsQuad(compositeMat);
const aoMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const aoOpenMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.25, 0.25), side: THREE.DoubleSide });
const aoLight = new THREE.DirectionalLight(0xffffff, Math.PI);
aoLight.castShadow = true;
aoLight.shadow.mapSize.set(2048, 2048);
aoLight.shadow.bias = -0.0003;
aoLight.shadow.normalBias = 0.012;
// fibonacci sphere, fixed in model space so occlusion is identical on every frame
const aoDirs = Array.from({ length: AO_SAMPLES }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / AO_SAMPLES, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
  return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
});
const isGlow = (m) => m.userData.noAO || (m.material.emissive && m.material.emissive.getHex() !== 0 && !m.material.emissiveMap);

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
  varying vec2 vUv;
  void main() {
    vUv = uv;
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
  uniform sampler2D uMap;     // same cut-out as the beauty pass (material.alphaTest)
  uniform float uAlphaTest;
  varying vec3 vObj;
  varying vec4 vClipCur;
  varying vec4 vClipNext;
  varying vec2 vUv;
  void main() {
    if (uAlphaTest > 0.0 && texture2D(uMap, vUv).a < uAlphaTest) discard;
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
  scene.environment = cfg.legacyEnv ? legacyEnvTex : envTex;

  // lighting: studio env + key/rim lights
  scene.environmentIntensity = cfg.envIntensity ?? 1.0;
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
  // ready-made model (tools/baker/models/*.glb) when present, procedural otherwise
  let model;
  if (cfg.glb && (await hasModel(cfg.glb.file))) {
    model = await loadModel(cfg.glb);
    console.log(`[bake] ${name}: ${cfg.glb.file} | ` + model.userData.meshBoxes.join(' | '));
  } else {
    model = cfg.build();
  }
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
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true };
  const beautyRT = new THREE.WebGLRenderTarget(S, S, { ...rtOpts, samples: 4 });
  const aoTmpRT = new THREE.WebGLRenderTarget(S, S, { ...rtOpts, samples: 4 });
  const aoAccRT = new THREE.WebGLRenderTarget(S, S, { type: THREE.HalfFloatType, depthBuffer: false });
  const radius = objBox.getBoundingSphere(new THREE.Sphere()).radius + 0.05;
  Object.assign(aoLight.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 0.1, far: 4 * radius + 2 });
  aoLight.shadow.camera.updateProjectionMatrix();
  scene.add(aoLight, aoLight.target);
  const sceneLights = [key, rim, rim2, fill];

  const atlas = {
    diffuse: makeCanvas(cell * COLS),
    alpha: makeCanvas((cell * COLS) / 2),
    position: makeCanvas((cell * COLS) / 4),
    mv: makeCanvas((cell * COLS) / 4),
    data: makeCanvas((cell * COLS) / 2), // half res: crisp screen edges
  };
  const ctx = Object.fromEntries(Object.entries(atlas).map(([k, c]) => [k, c.getContext('2d', { willReadFrequently: true })]));
  for (const k of ['diffuse']) { ctx[k].fillStyle = '#16181b'; ctx[k].fillRect(0, 0, atlas[k].width, atlas[k].height); }
  ctx.alpha.fillStyle = '#000'; ctx.alpha.fillRect(0, 0, atlas.alpha.width, atlas.alpha.height);
  ctx.position.fillStyle = '#000'; ctx.position.fillRect(0, 0, atlas.position.width, atlas.position.height);
  ctx.mv.fillStyle = 'rgb(128,128,128)'; ctx.mv.fillRect(0, 0, atlas.mv.width, atlas.mv.height);
  ctx.data.fillStyle = '#000'; ctx.data.fillRect(0, 0, atlas.data.width, atlas.data.height);

  // keep original materials, build pass materials per mesh
  const meshes = [];
  model.traverse((o) => { if (o.isMesh) { meshes.push(o); o.castShadow = !o.userData.noCastShadow; o.receiveShadow = true; } });
  const original = new Map(meshes.map((m) => [m, m.material]));
  const passMat = new Map(meshes.map((m) => {
    const src = Array.isArray(m.material) ? m.material[0] : m.material;
    const cut = src?.alphaTest > 0 && src.map ? src.alphaTest : 0;
    return [m, new THREE.ShaderMaterial({
      vertexShader: passVS, fragmentShader: passFS, side: THREE.DoubleSide,
      uniforms: {
        uMode: { value: 0 }, uBMin: { value: bMin }, uBSize: { value: bSize }, uScreen: { value: m.userData.screen ? 1 : 0 },
        uMVScale: { value: 1 }, uDelta: { value: new THREE.Matrix4() }, uInvPivot: { value: new THREE.Matrix4() },
        uMap: { value: cut ? src.map : null }, uAlphaTest: { value: cut },
      },
    })];
  }));

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

    // beauty in linear HDR (transparent background)
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    meshes.forEach((m) => { m.material = original.get(m); });
    renderer.setClearColor(0x000000, 0);
    aoLight.visible = false;
    renderer.setRenderTarget(beautyRT);
    renderer.clear();
    renderer.render(scene, camera);

    // ambient occlusion: average visibility over AO_SAMPLES directions attached to the model
    const env = scene.environment;
    scene.environment = null;
    sceneLights.forEach((l) => { l.visible = false; });
    aoLight.visible = true;
    meshes.forEach((m) => { m.material = isGlow(m) ? aoOpenMat : aoMat; });
    renderer.setRenderTarget(aoAccRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    accumMat.uniforms.uW.value = 1 / AO_SAMPLES;
    accumMat.uniforms.tSrc.value = aoTmpRT.texture;
    for (const d of aoDirs) {
      const wd = d.clone().applyQuaternion(yawGroup.quaternion);
      aoLight.position.copy(wd).multiplyScalar(2 * radius + 1);
      aoLight.target.position.set(0, 0, 0);
      aoLight.updateMatrixWorld(); aoLight.target.updateMatrixWorld();
      renderer.setRenderTarget(aoTmpRT);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(aoAccRT);
      renderer.autoClear = false;
      renderer.render(accumScene, fsCam);
      renderer.autoClear = true;
    }
    aoLight.visible = false;
    sceneLights.forEach((l) => { l.visible = true; });
    scene.environment = env;
    meshes.forEach((m) => { m.material = original.get(m); });

    // composite (AO, tone mapping, sRGB, premultiplied alpha) onto the canvas
    compositeMat.uniforms.tBeauty.value = beautyRT.texture;
    compositeMat.uniforms.tAO.value = aoAccRT.texture;
    compositeMat.uniforms.uAO.value = cfg.ao ?? 0.88;
    compositeMat.uniforms.uDebug.value = window.bakeDebug || 0; // 1 = AO only, 2 = without AO
    renderer.setRenderTarget(null);
    renderer.render(compositeScene, fsCam);

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
  beautyRT.dispose(); aoTmpRT.dispose(); aoAccRT.dispose();
  scene.remove(aoLight, aoLight.target);

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
