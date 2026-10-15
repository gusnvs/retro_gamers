// Port of the reference "MotionVectorShader" (Hydra) to three.js ShaderMaterial.
// Logic, constants and uniform names are kept 1:1; only engine-specific pragmas
// (#require / #test) were replaced by inlined helpers and the DESKTOP define.

const helpers = /* glsl */ `
float range(float oldValue, float oldMin, float oldMax, float newMin, float newMax) {
  vec3 sub = vec3(oldValue, newMax, oldMax) - vec3(oldMin, newMin, oldMin);
  return sub.x * sub.y / sub.z + newMin;
}
vec2 range(vec2 oldValue, vec2 oldMin, vec2 oldMax, vec2 newMin, vec2 newMax) {
  vec2 oldRange = oldMax - oldMin;
  vec2 newRange = newMax - newMin;
  vec2 val = oldValue - oldMin;
  return val * newRange / oldRange + newMin;
}
float crange(float oldValue, float oldMin, float oldMax, float newMin, float newMax) {
  return clamp(range(oldValue, oldMin, oldMax, newMin, newMax), min(newMin, newMax), max(newMin, newMax));
}
vec2 crange(vec2 oldValue, vec2 oldMin, vec2 oldMax, vec2 newMin, vec2 newMax) {
  return clamp(range(oldValue, oldMin, oldMax, newMin, newMax), min(newMin, newMax), max(newMin, newMax));
}
float blendOverlay(float base, float blend) {
  return base<0.5?(2.0*base*blend):(1.0-2.0*(1.0-base)*(1.0-blend));
}
vec3 blendOverlay(vec3 base, vec3 blend) {
  return vec3(blendOverlay(base.r, blend.r), blendOverlay(base.g, blend.g), blendOverlay(base.b, blend.b));
}
vec3 blendOverlay(vec3 base, vec3 blend, float opacity) {
  return (blendOverlay(base, blend) * opacity + base * (1.0 - opacity));
}
float blendSoftLight(float base, float blend) {
  return (blend<0.5)?(2.0*base*blend+base*base*(1.0-2.0*blend)):(sqrt(base)*(2.0*blend-1.0)+2.0*base*(1.0-blend));
}
vec3 blendSoftLight(vec3 base, vec3 blend) {
  return vec3(blendSoftLight(base.r, blend.r), blendSoftLight(base.g, blend.g), blendSoftLight(base.b, blend.b));
}
vec3 blendSoftLight(vec3 base, vec3 blend, float opacity) {
  return (blendSoftLight(base, blend) * opacity + base * (1.0 - opacity));
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
vec4 getRGB(sampler2D tDiffuse, vec2 uv, float angle, float amount) {
  vec2 offset = vec2(cos(angle), sin(angle)) * amount;
  vec4 r = texture2D(tDiffuse, uv + offset);
  vec4 g = texture2D(tDiffuse, uv);
  vec4 b = texture2D(tDiffuse, uv - offset);
  return vec4(r.r + g.r*amount, g.g + r.b*amount, b.b + b.g*amount, g.a);
}
vec2 scaleUV(vec2 uv, vec2 scale, vec2 origin) {
  vec2 st = uv - origin;
  st /= scale;
  return st + origin;
}
vec2 scaleUV(vec2 uv, vec2 scale) {
  return scaleUV(uv, scale, vec2(0.5));
}
`;

export const mvVertex = /* glsl */ `
uniform float time;
uniform float uTransition;
uniform float uRandom;
uniform sampler2D tNoise;

varying vec2 vUv;
varying vec4 vPosition;
varying float vNoise;

float getNoise(sampler2D tex, vec2 uv, float time, float noiseFrequency, float noiseAmplitude, float noiseSpeed) {
  vec2 timerScaler = vec2(time * 0.5, 0.) * noiseSpeed;
  return (
    texture2D(tex, (uv - timerScaler ) * noiseFrequency).r +
    texture2D(tex, (uv + timerScaler) * noiseFrequency).g +
    texture2D(tex, (uv + timerScaler.yx) * noiseFrequency).b) * 0.33 * noiseAmplitude;
}

vec2 rotate(vec2 v, float a) {
  float s = sin(a);
  float c = cos(a);
  mat2 m = mat2(c, s, -s, c);
  return m * v;
}

void main() {
  vUv = uv;
  vNoise = getNoise(tNoise, position.xy, 1., 1.4, 1., 0.3);

  vec3 pos = position;

  float speed = 0.4;
  float timerScaler = time * speed;

  pos.xy += vec2(-0.5, 0.5);
  pos.xy *= 1. - (1. - uTransition ) * 0.3 + cos(timerScaler + uRandom) * 0.02;
  pos.xy -= vec2(-0.5, 0.5);
  pos.y -= (1. - uTransition ) * 0.4;

  pos.x += sin(timerScaler * 0.6 + uRandom) * 0.015;
  pos.x += sin(timerScaler + uRandom) * 0.01;
  pos.y += sin(timerScaler * 0.85 + cos(time) + uRandom) * 0.01;
  pos.y += sin(timerScaler * 1.05 + uRandom) * 0.01;
  pos.xy = rotate(pos.xy, sin(time * speed * 0.9 + uRandom) * 0.04 + (1. - uTransition ) * 0.1);

  vPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * vPosition;
}
`;

export const mvFragment = /* glsl */ `
uniform float time;
uniform vec2 resolution;
uniform sampler2D tDiffuse;
uniform sampler2D tAlpha;
uniform sampler2D tMotion;
uniform sampler2D tPosition;
uniform sampler2D tData;
uniform sampler2D tDraw;
uniform sampler2D tReel;

uniform float uTransition;
uniform float uColumns;
uniform float uRows;
uniform float uRandom;
uniform float uDisplacementStrength;
uniform vec2 uMouse;
uniform vec3 uColor;
uniform float uStrengthColor;
uniform float uStrengthDraw;
uniform vec2 uClickUv;
uniform float uClickTime;
uniform float uInside;
uniform float uSmall;
uniform vec3 uLightColor;
uniform float uLightColorStr;
uniform float uUseMask;
uniform float uRTMask;
uniform float uVelocity;
uniform float uOpacity;

varying vec2 vUv;
varying vec4 vPosition;
varying float vNoise;

${helpers}

vec2 getSubUV(vec2 _dimensions, vec2 _uv, float _index) {
  float index = _index * (1.0 / _dimensions.x);
  vec2 uv = _uv;
  uv /= _dimensions;
  uv.y += (1.0 / _dimensions.y) * (_dimensions.y - 1.0);
  uv.x += floor(fract(index) * _dimensions.x) / _dimensions.x;
  uv.y -= floor(fract(index / _dimensions.y) * _dimensions.y) / _dimensions.y;
  return uv;
}

vec2 remap(vec2 _displacement, float displacementStrength) {
  vec2 displacement;
  displacement.rg = crange(_displacement.rg, vec2(0.0), vec2(1.0), vec2(-1.0), vec2(1.0));
  return displacement * displacementStrength;
}

vec4 getMap(sampler2D _tMap, float _blend, vec2 _subUv, vec2 _subUvNext, vec2 _displacement, vec2 _displacementNext) {
  vec4 color = texture2D(_tMap, _subUv - _displacement * _blend);
  vec4 colorNext = texture2D(_tMap, _subUvNext + _displacementNext * (1.0 - _blend));
  return mix(color, colorNext, _blend);
}

vec2 getDisplacement(sampler2D _tMotion, vec2 _uv, float _displacement) {
  vec2 displacement = texture2D(_tMotion, _uv).rg;
  return remap(displacement, _displacement);
}

void main() {
  vec4 color = vec4(0.);

  vec2 dimensions = vec2(uColumns, uRows);
  float MAX_INDEX = uColumns * uRows - 1.0;

  float controller = mix(smoothstep(0.1, 0.4, uTransition), uMouse.x, smoothstep(0.2, 1.0, uTransition));
  float index = crange(controller, 0.0, 1.0, 1.0, MAX_INDEX);
  float blend = fract(index);

  vec2 uv = vUv;

  vec2 subUv = getSubUV(dimensions, uv, index);
  vec2 subUvNext = getSubUV(dimensions, uv, index + 1.0);

  float displacementStrength = uDisplacementStrength * 0.01;

  vec2 displacement = getDisplacement(tMotion, subUv, displacementStrength);
  vec2 displacementNext = getDisplacement(tMotion, subUvNext, displacementStrength);

  if (uRTMask > 0.0) {
    color.rgb = vec3(1.0, 0.0, 0.0);
    color.a = getMap(tAlpha, blend, subUv, subUvNext, displacement, displacementNext).r;
    gl_FragColor = color;
    return;
  }

  float draw = 0.0;
  vec2 drawer = vec2(0.0);
  vec2 st = (gl_FragCoord.xy / resolution.xy);

  #ifdef DESKTOP
  // Tests.useFluids(): pixel trail field (R) — see src/lib/trail.ts
  drawer = texture2D(tDraw, st).rg;
  draw = drawer.r + drawer.g;
  draw = smoothstep(0.0, 1.0, draw);
  #endif

  float noise = vNoise;
  vec3 position = getMap(tPosition, blend, subUv, subUvNext, displacement, displacementNext).rgb;

  float pulse = 0.;
  float tD = (1. - uTransition);
  float v = 0.;

  float driver, t, gradient;
  vec4 clickPos;

  driver = 1.0 - clamp(uClickTime * 0.7, 0.0, 1.0);
  t = -pow(driver, 4.0) * 4.0;
  v = smoothstep(0.0, 1.0, position.y + sin(position.x*4.0+time+tD*6.0) * mix(0.3, 0.1, abs(0.5-position.x)) * 0.5 * smoothstep(0.0, 0.2, tD) + (1.0 - tD * 2.0));

  #ifdef DESKTOP
  if (uInside > 0.0) {
    vec2 clickUv = getSubUV(dimensions, uClickUv, index);
    vec2 clickUvNext = getSubUV(dimensions, uClickUv, index + 1.0);

    clickPos = getMap(tPosition, blend, clickUv, clickUvNext, displacement, displacementNext);
    gradient = length(position - clickPos.xyz) * mix(.35, 0.31, uSmall);
    pulse = sin(gradient * 15.0 - t + 3.8) * 0.5 + 0.5;

    float powMulti = mix(10.0, 6.0, uSmall);
    pulse = pow(pulse, powMulti - driver * powMulti);
    pulse += pow(pulse, (powMulti*3.0) - driver * (powMulti*1.5));
    pulse *= driver;
    pulse *= 1.0 - smoothstep(0.9, 1.0, driver);
    pulse *= 1.0 - clamp(length(gradient) * 3.0, 0.0, 1.0);
    pulse *= 12.0;
    pulse *= dot(color.rgb, vec3(1.)) * 0.5 + 0.15;
    pulse += (1. - v);
  }
  #endif

  pulse *= uInside;

  float pixellation = 400.;
  float maskAlpha = getMap(tAlpha, blend, subUv, subUvNext, displacement, displacementNext).r;
  float uvMix = pulse * 3. + (1.0-v) * 50.0;
  uvMix = mix(0.0, uvMix, maskAlpha);
  uvMix *= step(0.02, uClickTime);
  uvMix *= 1.1;
  subUv = mix(subUv, floor(subUv * pixellation) / pixellation, uvMix);
  subUvNext = mix(subUvNext, floor(subUvNext * pixellation) / pixellation, uvMix);
  color = getMap(tDiffuse, blend, subUv, subUvNext, displacement, displacementNext);

  color.a = color.a * mix(1.0, pow(v, 5.0) + 0.2, step(0.2, 1.0-uTransition)) * maskAlpha;

  vec3 pulseColor = vec3(0.);
  #ifdef DESKTOP
  if (uInside > 0.) {
    pulse *= dot(color.rgb, vec3(1.)) * 0.5 + 0.5;
    // reference pulse hue is orange (1.0, 0.5, 0.0); RetroGamers keeps the same
    // hue math around the brand blue
    vec3 pulseColor = rgb2hsv(uLightColor);
    pulseColor.x += (-0.5+smoothstep(0.4, 1.0, pulse)) * 0.1 - 0.08;
    pulseColor = hsv2rgb(pulseColor);
    pulseColor = mix(pulseColor, vec3(1.0), subUvNext.x * subUvNext.y * subUv.x * subUv.y);
    pulseColor = pow(pulse, 3.0) * pulseColor;
    color.rgb = pow(color.rgb, vec3(2.2));
    color.rgb += pulseColor * mix(1.0, 0.15, uSmall);
    color.rgb *= mix(1.0, 2.0, pow(pulse, 4.0));
    color.rgb = pow(color.rgb, vec3(0.45));
  }
  #endif

  vec3 hueShift = rgb2hsv(color.rgb);
  hueShift.x += color.a * 2.0;
  color.rgb = hsv2rgb(hueShift);

  if (uUseMask > 0.5) {
    float maskValue = getMap(tData, blend, subUv, subUvNext, displacement, displacementNext).r;
    vec2 maskedUV = st;
    maskedUV = scaleUV(maskedUV, vec2(0.8));

    maskedUV.x += (-0.5 + uMouse.x) * 0.2;
    maskedUV.y -= 0.05;
    maskedUV += draw * 0.3;
    maskedUV.y += mod(maskedUV.y, 0.012) * uVelocity * 0.9;

    uvMix = pulse * 1. + (1.0-v) * 30.0;
    uvMix += draw * 0.4;
    pixellation *= 0.2;
    maskedUV = mix(maskedUV, floor(maskedUV * pixellation) / pixellation, uvMix * 5.0);
    maskedUV *= 1.0 + pulse * 0.5;

    vec3 reel = getRGB(tReel, maskedUV, 0.2, 0.003 + smoothstep(0.5, 0.0, abs(draw-0.5)) * 0.005 + uVelocity * 0.0005 + pulse * 0.02).rgb;
    reel *= mix(0.0, 1.0, smoothstep(0.0, 0.5, abs(0.5-maskValue)));
    reel *= mix(0.5, 1.0, smoothstep(1.5, 0.0, length(position.rg-0.5)));
    reel *= 0.9 + pow(pulse, 4.0) * 0.05 + smoothstep(0.5, 0.0, abs(draw-0.5)) * 0.4;

    reel = rgb2hsv(reel);
    reel.x += smoothstep(0.6, 0.5, draw) * smoothstep(0.0, 0.5, draw) * 2.0;
    reel = hsv2rgb(reel);

    reel += maskedUV.x*maskedUV.y * 0.1;

    color.rgb = mix(color.rgb, reel, smoothstep(0.0, 0.2, maskValue));
    color.rgb *= 1.0 + reel.r * 0.1;
  }

  float lightMove = sin(vUv.x * 2.0 - uMouse.x * 6.0 - time * 0.1 + uRandom) + sin(vUv.y*5.0+time * 0.1 + uRandom)*0.5;
  float lightStrength = 0.5 + smoothstep(1.0, 0.0, (vUv.x-lightMove)) * 0.5;

  color.rgb = blendOverlay(color.rgb, vec3(1.0), pow(lightStrength, 5.0) * 0.5);
  color.rgb *= mix(10.0, 1.0, smoothstep(0.0, 1.0, color.a));
  color.rgb += pulseColor * smoothstep(0.2, 0.5, color.a) * smoothstep(0.8, 0.5, color.a);

  #ifdef DESKTOP
  vec3 rainbow = vec3(1.0, 0.15, 0.15);
  rainbow = rgb2hsv(rainbow);
  rainbow.x += pulse * 10.0 + v * 10.0 - vUv.x * 1.0 - tD * 10.0 - time;
  rainbow = hsv2rgb(rainbow);
  color.rgb = mix(color.rgb, rainbow, smoothstep(0.5, 0.0, abs(0.5-color.a)) * tD);
  #endif

  color.rgb = blendSoftLight(color.rgb, uLightColor, min(uLightColorStr, step(0.2, drawer.r + drawer.g)) * 1.0);

  color.a *= smoothstep(0.1, 0.3, uTransition);
  color.a *= uOpacity;

  gl_FragColor = color;
}
`;
