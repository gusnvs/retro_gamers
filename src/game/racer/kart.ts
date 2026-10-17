// Player car. Default: a curved red convertible modelled in code after the
// client's reference ("HCR2 Sports Car" on Sketchfab, by oakar258, CC BY 4.0).
// When that GLB is placed at public/game/hcr2_sports_car.glb it replaces the
// coded body (see loadCarGLB). The Retro Gamers invader drives.
// Forward is +X, up is +Y (Rapier's ray-cast vehicle defaults).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SPRITES } from "./sprites";

export const KART = {
  half: { x: 1.4, y: 0.3, z: 0.8 },
  wheelRadius: 0.42,
  wheelWidth: 0.34,
  wheels: [
    { x: 0.95, z: 0.8, front: true },
    { x: 0.95, z: -0.8, front: true },
    { x: -0.95, z: 0.8, front: false },
    { x: -0.95, z: -0.8, front: false },
  ],
  /** suspension mount (chassis space) and rest length: wheel centre = connY - suspension */
  connY: 0.2,
  rest: 0.45,
  /** body profile is drawn with the arch centres at y = 0.2; shift into chassis space */
  bodyY: -0.45,
};

export const CAR_GLB = "/game/hcr2_sports_car.glb";

const glossy = (color: THREE.ColorRepresentation) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });

function bodyProfile() {
  const s = new THREE.Shape();
  const y0 = 0.2, r = 0.5;
  s.moveTo(-1.42, y0);
  s.lineTo(-0.95 - r, y0);
  s.absarc(-0.95, y0, r, Math.PI, 0, true); // rear arch
  s.lineTo(0.95 - r, y0);
  s.absarc(0.95, y0, r, Math.PI, 0, true); // front arch
  s.lineTo(1.42, y0);
  s.quadraticCurveTo(1.6, 0.26, 1.56, 0.46); // front bumper
  s.quadraticCurveTo(1.46, 0.7, 0.95, 0.74); // nose into the hood
  s.quadraticCurveTo(0.6, 0.78, 0.32, 0.76); // hood
  s.quadraticCurveTo(0.22, 0.62, 0.05, 0.6); // cowl into the cockpit
  s.lineTo(-0.7, 0.6); // door line
  s.quadraticCurveTo(-0.85, 0.6, -0.9, 0.7);
  s.quadraticCurveTo(-1.2, 0.76, -1.4, 0.72); // rear deck
  s.quadraticCurveTo(-1.58, 0.64, -1.56, 0.42); // tail
  s.quadraticCurveTo(-1.55, 0.24, -1.42, y0);
  return s;
}

export function buildKart() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = KART.bodyY;
  root.add(body);
  const red = glossy(0xe0262b);
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 0.9, roughness: 0.2 });
  const tan = new THREE.MeshStandardMaterial({ color: 0xb98a3c, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.6 });
  const cast = <T extends THREE.Object3D>(o: T) => {
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true;
    });
    return o;
  };

  // main shell: side profile extruded across the width with a big round bevel
  const width = 1.38, bev = 0.16;
  const shellGeo = new THREE.ExtrudeGeometry(bodyProfile(), {
    depth: width - bev * 2,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev * 0.9,
    bevelSegments: 6,
    curveSegments: 28,
  });
  shellGeo.translate(0, 0, -(width - bev * 2) / 2);
  body.add(cast(new THREE.Mesh(shellGeo, red)));

  // cockpit floor + seats
  const floor = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.08, 1.08, 2, 0.03), dark);
  floor.position.set(-0.35, 0.62, 0);
  body.add(floor);
  for (const z of [0.3, -0.3]) {
    const base = cast(new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.14, 0.42, 3, 0.06), tan));
    base.position.set(-0.3, 0.7, z);
    const back = cast(new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.5, 0.42, 3, 0.06), tan));
    back.position.set(-0.55, 0.9, z);
    back.rotation.z = 0.18;
    body.add(base, back);
  }
  // windshield: chrome frame + tinted glass
  const frame = new THREE.Shape();
  frame.moveTo(-0.66, 0);
  frame.lineTo(0.66, 0);
  frame.lineTo(0.62, 0.46);
  frame.quadraticCurveTo(0.6, 0.5, 0.55, 0.5);
  frame.lineTo(-0.55, 0.5);
  frame.quadraticCurveTo(-0.6, 0.5, -0.62, 0.46);
  frame.closePath();
  const inner = new THREE.Path();
  inner.moveTo(-0.58, 0.04);
  inner.lineTo(0.58, 0.04);
  inner.lineTo(0.55, 0.43);
  inner.lineTo(-0.55, 0.43);
  inner.closePath();
  frame.holes.push(inner);
  const ws = new THREE.Group();
  ws.add(cast(new THREE.Mesh(new THREE.ExtrudeGeometry(frame, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }), chrome)));
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.14, 0.4),
    new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0, clearcoat: 1 }),
  );
  glass.position.set(0, 0.235, 0.02);
  ws.add(glass);
  ws.rotation.y = -Math.PI / 2;
  ws.rotation.z = 0;
  const wsPivot = new THREE.Group();
  wsPivot.add(ws);
  wsPivot.rotation.z = 0.5; // raked back
  wsPivot.position.set(0.18, 0.66, 0);
  body.add(wsPivot);
  // bumpers + grille + lights
  for (const [x, w] of [[1.6, 0.1], [-1.6, 0.1]] as const) {
    const b = cast(new THREE.Mesh(new RoundedBoxGeometry(w, 0.14, 1.36, 3, 0.05), chrome));
    b.position.set(x, 0.3, 0);
    body.add(b);
  }
  const grille = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.16, 0.6, 2, 0.03), dark);
  grille.position.set(1.57, 0.45, 0);
  body.add(grille);
  const lamp = new THREE.MeshPhysicalMaterial({ color: 0xc8f3ff, emissive: 0x9fe8ff, emissiveIntensity: 1.2, roughness: 0.05, clearcoat: 1 });
  for (const z of [0.47, -0.47]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), lamp);
    l.scale.x = 0.55;
    l.position.set(1.55, 0.52, z);
    body.add(l);
  }
  const tail = new THREE.MeshStandardMaterial({ color: 0xff2a3a, emissive: 0xff1030, emissiveIntensity: 1.2 });
  for (const z of [0.5, -0.5]) {
    const l = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.08, 0.2, 2, 0.02), tail);
    l.position.set(-1.58, 0.56, z);
    body.add(l);
  }

  // driver: voxel invader, white front/back faces and blue sides (brand logo)
  const blue = glossy(0x3da9f4), white = glossy(0xf4f4f0);
  const rows = SPRITES.invader;
  const vox = 0.06;
  const voxGeo = new THREE.BoxGeometry(vox * 2.2, vox * 0.98, vox * 0.98);
  const faces = [white, white, blue, blue, blue, blue];
  const driver = new THREE.Group();
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      if (r[i] !== "X") continue;
      const v = cast(new THREE.Mesh(voxGeo, faces));
      v.position.set(0, (rows.length - j) * vox, (i - (r.length - 1) / 2) * vox);
      driver.add(v);
    }
  });
  driver.position.set(-0.32, 0.72, 0.3);
  body.add(driver);

  // wheels: rounded tyre (lathe) + dished chrome rim
  const R = KART.wheelRadius, W = KART.wheelWidth;
  const tyrePts = [
    new THREE.Vector2(R * 0.62, -W / 2),
    new THREE.Vector2(R * 0.9, -W / 2),
    new THREE.Vector2(R, -W / 2 + 0.06),
    new THREE.Vector2(R, W / 2 - 0.06),
    new THREE.Vector2(R * 0.9, W / 2),
    new THREE.Vector2(R * 0.62, W / 2),
  ];
  const tyreGeo = new THREE.LatheGeometry(tyrePts, 32);
  tyreGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(R * 0.64, R * 0.58, W * 0.9, 24);
  rimGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(R * 0.2, R * 0.2, W, 12);
  hubGeo.rotateX(Math.PI / 2);
  const tyreM = new THREE.MeshStandardMaterial({ color: 0x2a2b2f, roughness: 0.85 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 0.8, roughness: 0.3 });
  const wheels = KART.wheels.map((w) => {
    const g = new THREE.Group();
    const spin = new THREE.Group();
    spin.add(cast(new THREE.Mesh(tyreGeo, tyreM)), new THREE.Mesh(rimGeo, rimM), new THREE.Mesh(hubGeo, chrome));
    g.add(spin);
    g.userData.spin = spin;
    g.position.set(w.x, KART.connY - KART.rest, w.z);
    root.add(g);
    return g;
  });

  return { root, body, wheels, driver };
}

/**
 * Swap the coded body for the downloaded GLB when it exists. The model is
 * normalised to the chassis length and dropped onto the wheel line; if it has
 * its own wheels, the coded wheels are hidden.
 */
export async function loadCarGLB(kart: ReturnType<typeof buildKart>) {
  try {
    const head = await fetch(CAR_GLB, { method: "HEAD" });
    if (!head.ok || !(head.headers.get("content-type") || "").match(/gltf|octet|model/)) return false;
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(CAR_GLB);
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    // the longest horizontal axis is the car's length; turn it onto +X
    if (size.z > size.x) model.rotation.y = Math.PI / 2;
    model.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(model);
    const s2 = b2.getSize(new THREE.Vector3());
    const k = 3.2 / Math.max(s2.x, s2.z);
    model.scale.multiplyScalar(k);
    model.updateMatrixWorld(true);
    const b3 = new THREE.Box3().setFromObject(model);
    const c = b3.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(c.x, b3.min.y, c.z));
    let hasWheels = false;
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
      if (/wheel|tire|tyre|rim/i.test(o.name)) hasWheels = true;
    });
    const holder = new THREE.Group();
    holder.add(model);
    holder.position.y = KART.connY - KART.rest - KART.wheelRadius; // ground under the wheels
    kart.body.visible = false;
    kart.root.add(holder);
    if (hasWheels) kart.wheels.forEach((w) => (w.visible = false));
    return true;
  } catch {
    return false;
  }
}
