// Port of the reference "SceneTransition.fs" (dot-grid page transition).
// The "to" scene is the real new page, already mounted underneath: this quad draws
// the "from" scene (a snapshot of the old page, uMode 0) or the black first frame
// (uMode 1) outside the dot mask and the rainbow rim on its edge, and is
// transparent inside the mask. At uTransition = 1 the quad is fully transparent,
// so removing it is invisible — exactly like the reference swapping shaders.

export const sceneVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const sceneFragment = /* glsl */ `
uniform sampler2D tFrom;
uniform float uVelocity;
uniform vec2 resolution;
uniform float time;
uniform vec2 uMousePosition;
uniform float uTransition;
uniform float uFirst;
uniform float uBlur;
uniform float uSize2;
uniform float uZoom;
uniform float uMode;
uniform float uFade;

varying vec2 vUv;

float range(float oldValue, float oldMin, float oldMax, float newMin, float newMax) {
  vec3 sub = vec3(oldValue, newMax, oldMax) - vec3(oldMin, newMin, oldMin);
  return sub.x * sub.y / sub.z + newMin;
}
float crange(float oldValue, float oldMin, float oldMax, float newMin, float newMax) {
  return clamp(range(oldValue, oldMin, oldMax, newMin, newMax), min(newMin, newMax), max(newMin, newMax));
}
vec2 rotateUV(vec2 uv, float r, vec2 origin) {
  float c = cos(r);
  float s = sin(r);
  mat2 m = mat2(c, -s, s, c);
  vec2 st = uv - origin;
  st = m * st;
  return st + origin;
}
vec2 scaleUV(vec2 uv, vec2 scale, vec2 origin) {
  vec2 st = uv - origin;
  st /= scale;
  return st + origin;
}
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float createDot(vec2 uv, vec2 transition, float size, float blur) {
  vec2 repeat = vec2(3., 3.);
  vec2 uvMod = mod(uv + transition, repeat) - repeat*0.5;
  return 1. - smoothstep(size - blur - 0.02, size + blur + 0.02, length(uvMod));
}

float circleExp(vec2 position, float scale) {
  vec2 normalizedScreen = vec2(resolution.x/resolution.y, 1.0);
  vec2 uv = gl_FragCoord.xy/resolution.y;
  vec2 offset = vec2(position.x, 1. - position.y) * normalizedScreen;
  float circleRadius = 0.2 * scale;
  float distanceToCenter = length(uv - offset);
  float edgeSmoothness = 0.8;
  return 1.0 - smoothstep(circleRadius - edgeSmoothness, circleRadius, distanceToCenter);
}

vec3 rgbShift(sampler2D tDiffuse, vec2 uv, float angle, float amount) {
  vec2 offset = vec2(cos(angle), sin(angle)) * amount;
  float r = texture2D(tDiffuse, uv + offset).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv - offset).b;
  return vec3(r, g, b);
}

vec2 applyCRTEffect(vec2 uv, float barrelAmount, float pincushionAmount) {
  if (barrelAmount > 0. || pincushionAmount > 0.) {
    uv = 2.0 * uv - 1.0;
    uv *= 1.0 + length(uv) * barrelAmount;
    uv = 0.5 * (uv + 1.0);
    uv = uv * 2.0 - 1.0;
    uv *= 1.0 + uv.x * uv.x * pincushionAmount;
    uv = 0.5 * (uv + 1.0);
  }
  return uv;
}

void main() {
  const float uSize = 1.;
  const float uSize0 = 0.35;
  const float uSize1 = 0.35;
  const float uBlur0 = 0.55;
  const float uBlur1 = 0.55;
  const float uBlur2 = 0.;

  vec2 screenUV = (gl_FragCoord.xy / resolution.xy);
  float ratio = resolution.x / resolution.y;
  vec2 squareUV = vUv / vec2(1., ratio);
  vec2 uv = vUv;

  vec2 mousePos = mix(uMousePosition, vec2(0.5), uFirst);

  float zoom = uZoom;
  float dots = -0.1;
  vec2 dotUV = scaleUV(squareUV, vec2(1.0 + uTransition * 1.0), mousePos);
  vec2 uvMod = mix(applyCRTEffect(squareUV, .1, -.1), dotUV, uTransition) * zoom;
  float size = uSize * crange(uTransition, 0., 1., 0., 2.0);
  float dotx = circleExp(mousePos, crange(uTransition, 0., 1., 0., 15.));
  float sizeDotX = size * dotx;
  float bb1 = uBlur0 * uBlur;
  float bb2 = uBlur1 * uBlur;
  float bb3 = uBlur2 * uBlur;
  float size1 = uSize0 * sizeDotX;
  float size2 = uSize1 * sizeDotX;
  float size3 = uSize2 * sizeDotX;

  for (float i = 0.0; i < 3.; i++) {
    vec2 p = uvMod + vec2(i, 0.);
    dots += createDot(p, vec2(0., i), size1, bb1);
    dots += createDot(p, vec2(1., i), size2, bb2);
    dots += createDot(p, vec2(2., i), size3, bb3);
  }
  dots *= smoothstep(1.0, 0.6, uTransition);

  vec2 scaleOrigin = mousePos;
  scaleOrigin = mix(scaleOrigin, vec2(0.5), 0.2);
  scaleOrigin.y += 0.2 - uTransition * 0.5;

  vec2 uvFrom = mix(uv, applyCRTEffect(uv, 0.1, -.1), uTransition);
  uvFrom = scaleUV(uvFrom, vec2(1.0 + uTransition * 1.2), scaleOrigin);
  uvFrom = rotateUV(uvFrom, -uTransition * mousePos.x * 0.3, vec2(0.5));
  vec3 from = rgbShift(tFrom, uvFrom, radians(90.0), 0.01 * uTransition + uVelocity * 0.0001);
  if (from == vec3(0.0)) from = vec3(16. / 300.);

  vec3 rainbow = vec3(1.0, 0.15, 0.15);
  rainbow = rgb2hsv(rainbow);
  rainbow.x += (0.5 + sin(time*0.2 - length(screenUV-mousePos) * 6.0 + uTransition * 5.0 + dots * 8.0 + dotx * 2.0));
  rainbow = hsv2rgb(rainbow);
  float offsetRainbow = mix(0.15, 0.1, smoothstep(0.2, 1.0, length(screenUV-mousePos)));
  float fadeRainbow = smoothstep(0.52, 0.2, uTransition);

  float v = dots + dotx * 0.5;
  float mask = step(0.5, v);
  float ring = (1.0 - step(0.5 + offsetRainbow * fadeRainbow, v)) * mask;

  if (uMode > 0.5) from = vec3(16. / 255.); // first load: black "from" scene
  vec4 outColor = vec4(mix(from, rainbow, ring), max(1.0 - mask, ring));
  outColor.a *= uFade;
  gl_FragColor = outColor;
}
`;
