// Arena floor: large irregular cells outlined by thick light lines, like the
// reference's stage floor (OBSERVADO: blue stage, then a pink one), drawn as a
// Voronoi border shader so it costs one quad.
import * as THREE from "three";

export interface StageTheme {
  name: string;
  floor: string;
  line: string;
  sky: string;
}

// sampled from the reference frames (stage 1 blue, stage 2 pink)
export const STAGES: StageTheme[] = [
  { name: "azul", floor: "#1b1e91", line: "#e9e9f4", sky: "#141884" },
  { name: "rosa", floor: "#4a1e2b", line: "#d4246d", sky: "#2a0f19" },
  { name: "verde", floor: "#123d2a", line: "#7cf2b0", sky: "#0b2419" },
];

const vertex = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec3 objectNormal = vec3(0.0, 1.0, 0.0);
  vec3 transformedNormal = normalMatrix * objectNormal;
  vec4 worldPosition = world;
  #include <shadowmap_vertex>
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragment = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
uniform vec3 uFloor;
uniform vec3 uLine;
uniform float uScale;
uniform float uWidth;
varying vec3 vWorld;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// distance to the nearest Voronoi border (Inigo Quilez)
float voronoiBorder(vec2 x) {
  vec2 n = floor(x), f = fract(x);
  vec2 mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.15 + 0.7 * hash2(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 o = 0.15 + 0.7 * hash2(n + g);
    vec2 r = g + o - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}
float grain(vec2 p) { return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 p = vWorld.xz / uScale;
  float d = voronoiBorder(p) * uScale;
  float aa = fwidth(d) * 1.2;
  float line = 1.0 - smoothstep(uWidth - aa, uWidth + aa, d);
  vec3 col = mix(uFloor, uLine, line);
  // woven fabric grain (the reference floor uses fabric normal maps)
  col *= 0.94 + 0.06 * grain(vWorld.xz * 18.0);
  float shadow = getShadowMask();
  col *= mix(0.55, 1.0, shadow);
  // flat stage colour (no tone mapping) so the floor matches the sampled hex values
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function makeFloor(size: number, theme: StageTheme) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.lights,
    {
      uFloor: { value: new THREE.Color(theme.floor) },
      uLine: { value: new THREE.Color(theme.line) },
      uScale: { value: 9 },
      uWidth: { value: 0.32 },
    },
  ]);
  const mat = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, lights: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return {
    mesh,
    setTheme(t: StageTheme) {
      (uniforms.uFloor.value as THREE.Color).set(t.floor);
      (uniforms.uLine.value as THREE.Color).set(t.line);
    },
  };
}
