// Retro Smash Racer — arcade arena game (single player, local records).
// Structure observed in the reference (awards.racing): a top-down arena, a kart
// driven by a ray-cast vehicle (Bullet there, Rapier here), physical props that
// fly when hit and score, collectables, a combo multiplier, stages that recolour
// the floor, nitro and jump. Characters and props are Retro Gamers' own.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type RapierNS from "@dimforge/rapier3d-compat";
import { makeFloor, STAGES } from "./arena";
import { buildKart, KART, loadCarGLB } from "./kart";
import { buildPropModels, coinModel, starModel, type Brand } from "./models";

type Rapier = typeof RapierNS;
type World = RapierNS.World;
type RigidBody = RapierNS.RigidBody;
type Vehicle = RapierNS.DynamicRayCastVehicleController;

export type Phase = "menu" | "playing" | "paused" | "over";
export type Category = Brand;
export const CATEGORIES: Category[] = ["playstation", "xbox", "nintendo", "sega"];
const emptyCats = (): Record<Category, number> => ({ playstation: 0, xbox: 0, nintendo: 0, sega: 0 });

export interface HudState {
  phase: Phase;
  score: number;
  mult: number;
  time: number;
  nitro: number;
  distance: number;
  fps: number;
  stage: number;
  cats: Record<Category, number>;
}

export interface SessionStats {
  score: number;
  smashed: number;
  coins: number;
  bonus: number;
  distance: number;
  duration: number;
  topSpeed: number;
  bestCombo: number;
  stage: number;
}

export interface GameCallbacks {
  hud: (h: HudState) => void;
  feed: (text: string) => void;
  over: (s: SessionStats) => void;
}

const ARENA = 46; // half size
const ROUND = 75; // seconds
const STAGE_EVERY = 25;
const FIXED = 1 / 60;
const MASS = 150;

interface Prop {
  body: RigidBody;
  mesh: THREE.Object3D;
  cat: Category | "bonus";
  points: number;
  state: "idle" | "hit";
  hitAt: number;
}

interface Pickup {
  mesh: THREE.Object3D;
  kind: "coin" | "time";
  active: boolean;
  respawnAt: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class RacerGame {
  private R!: Rapier;
  private world!: World;
  private queue!: RapierNS.EventQueue;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  private sun = new THREE.DirectionalLight(0xffffff, 2.4);
  private floor = makeFloor(ARENA * 6, STAGES[0]);
  private kart = buildKart();
  private chassis!: RigidBody;
  private vehicle!: Vehicle;
  private kartCollider = -1;
  private props: Prop[] = [];
  private propByCollider = new Map<number, Prop>();
  private pickups: Pickup[] = [];
  private keys = new Set<string>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private now = 0;
  private hudAt = 0;
  private frames = 0;
  private fpsAt = 0;
  private fps = 60;
  private steer = 0;
  private flippedFor = 0;
  private jumpReady = 0;
  private popups: { el: HTMLElement; pos: THREE.Vector3; born: number }[] = [];
  private camTarget = new THREE.Vector3();
  private disposed = false;

  phase: Phase = "menu";
  private score = 0;
  private mult = 1;
  private lastHit = -10;
  private combo = 0;
  private time = ROUND;
  private elapsed = 0;
  private nitro = 1;
  private stage = 0;
  private stats: SessionStats = this.freshStats();
  private cats: Record<Category, number> = emptyCats();

  constructor(
    private canvas: HTMLCanvasElement,
    private popLayer: HTMLElement,
    private cb: GameCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  private freshStats(): SessionStats {
    return { score: 0, smashed: 0, coins: 0, bonus: 0, distance: 0, duration: 0, topSpeed: 0, bestCombo: 0, stage: 1 };
  }

  async init() {
    const mod = await import("@dimforge/rapier3d-compat");
    this.R = mod.default;
    await this.R.init();
    if (this.disposed) return;
    const R = this.R;
    this.world = new R.World({ x: 0, y: -22, z: 0 });
    this.queue = new R.EventQueue(true);

    // scene
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.scene.background = new THREE.Color(STAGES[0].sky);
    this.scene.fog = new THREE.Fog(STAGES[0].sky, 70, 150);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x223, 1.1));
    this.sun.position.set(-18, 40, 22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.floor.mesh);

    // ground + walls
    this.world.createCollider(R.ColliderDesc.cuboid(ARENA * 3, 0.5, ARENA * 3).setTranslation(0, -0.5, 0).setFriction(1));
    const curb = new THREE.MeshStandardMaterial({ color: 0xf2f2f6, roughness: 0.5 });
    for (const [x, z, w, d] of [
      [0, ARENA + 0.6, ARENA + 1.2, 0.6],
      [0, -ARENA - 0.6, ARENA + 1.2, 0.6],
      [ARENA + 0.6, 0, 0.6, ARENA + 1.2],
      [-ARENA - 0.6, 0, 0.6, ARENA + 1.2],
    ]) {
      this.world.createCollider(R.ColliderDesc.cuboid(w, 2, d).setTranslation(x, 2, z).setRestitution(0.4));
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 0.35, d * 2), curb);
      m.position.set(x, 0.17, z);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
    }

    this.buildVehicle();
    loadCarGLB(this.kart).then((ok) => ok && this.cb.feed("CARRO CARREGADO"));
    this.buildProps();
    this.buildPickups();
    this.resetKart(0, 0);

    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    window.addEventListener("blur", this.onBlur);
    this.resize();
    window.addEventListener("resize", this.resize);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    (window as unknown as { __racer?: RacerGame }).__racer = this;
  }

  // ---------------------------------------------------------------- vehicle
  private buildVehicle() {
    const R = this.R;
    const h = KART.half;
    this.chassis = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(0, 1.2, 0).setLinearDamping(0.32).setAngularDamping(1.2).setCanSleep(false),
    );
    const vol = 8 * h.x * h.y * h.z;
    const col = this.world.createCollider(
      R.ColliderDesc.cuboid(h.x, h.y, h.z).setDensity(MASS / vol).setFriction(0.4).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      this.chassis,
    );
    this.kartCollider = col.handle;
    this.vehicle = this.world.createVehicleController(this.chassis);
    // axle +Z with up +Y makes positive engine force drive towards +X
    KART.wheels.forEach((w, i) => {
      this.vehicle.addWheel({ x: w.x, y: KART.connY, z: w.z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, KART.rest, KART.wheelRadius);
      this.vehicle.setWheelSuspensionStiffness(i, 32);
      this.vehicle.setWheelSuspensionCompression(i, 3.2);
      this.vehicle.setWheelSuspensionRelaxation(i, 3.8);
      this.vehicle.setWheelMaxSuspensionTravel(i, 0.25);
      this.vehicle.setWheelFrictionSlip(i, 2.4);
      this.vehicle.setWheelSideFrictionStiffness(i, 1.1);
    });
    this.scene.add(this.kart.root);
  }

  private resetKart(x: number, z: number, yaw = 0) {
    this.chassis.setTranslation({ x, y: 1.2, z }, true);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.chassis.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  // ------------------------------------------------------------------ props
  private buildProps() {
    const R = this.R;
    for (const model of buildPropModels()) {
      const c = model.collider;
      for (let i = 0; i < model.count; i++) {
        const mesh = model.object.clone();
        this.scene.add(mesh);
        const body = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setLinearDamping(0.3).setAngularDamping(0.4));
        const desc = c.kind === "ball" ? R.ColliderDesc.ball(c.r) : R.ColliderDesc.cuboid(c.hx, c.hy, c.hz);
        const col = this.world.createCollider(
          desc.setDensity(model.brand === "bonus" ? 2.5 : 1.6).setFriction(0.6).setRestitution(0.3).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
          body,
        );
        const prop: Prop = { body, mesh, cat: model.brand, points: model.points, state: "idle", hitAt: 0 };
        this.propByCollider.set(col.handle, prop);
        this.props.push(prop);
        this.placeProp(prop, 1.5);
      }
    }
  }

  private placeProp(p: Prop, y: number) {
    let x = 0, z = 0;
    do {
      x = rand(-ARENA + 3, ARENA - 3);
      z = rand(-ARENA + 3, ARENA - 3);
    } while (Math.hypot(x, z) < 7);
    p.body.setTranslation({ x, y, z }, true);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand(0, Math.PI * 2), 0));
    p.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    p.state = "idle";
    p.mesh.scale.setScalar(1);
  }

  // ---------------------------------------------------------------- pickups
  private buildPickups() {
    const coin = coinModel();
    const star = starModel();
    const make = (kind: Pickup["kind"]) => {
      const g = new THREE.Group();
      g.add((kind === "coin" ? coin : star).clone());
      this.scene.add(g);
      const p: Pickup = { mesh: g, kind, active: true, respawnAt: 0 };
      this.placePickup(p);
      this.pickups.push(p);
    };
    for (let i = 0; i < 8; i++) make("coin");
    for (let i = 0; i < 3; i++) make("time");
  }

  private placePickup(p: Pickup) {
    p.mesh.position.set(rand(-ARENA + 4, ARENA - 4), 1.3, rand(-ARENA + 4, ARENA - 4));
    p.mesh.visible = true;
    p.active = true;
  }

  // ------------------------------------------------------------------ input
  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (e.type === "keydown") {
      if (!this.keys.has(k)) this.press(k);
      this.keys.add(k);
    } else this.keys.delete(k);
  };
  private onBlur = () => this.keys.clear();

  private press(k: string) {
    if (k === "enter" && this.phase === "menu") this.start();
    else if (k === "r" && (this.phase === "playing" || this.phase === "over" || this.phase === "paused")) this.start();
    else if ((k === "p" || k === "escape") && this.phase === "playing") this.setPhase("paused");
    else if ((k === "p" || k === "enter") && this.phase === "paused") this.setPhase("playing");
    else if (k === "escape" && (this.phase === "over" || this.phase === "paused")) this.toMenu();
    else if (k === " " && this.phase === "playing") this.jump();
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.emitHud(true);
  }

  start() {
    this.score = 0;
    this.mult = 1;
    this.combo = 0;
    this.time = ROUND;
    this.elapsed = 0;
    this.nitro = 1;
    this.stats = this.freshStats();
    this.cats = emptyCats();
    this.setStage(0);
    this.props.forEach((p) => this.placeProp(p, rand(1, 4)));
    this.pickups.forEach((p) => this.placePickup(p));
    this.resetKart(0, 0);
    this.setPhase("playing");
    this.cb.feed("PARTIDA INICIADA");
  }

  toMenu() {
    this.setPhase("menu");
  }

  private jump() {
    if (this.now < this.jumpReady) return;
    let contact = false;
    for (let i = 0; i < 4; i++) contact ||= this.vehicle.wheelIsInContact(i);
    if (!contact) return;
    this.chassis.applyImpulse({ x: 0, y: MASS * 8.5, z: 0 }, true);
    this.jumpReady = this.now + 0.7;
  }

  private setStage(i: number) {
    this.stage = i;
    const t = STAGES[i % STAGES.length];
    this.floor.setTheme(t);
    (this.scene.background as THREE.Color).set(t.sky);
    this.scene.fog!.color.set(t.sky);
  }

  // ------------------------------------------------------------------- loop
  private tick = (t: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    if (this.phase !== "paused") {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED && steps < 5) {
        this.step(FIXED);
        this.acc -= FIXED;
        steps++;
      }
    }
    this.render(dt);
    this.frames++;
    if (t - this.fpsAt > 500) {
      this.fps = Math.round((this.frames * 1000) / (t - this.fpsAt));
      this.frames = 0;
      this.fpsAt = t;
    }
    if (t - this.hudAt > 66) {
      this.hudAt = t;
      this.emitHud();
    }
  };

  private step(dt: number) {
    this.now += dt;
    const playing = this.phase === "playing";
    const k = this.keys;
    const up = playing && (k.has("arrowup") || k.has("w"));
    const down = playing && (k.has("arrowdown") || k.has("s"));
    const left = playing && (k.has("arrowleft") || k.has("a"));
    const right = playing && (k.has("arrowright") || k.has("d"));
    const boost = playing && k.has("shift") && this.nitro > 0.02;

    const speed = this.vehicle.currentVehicleSpeed();
    const target = (left ? 1 : 0) - (right ? 1 : 0);
    const maxSteer = 0.55 - Math.min(0.3, Math.abs(speed) * 0.012);
    this.steer += (target * maxSteer - this.steer) * Math.min(1, dt * 10);
    let engine = 0, brake = 0;
    if (up) engine = boost ? 720 : 380;
    else if (down) {
      if (speed > 1.5) brake = 6;
      else engine = -260;
    } else brake = 0.6;
    for (let i = 0; i < 4; i++) {
      this.vehicle.setWheelSteering(i, KART.wheels[i].front ? this.steer : 0);
      this.vehicle.setWheelEngineForce(i, engine);
      this.vehicle.setWheelBrake(i, brake);
    }
    if (boost) {
      this.nitro = Math.max(0, this.nitro - dt * 0.45);
      const fwd = this.forward();
      this.chassis.applyImpulse({ x: fwd.x * MASS * 0.18, y: 0, z: fwd.z * MASS * 0.18 }, true);
    } else if (playing) this.nitro = Math.min(1, this.nitro + dt * 0.12);

    this.vehicle.updateVehicle(dt);
    this.world.step(this.queue);
    this.queue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const other = h1 === this.kartCollider ? h2 : h2 === this.kartCollider ? h1 : -1;
      if (other < 0) return;
      const prop = this.propByCollider.get(other);
      if (prop) this.hitProp(prop);
    });

    // flipped / fallen: put the kart back on its wheels
    const pos = this.chassis.translation();
    const rot = this.chassis.rotation();
    const upY = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)).y;
    this.flippedFor = upY < 0.35 ? this.flippedFor + dt : 0;
    if (this.flippedFor > 1.4 || pos.y < -8 || Math.abs(pos.x) > ARENA + 4 || Math.abs(pos.z) > ARENA + 4) {
      const yaw = Math.atan2(-this.forward().z, this.forward().x);
      this.resetKart(THREE.MathUtils.clamp(pos.x, -ARENA + 3, ARENA - 3), THREE.MathUtils.clamp(pos.z, -ARENA + 3, ARENA - 3), yaw);
      this.flippedFor = 0;
    }

    // props: respawn a while after being smashed
    for (const p of this.props) {
      const tp = p.body.translation();
      if (p.state === "hit" && this.now - p.hitAt > 5) this.placeProp(p, rand(6, 10));
      else if (tp.y < -10) this.placeProp(p, rand(6, 10));
    }

    if (!playing) return;
    const v = this.chassis.linvel();
    const sp = Math.hypot(v.x, v.z);
    this.stats.distance += sp * dt;
    this.stats.topSpeed = Math.max(this.stats.topSpeed, sp);
    this.elapsed += dt;
    this.time -= dt;
    if (this.now - this.lastHit > 2.2) {
      this.mult = Math.max(1, this.mult - dt * 0.6);
      this.combo = 0;
    }
    const st = Math.floor(this.elapsed / STAGE_EVERY);
    if (st !== this.stage && st < STAGES.length) {
      this.setStage(st);
      this.cb.feed(`FASE ${st + 1}`);
    }

    // pickups
    for (const p of this.pickups) {
      if (!p.active) {
        if (this.now > p.respawnAt) this.placePickup(p);
        continue;
      }
      const d = Math.hypot(p.mesh.position.x - pos.x, p.mesh.position.z - pos.z);
      if (d < 1.9 && pos.y < 3.5) {
        p.active = false;
        p.mesh.visible = false;
        p.respawnAt = this.now + 5;
        if (p.kind === "coin") {
          const pts = Math.round(5 * this.mult);
          this.score += pts;
          this.stats.coins++;
          this.popup(`+${pts}`, p.mesh.position);
          this.cb.feed("MOEDA COLETADA");
        } else {
          this.time += 5;
          this.popup("+5s", p.mesh.position);
          this.cb.feed("ESTRELA +5S");
        }
      }
    }

    if (this.time <= 0) {
      this.time = 0;
      this.stats.score = this.score;
      this.stats.duration = this.elapsed;
      this.stats.stage = this.stage + 1;
      this.setPhase("over");
      this.cb.over({ ...this.stats });
    }
  }

  private forward() {
    const r = this.chassis.rotation();
    return new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  }

  private hitProp(p: Prop) {
    if (this.phase !== "playing" || p.state !== "idle") return;
    const v = this.chassis.linvel();
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp < 2.5) return;
    p.state = "hit";
    p.hitAt = this.now;
    // send it flying away from the kart
    const a = this.chassis.translation(), b = p.body.translation();
    const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    const m = p.body.mass();
    p.body.applyImpulse({ x: dir.x * m * sp * 0.6, y: m * (4 + sp * 0.35), z: dir.z * m * sp * 0.6 }, true);
    p.body.applyTorqueImpulse({ x: rand(-1, 1) * m, y: rand(-1, 1) * m, z: rand(-1, 1) * m }, true);

    this.combo++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    if (this.now - this.lastHit < 2.2) this.mult = Math.min(3, this.mult + 0.1);
    this.lastHit = this.now;
    const pts = Math.max(1, Math.round(p.points * this.mult));
    this.score += pts;
    this.stats.smashed++;
    if (p.cat === "bonus") {
      this.stats.bonus++;
      this.cb.feed("BLOCO ? DERRUBADO");
    } else this.cats[p.cat]++;
    this.popup(`+${pts}`, new THREE.Vector3(b.x, b.y + 1, b.z));
  }

  // -------------------------------------------------------------- rendering
  private render(dt: number) {
    const pos = this.chassis.translation();
    const rot = this.chassis.rotation();
    this.kart.root.position.set(pos.x, pos.y, pos.z);
    this.kart.root.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    KART.wheels.forEach((w, i) => {
      const g = this.kart.wheels[i];
      const susp = this.vehicle.wheelSuspensionLength(i) ?? KART.rest;
      g.position.y = KART.connY - susp;
      g.rotation.y = this.vehicle.wheelSteering(i) ?? 0;
      (g.userData.spin as THREE.Object3D).rotation.z = -(this.vehicle.wheelRotation(i) ?? 0);
    });
    for (const p of this.props) {
      const t = p.body.translation(), r = p.body.rotation();
      p.mesh.position.set(t.x, t.y, t.z);
      p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    const spin = performance.now() / 1000;
    for (const p of this.pickups) if (p.active) {
      p.mesh.rotation.y = spin * 2.4;
      p.mesh.position.y = 1.3 + Math.sin(spin * 3 + p.mesh.position.x) * 0.2;
    }

    // camera: fixed heading, follows the kart from above (reference framing)
    const menu = this.phase === "menu";
    const v = this.chassis.linvel();
    const lead = new THREE.Vector3(v.x, 0, v.z).multiplyScalar(0.25);
    const want = new THREE.Vector3(pos.x, 0, pos.z).add(lead);
    this.camTarget.lerp(want, Math.min(1, dt * 4));
    const sp = Math.hypot(v.x, v.z);
    const dist = menu ? 15 : 24 + Math.min(8, sp * 0.25);
    const ang = menu ? spin * 0.15 : 0;
    const off = new THREE.Vector3(Math.sin(ang) * 0.62, 1, Math.cos(ang) * 0.62).normalize().multiplyScalar(dist);
    this.camera.position.copy(this.camTarget).add(off);
    this.camera.lookAt(this.camTarget.x, menu ? 0.8 : 0, this.camTarget.z);
    this.sun.position.set(this.camTarget.x - 18, 40, this.camTarget.z + 22);
    this.sun.target.position.copy(this.camTarget);

    this.renderer.render(this.scene, this.camera);
    this.updatePopups();
  }

  private popup(text: string, at: THREE.Vector3 | { x: number; y: number; z: number }) {
    const el = document.createElement("span");
    el.textContent = text;
    el.className = "rsr-pop";
    this.popLayer.appendChild(el);
    this.popups.push({ el, pos: new THREE.Vector3(at.x, at.y, at.z), born: performance.now() });
  }

  private updatePopups() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const now = performance.now();
    this.popups = this.popups.filter((p) => {
      const age = (now - p.born) / 900;
      if (age >= 1) {
        p.el.remove();
        return false;
      }
      const s = p.pos.clone().project(this.camera);
      const x = (s.x * 0.5 + 0.5) * w, y = (-s.y * 0.5 + 0.5) * h - age * 46;
      p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + Math.sin(Math.min(1, age * 4) * Math.PI) * 0.25})`;
      p.el.style.opacity = String(1 - Math.max(0, age - 0.6) / 0.4);
      return true;
    });
  }

  private emitHud(force = false) {
    if (!force && this.phase === "menu" && this.frames % 2) return;
    this.cb.hud({
      phase: this.phase,
      score: this.score,
      mult: this.mult,
      time: this.time,
      nitro: this.nitro,
      distance: this.stats.distance,
      fps: this.fps,
      stage: this.stage,
      cats: { ...this.cats },
    });
  }

  private resize = () => {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.resize);
    this.popups.forEach((p) => p.el.remove());
    this.renderer.dispose();
    this.world?.free();
    const w = window as unknown as { __racer?: RacerGame };
    if (w.__racer === this) delete w.__racer;
  }
}
