// Kart model (original): smurf-blue body, white stripe and the Retro Gamers
// invader as the driver (white faces, blue sides, like the brand logo).
// Forward is +X, up is +Y (Rapier's ray-cast vehicle defaults).
import * as THREE from "three";
import { SPRITES } from "./sprites";

const BRAND = 0x3da9f4;

export const KART = {
  half: { x: 1.05, y: 0.28, z: 0.62 },
  wheelRadius: 0.36,
  wheelWidth: 0.3,
  wheels: [
    { x: 0.72, z: 0.68, front: true },
    { x: 0.72, z: -0.68, front: true },
    { x: -0.72, z: 0.68, front: false },
    { x: -0.72, z: -0.68, front: false },
  ],
  /** suspension mount (chassis space) and rest length: wheel centre = connY - suspension */
  connY: 0.12,
  rest: 0.45,
};

export function buildKart() {
  const root = new THREE.Group();
  const body = new THREE.MeshPhysicalMaterial({ color: BRAND, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f0, roughness: 0.4, clearcoat: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 1.5 });
  const cast = (m: THREE.Mesh) => ((m.castShadow = true), (m.receiveShadow = true), m);
  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };

  // chassis: tub + nose + side pods
  box(2.0, 0.34, 1.12, body, 0, 0, 0);
  box(0.62, 0.22, 0.9, body, 1.12, -0.04, 0).rotation.z = -0.18;
  box(2.02, 0.08, 0.3, white, 0, 0.17, 0);
  box(0.5, 0.06, 1.3, dark, 1.32, -0.13, 0); // front wing
  // rear spoiler
  box(0.12, 0.42, 0.08, dark, -0.95, 0.38, 0.38);
  box(0.12, 0.42, 0.08, dark, -0.95, 0.38, -0.38);
  box(0.42, 0.07, 1.34, body, -1.0, 0.6, 0);
  // lights
  box(0.04, 0.1, 0.18, glow, 1.43, 0.02, 0.32);
  box(0.04, 0.1, 0.18, glow, 1.43, 0.02, -0.32);
  box(0.04, 0.08, 0.3, red, -1.01, 0.08, 0);

  // driver: voxel invader, white front faces and blue sides
  // sprite columns run along Z (width), rows along Y, the slab is deep along X;
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  const rows = SPRITES.invader;
  const vox = 0.085;
  const faces = [white, white, body, body, body, body];
  const voxGeo = new THREE.BoxGeometry(vox * 2.2, vox * 0.98, vox * 0.98);
  const driver = new THREE.Group();
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      if (r[i] !== "X") continue;
      const v = cast(new THREE.Mesh(voxGeo, faces));
      v.position.set(0, (rows.length - j) * vox, (i - (r.length - 1) / 2) * vox);
      driver.add(v);
    }
  });
  driver.position.set(-0.3, 0.12, 0);
  root.add(driver);

  // wheels
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.85 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xe9eef4, metalness: 0.8, roughness: 0.25 });
  const wheels = KART.wheels.map((w) => {
    const g = new THREE.Group();
    const t = cast(new THREE.Mesh(new THREE.CylinderGeometry(KART.wheelRadius, KART.wheelRadius, KART.wheelWidth, 20), tyre));
    t.rotation.x = Math.PI / 2;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(KART.wheelRadius * 0.55, KART.wheelRadius * 0.55, KART.wheelWidth + 0.02, 6), rim);
    r.rotation.x = Math.PI / 2;
    const spin = new THREE.Group();
    spin.add(t, r);
    g.add(spin);
    g.userData.spin = spin;
    g.position.set(w.x, KART.connY - KART.rest, w.z);
    root.add(g);
    return g;
  });

  return { root, wheels, driver };
}
