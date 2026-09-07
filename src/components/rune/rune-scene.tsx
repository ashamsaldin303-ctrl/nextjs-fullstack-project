'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getScrollClocks, scrollEnergy, tickScrollTail } from '@/lib/scroll-store'
import { setRuneInvalidate } from './rune-bus'
import { BRAND_COLORS } from '@/lib/brand-colors'
import {
  RUNE_FIELD_PRESETS,
  type RuneFieldPreset,
  type RunePresetKey,
} from './rune-presets'

/**
 * Rune Field scene (RUNE-2) — the full-viewport WebGL core.
 *
 * OWNER'S CONTRACT, restated as invariants this file enforces:
 * 1. «تتحرك في جميع أنحاء الشاشة» — an orthographic rig maps the whole
 *    viewport to world units (y ∈ [-1, 1], x ∈ [-aspect, aspect]) and every
 *    rune wanders a wide Lissajous path over it, driven by the signed
 *    scroll clock D (down = forward along the path, up = retraced).
 * 2. «كبيرة ثم تصغر وتكبر» — scale breathes with the unsigned clock S,
 *    phase-staggered per rune; the volumes are deliberately LARGE (20–44%
 *    of the viewport height) — protagonists, not corner confetti.
 * 3. «لا يتحرك أي شيء عند التوقف» — ZERO wall-clock time reaches the
 *    shaders (no uTime exists anywhere below). Every term is a function
 *    of D, S or the glow energy, and the glow tail drains in bounded
 *    time. Combined with frameloop="demand" + the invalidate bus, an idle
 *    page renders ZERO frames — the debug handle's `frames` counter is
 *    the machine-checkable proof.
 * 4. «تتماشى الخلفية معها» — the field paints its own atmosphere: two
 *    huge soft washes roam with the same clocks UNDER the dust and the
 *    runes, tinting the page's background in motion with them.
 *
 * Rendering: glass volumes — normal blending, rim-weighted alpha (edges
 * near-opaque, centers translucent) — which reads as glowing glass on the
 * dark hero/CTA sections and as tinted crystal on the light sections (the
 * site is a light design with dark sections; additive-only would vanish
 * on the light ones).
 *
 * Patterns preserved from the proven RUNE-1/capability lineage: GLSL1
 * noise block byte-identical across consumers, finite-difference normals
 * on the displaced surface, per-resource disposal, scene-local snap
 * (correct shape from the first RENDERED frame), ContextLossGuard, the
 * R3F pointer-events click-through fix, uPixelRatio live sync.
 */

/* ------------------------------------------------------------------ *
 * GLSL — Ashima 3D simplex noise (Stefan Gustavson / Ian McEwan, MIT),
 * byte-identical to the NOISE_GLSL blocks in hero-canvas.tsx and
 * capability-scene.tsx (one proven implementation, three consumers).
 * ------------------------------------------------------------------ */
const NOISE_GLSL = /* glsl */ `
  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }
  vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }
  vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 1.0) * x);
  }
  vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
  }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`

/* Rune volume vertex — the proven displaced blob where EVERY time term is
 * now the unsigned scroll clock S (uS, in px). The old `uTime` rates were
 * tuned for ~1 unit/s; uS * 0.0002 advances at the same rate during a
 * comfortable ~800 px/s scroll, slower while creeping, livelier in a
 * fling — the surface's flow is strictly proportional to the user's
 * scrolling. The amp breathing (uPhase staggers it per rune) breathes
 * with S too. Normals: finite differences of the SAME twist+displace
 * mapping (neighbor points run through displaced() as well) — no cracks,
 * Fresnel stays crisp at every twist amount. */
const RUNE_VERTEX = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uS;
  uniform float uAmp;
  uniform float uFreq;
  uniform float uTwist;
  uniform float uMorph;
  uniform float uPhase;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vNoise;

  vec3 orthogonal(vec3 v) {
    return normalize(abs(v.x) > abs(v.z)
      ? vec3(-v.y, v.x, 0.0)
      : vec3(0.0, -v.z, v.y));
  }

  vec3 twistVec(vec3 p) {
    float a = uTwist * p.y;
    float c = cos(a);
    float s = sin(a);
    return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
  }

  float surfaceNoise(vec3 tp) {
    float ft = uS * 0.0002;
    vec3 dir = normalize(tp);
    vec3 q = dir * 1.7 * uFreq;
    float n1 = snoise(q + vec3(0.0, ft * 0.16, ft * 0.11));
    n1 += 0.45 * snoise(q * 2.3 - vec3(ft * 0.09, 0.0, ft * 0.13));
    float n2 = snoise(q * 0.55 + vec3(ft * 0.07, 3.1, ft * 0.05) + 11.3);
    n2 += 0.35 * snoise(q * 1.4 - vec3(5.2, ft * 0.06, 0.0));
    return mix(n1, n2, uMorph);
  }

  vec3 displaced(vec3 p, float amp) {
    vec3 tp = twistVec(p);
    return tp + normalize(tp) * surfaceNoise(tp) * amp;
  }

  void main() {
    float amp = uAmp * (0.85 + 0.15 * sin(uS * 0.0028 + uPhase));

    vec3 tp = twistVec(position);
    float n0 = surfaceNoise(tp);
    vNoise = n0;
    vec3 p = tp + normalize(tp) * n0 * amp;

    vec3 dir0 = normalize(position);
    vec3 tangent = orthogonal(dir0);
    vec3 bitangent = normalize(cross(dir0, tangent));
    float eps = 0.06;
    vec3 pt = displaced(position + tangent * eps, amp);
    vec3 pb = displaced(position + bitangent * eps, amp);
    vec3 n = normalize(cross(pt - p, pb - p));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * n);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

/* Fragment — the liquid-glass shading re-voiced for NORMAL blending over
 * a light-page-with-dark-sections design: the body keeps the iridescent
 * 3-color gradient + grazing green hint + one fake specular glint, and a
 * rim-weighted alpha makes each volume read as tinted crystal on light
 * surfaces and glowing glass on dark ones. uOpacity carries the slot
 * fade (route morphs park unused slots at 0), uEnergy lifts rim + alpha
 * while the page is actively being scrolled. NO time term — the shimmer
 * is clocked by S. */
const RUNE_FRAGMENT = /* glsl */ `
  uniform float uS;
  uniform float uOpacity;
  uniform float uEnergy;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uColorG;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vNoise;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, 2.4);
    float rim = pow(fresnel, 1.15);

    float g = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
    vec3 body = mix(uColorB * 0.45, uColorA, g);
    body = mix(body, uColorC, pow(g, 2.2) * 0.55);
    body = mix(body, uColorG, fresnel * 0.30);

    vec3 col = body + uColorB * pow(ndv, 2.5) * 0.35;
    col += mix(uColorC, vec3(1.0), 0.4) * fresnel * 0.85;
    // scroll-clocked shimmer (was uTime-based in RUNE-1 — contract 3)
    col += uColorC * 0.06 * sin(uS * 0.004 + vNoise * 6.28318);
    // active-scroll energy breathes into the rim only
    col += uColorC * rim * 0.35 * uEnergy;

    vec3 L = normalize(vec3(0.4, 0.65, 0.8));
    vec3 R = reflect(-V, N);
    col += vec3(0.9, 0.95, 1.0) * pow(max(dot(R, L), 0.0), 48.0) * 0.55;

    float alpha = uOpacity * clamp(0.30 + 0.58 * rim + 0.10 * uEnergy, 0.0, 0.92);
    gl_FragColor = vec4(col, alpha);
  }
`

/* Halo — a small orbit cloud per rune (child of the rune's group, so it
 * scales + orbits with the volume). S-clocked shimmer; uFade is the
 * slot fade × the preset's halo intensity. Fixed pixel size (no
 * perspective term — the rig is orthographic). Normal blending keeps the
 * motes visible on light sections (additive would vanish there). */
const HALO_VERTEX = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute float aMix;
  uniform float uS;
  uniform float uPixelRatio;
  uniform float uFade;
  uniform float uEnergy;
  uniform vec3 uHaloA;
  uniform vec3 uHaloB;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aScale * uPixelRatio * 4.0, 1.0, 10.0);
    vColor = mix(uHaloA, uHaloB, aMix);
    vAlpha = uFade * (0.30 + 0.30 * (0.5 + 0.5 * sin(uS * 0.0035 + aPhase * 2.0)) + 0.25 * uEnergy);
  }
`

const HALO_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    // reversed-edge smoothstep rewritten as its algebraically identical
    // 1 - smoothstep(lo, hi, d) twin (LOOP-3 FIX 9 convention)
    float a = 1.0 - smoothstep(0.08, 0.5, d);
    gl_FragColor = vec4(vColor, a * vAlpha * 0.55);
  }
`

/* Dust — the ambient field. uD streams the motes past the viewport with
 * scroll-parallax (per-particle depth), S-clocked drift + twinkle. All
 * scroll-clock: a stopped page has frozen dust. */
const DUST_VERTEX = /* glsl */ `
  attribute float aDepth;
  attribute float aPhase;
  attribute float aAlpha;
  uniform float uD;
  uniform float uS;
  uniform float uAspect;
  uniform float uDensity;
  uniform float uEnergy;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    float x = position.x * uAspect + sin(uS * 0.0009 + aPhase) * 0.03;
    float y = mod(position.y + uD * 0.00009 * aDepth + 1.0, 2.0) - 1.0;
    vec4 mv = modelViewMatrix * vec4(x, y, 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp((0.6 + 0.4 * aDepth) * uPixelRatio * 2.2, 1.0, 4.0);
    vAlpha = uDensity * aAlpha * (0.18 + 0.22 * (0.5 + 0.5 * sin(uS * 0.002 + aPhase * 1.7)) + 0.25 * uEnergy);
  }
`

const DUST_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = 1.0 - smoothstep(0.05, 0.5, d);
    gl_FragColor = vec4(uColor, a * vAlpha);
  }
`

/* Wash — the atmosphere layer («الخلفية تتماشى معها»): huge soft radial
 * fields roaming with the same clocks, under everything else. */
const WASH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const WASH_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5);
    float a = (1.0 - smoothstep(0.12, 0.5, d)) * uAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`

/** Damping toward a goal — 1 - e^(-k·t) style, expressed as a pure
 *  module function (the opaque call result gives the compiler fresh
 *  provenance, the sanctioned external-value write shape). */
function dampNum(cur: number, goal: number, s: number): number {
  return cur + (goal - cur) * s
}

/* --- tuning ---------------------------------------------------------- */
const HALO_COUNT = 64
const DUST_COUNT = 260
/** Route-morph damping: 1 - e^(-4·t) ≈ 95% after 0.75s — the organic
 *  route-transition window. */
const MORPH_K = 4
/** Convergence threshold — below this residual the morph stops chaining
 *  frames (the freeze contract extends to transitions). */
const MORPH_EPS = 0.0015

/* --- runtime slot state ---------------------------------------------- *
 * Mutable per-slot values that damp toward the preset goals. The color
 * instances are the VERY uniform values the materials read (lerp mutates
 * them in place — zero per-frame allocation). */
interface SlotCur {
  ax: number; ay: number; rax: number; ray: number
  fx: number; fy: number; px: number; py: number
  depth: number; base: number; sk: number; sp: number
  breathe: number; spin: number
  amp: number; freq: number; twist: number; morph: number
  halo: number; opacity: number
  colorA: THREE.Color; colorB: THREE.Color; colorC: THREE.Color; colorG: THREE.Color
  haloA: THREE.Color; haloB: THREE.Color
}

interface WashCur {
  ax: number; ay: number; rax: number; ray: number
  fx: number; fy: number; px: number; py: number
  scale: number; alpha: number
  color: THREE.Color
}

const SLOT_NUM_KEYS = [
  'ax', 'ay', 'rax', 'ray', 'fx', 'fy', 'px', 'py',
  'depth', 'base', 'sk', 'sp', 'breathe', 'spin',
  'amp', 'freq', 'twist', 'morph', 'halo', 'opacity',
] as const

const WASH_NUM_KEYS = [
  'ax', 'ay', 'rax', 'ray', 'fx', 'fy', 'px', 'py', 'scale', 'alpha',
] as const

/** Goal set — the preset's values with colors pre-converted (ONE object
 *  per preset change; the SAME runtime state keeps interpolating toward
 *  it, which is what makes route morphs continuous, never a remount). */
/** Goal aliases — the runtime state's own shape, read as targets. */
type SlotGoal = SlotCur
type WashGoal = WashCur
interface FieldGoals {
  runes: readonly [SlotGoal, SlotGoal, SlotGoal, SlotGoal]
  washes: readonly [WashGoal, WashGoal]
  dust: number
}

function slotGoal(src: RuneFieldPreset['runes'][number]): SlotGoal {
  return {
    ax: src.ax, ay: src.ay, rax: src.rax, ray: src.ray,
    fx: src.fx, fy: src.fy, px: src.px, py: src.py,
    depth: src.depth, base: src.base, sk: src.sk, sp: src.sp,
    breathe: src.breathe, spin: src.spin,
    amp: src.amp, freq: src.freq, twist: src.twist, morph: src.morph,
    halo: src.halo, opacity: src.opacity,
    colorA: new THREE.Color(src.colorA),
    colorB: new THREE.Color(src.colorB),
    colorC: new THREE.Color(src.colorC),
    colorG: new THREE.Color(src.colorG),
    haloA: new THREE.Color(src.haloA),
    haloB: new THREE.Color(src.haloB),
  }
}

function washGoal(src: RuneFieldPreset['washes'][number]): WashGoal {
  return {
    ax: src.ax, ay: src.ay, rax: src.rax, ray: src.ray,
    fx: src.fx, fy: src.fy, px: src.px, py: src.py,
    scale: src.scale, alpha: src.alpha,
    color: new THREE.Color(src.color),
  }
}

function makeGoals(preset: RuneFieldPreset): FieldGoals {
  return {
    runes: [slotGoal(preset.runes[0]), slotGoal(preset.runes[1]), slotGoal(preset.runes[2]), slotGoal(preset.runes[3])],
    washes: [washGoal(preset.washes[0]), washGoal(preset.washes[1])],
    dust: preset.dust,
  }
}

/* --- imperative scene graph ------------------------------------------ *
 * Built ONCE per mount (lazy state initializer — Math.random lives
 * there only, the React 19 purity convention shared with
 * capability-scene), driven imperatively by the single useFrame below,
 * disposed per-resource on unmount (FIX(2-c/10) pattern). */
interface SlotObj {
  group: THREE.Group
  material: THREE.ShaderMaterial
  haloMaterial: THREE.ShaderMaterial
  cur: SlotCur
  /** Exactly-typed uniform records (ShaderMaterial.uniforms' string
   *  indexer widens to `IUniform | undefined` under
   *  noUncheckedIndexedAccess — these keep every writer exact). */
  uniforms: RuneUniforms
  haloUniforms: HaloUniforms
}

interface RuneUniforms {
  // index signature for ShaderMaterial assignability; explicit members
  // above stay exactly-typed for every writer (they win over the index)
  [key: string]: THREE.IUniform
  uS: { value: number }
  uAmp: { value: number }
  uFreq: { value: number }
  uTwist: { value: number }
  uMorph: { value: number }
  uPhase: { value: number }
  uOpacity: { value: number }
  uEnergy: { value: number }
  uColorA: { value: THREE.Color }
  uColorB: { value: THREE.Color }
  uColorC: { value: THREE.Color }
  uColorG: { value: THREE.Color }
}

interface HaloUniforms {
  [key: string]: THREE.IUniform
  uS: { value: number }
  uPixelRatio: { value: number }
  uFade: { value: number }
  uEnergy: { value: number }
  uHaloA: { value: THREE.Color }
  uHaloB: { value: THREE.Color }
}

interface DustUniforms {
  [key: string]: THREE.IUniform
  uD: { value: number }
  uS: { value: number }
  uAspect: { value: number }
  uDensity: { value: number }
  uEnergy: { value: number }
  uPixelRatio: { value: number }
  uColor: { value: THREE.Color }
}

interface WashUniforms {
  [key: string]: THREE.IUniform
  uColor: { value: THREE.Color }
  uAlpha: { value: number }
}

interface FieldObj {
  root: THREE.Group
  slots: [SlotObj, SlotObj, SlotObj, SlotObj]
  dustMaterial: THREE.ShaderMaterial
  dustUniforms: DustUniforms
  washMeshes: [THREE.Mesh, THREE.Mesh]
  washMaterials: [THREE.ShaderMaterial, THREE.ShaderMaterial]
  washUniforms: [WashUniforms, WashUniforms]
  washCur: [WashCur, WashCur]
  dispose: () => void
}

/** Deterministic PRNG (mulberry32) — a Math.random-free scene build so
 *  the whole field graph is a PURE function (React 19 render purity —
 *  double-render-stable — and the memo lint), while the halo/dust
 *  scatter still reads organic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeHaloGeometry(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed)
  const positions = new Float32Array(HALO_COUNT * 3)
  const scales = new Float32Array(HALO_COUNT)
  const phases = new Float32Array(HALO_COUNT)
  const mixes = new Float32Array(HALO_COUNT)
  for (let i = 0; i < HALO_COUNT; i++) {
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    const r = 1.35 + rand() * 0.4
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.85
    positions[i * 3 + 2] = r * Math.cos(phi)
    scales[i] = 0.5 + rand() * 1.1
    phases[i] = rand() * Math.PI * 2
    mixes[i] = rand()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
  g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  g.setAttribute('aMix', new THREE.BufferAttribute(mixes, 1))
  return g
}

function makeDustGeometry(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed)
  const positions = new Float32Array(DUST_COUNT * 3)
  const depths = new Float32Array(DUST_COUNT)
  const phases = new Float32Array(DUST_COUNT)
  const alphas = new Float32Array(DUST_COUNT)
  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3 + 0] = rand() * 2 - 1
    positions[i * 3 + 1] = rand() * 2 - 1
    positions[i * 3 + 2] = 0
    depths[i] = 0.5 + rand()
    phases[i] = rand() * Math.PI * 2
    alphas[i] = 0.35 + rand() * 0.65
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1))
  g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
  return g
}

/** One rune slot — mesh + orbit halo in a shared group + its mutable
 *  runtime state (the material uniforms reference the SAME Color
 *  instances, so lerp-in-place drives them with zero allocation). */
function buildSlot(
  root: THREE.Group,
  blobGeo: THREE.BufferGeometry,
  haloGeos: THREE.BufferGeometry[],
  haloSeed: number
): SlotObj {
  const cur: SlotCur = {
    ax: 0.5, ay: 0.5, rax: 0.1, ray: 0.1,
    fx: 0.001, fy: 0.001, px: 0, py: 0,
    depth: 0.8, base: 0, sk: 0.003, sp: 0,
    breathe: 0.4, spin: 0.0006,
    amp: 0.12, freq: 1, twist: 0, morph: 0.35,
    halo: 0, opacity: 0,
    colorA: new THREE.Color(), colorB: new THREE.Color(),
    colorC: new THREE.Color(), colorG: new THREE.Color(),
    haloA: new THREE.Color(), haloB: new THREE.Color(),
  }
  const uniforms: RuneUniforms = {
    uS: { value: 0 },
    uAmp: { value: cur.amp },
    uFreq: { value: cur.freq },
    uTwist: { value: cur.twist },
    uMorph: { value: cur.morph },
    uPhase: { value: cur.sp },
    uOpacity: { value: 0 },
    uEnergy: { value: 0.35 },
    uColorA: { value: cur.colorA },
    uColorB: { value: cur.colorB },
    uColorC: { value: cur.colorC },
    uColorG: { value: cur.colorG },
  }
  const material = new THREE.ShaderMaterial({
    vertexShader: RUNE_VERTEX,
    fragmentShader: RUNE_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(blobGeo, material)
  mesh.renderOrder = 12
  mesh.frustumCulled = false

  const haloGeo = makeHaloGeometry(haloSeed)
  haloGeos.push(haloGeo)
  const haloUniforms: HaloUniforms = {
    uS: { value: 0 },
    uPixelRatio: { value: 1 },
    uFade: { value: 0 },
    uEnergy: { value: 0.35 },
    uHaloA: { value: cur.haloA },
    uHaloB: { value: cur.haloB },
  }
  const haloMaterial = new THREE.ShaderMaterial({
    vertexShader: HALO_VERTEX,
    fragmentShader: HALO_FRAGMENT,
    uniforms: haloUniforms,
    transparent: true,
    depthWrite: false,
  })
  const halo = new THREE.Points(haloGeo, haloMaterial)
  halo.renderOrder = 13
  halo.frustumCulled = false

  const group = new THREE.Group()
  group.add(mesh, halo)
  root.add(group)
  return { group, material, haloMaterial, cur, uniforms, haloUniforms }
}

/** One wash — a huge soft radial plane + its mutable state. */
function buildWash(
  root: THREE.Group,
  planeGeo: THREE.BufferGeometry
): { mesh: THREE.Mesh; material: THREE.ShaderMaterial; cur: WashCur; washUniforms: WashUniforms } {
  const cur: WashCur = {
    ax: 0.5, ay: 0.5, rax: 0.1, ray: 0.1,
    fx: 0.0005, fy: 0.0005, px: 0, py: 0,
    scale: 1, alpha: 0,
    color: new THREE.Color(),
  }
  const washUniforms: WashUniforms = {
    // the color uniform VALUE is the wash's own mutable color instance —
    // lerp-in-place, same as the slot colors (zero allocation)
    uColor: { value: cur.color },
    uAlpha: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    vertexShader: WASH_VERTEX,
    fragmentShader: WASH_FRAGMENT,
    uniforms: washUniforms,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(planeGeo, material)
  mesh.renderOrder = 0
  mesh.frustumCulled = false
  root.add(mesh)
  return { mesh, material, cur, washUniforms }
}

function buildField(): FieldObj {
  const root = new THREE.Group()

  const blobGeo = new THREE.IcosahedronGeometry(1, 5)
  const planeGeo = new THREE.PlaneGeometry(1, 1)
  const haloGeos: THREE.BufferGeometry[] = []

  // exactly-typed 4-tuples (array literals under tuple annotations —
  // noUncheckedIndexedAccess-proof at both construction and use sites)
  const slots: [SlotObj, SlotObj, SlotObj, SlotObj] = [
    buildSlot(root, blobGeo, haloGeos, 0x5eed0001),
    buildSlot(root, blobGeo, haloGeos, 0x5eed0002),
    buildSlot(root, blobGeo, haloGeos, 0x5eed0003),
    buildSlot(root, blobGeo, haloGeos, 0x5eed0004),
  ]

  const dustGeo = makeDustGeometry(0x5eed0042)
  const dustUniforms: DustUniforms = {
    uD: { value: 0 },
    uS: { value: 0 },
    uAspect: { value: 1 },
    uDensity: { value: 1 },
    uEnergy: { value: 0.35 },
    uPixelRatio: { value: 1 },
    uColor: { value: new THREE.Color(BRAND_COLORS.gBlueLight) },
  }
  const dustMaterial = new THREE.ShaderMaterial({
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    uniforms: dustUniforms,
    transparent: true,
    depthWrite: false,
  })
  const dust = new THREE.Points(dustGeo, dustMaterial)
  dust.renderOrder = 1
  dust.frustumCulled = false
  root.add(dust)

  const wA = buildWash(root, planeGeo)
  const wB = buildWash(root, planeGeo)
  const washMeshes: [THREE.Mesh, THREE.Mesh] = [wA.mesh, wB.mesh]
  const washMaterials: [THREE.ShaderMaterial, THREE.ShaderMaterial] = [wA.material, wB.material]
  const washUniforms: [WashUniforms, WashUniforms] = [wA.washUniforms, wB.washUniforms]
  const washCur: [WashCur, WashCur] = [wA.cur, wB.cur]

  const dispose = () => {
    blobGeo.dispose()
    planeGeo.dispose()
    for (const g of haloGeos) g.dispose()
    dustGeo.dispose()
    for (const s of slots) {
      s.material.dispose()
      s.haloMaterial.dispose()
    }
    dustMaterial.dispose()
    for (const m of washMaterials) m.dispose()
  }

  return { root, slots, dustMaterial, dustUniforms, washMeshes, washMaterials, washUniforms, washCur, dispose }
}

/* --- dev-only introspection ------------------------------------------- *
 * Powers the verification gates: `frames` is the freeze-proof counter
 * (constant across an idle window ⇒ the GPU is rendering nothing). */
interface RuneDebug {
  preset: RunePresetKey
  frames: number
  fps: number
  D: number
  S: number
  vy: number
  vel01: number
  morphDelta: number
  runes: { x: number; y: number; scale: number; opacity: number }[]
}

declare global {
  interface Window {
    __elyraRuneDebug?: RuneDebug
  }
}

const DEV = process.env.NODE_ENV !== 'production'

function RuneFieldCore({ presetKey }: { presetKey: RunePresetKey }) {
  // Built ONCE per mount via useMemo (deterministic — seeded PRNG, no
  // Math.random — so the memo is purity-clean); mutated imperatively in
  // useFrame, the canonical R3F owned-three.js-state pattern (RUNE-1
  // lineage: the repo's immutability lint does not flag memo returns).
  const field = useMemo(() => buildField(), [])
  const goals = useMemo(() => makeGoals(RUNE_FIELD_PRESETS[presetKey]), [presetKey])
  const invalidate = useThree((s) => s.invalidate)

  // First-frame snap: neutral runtime state jumps STRAIGHT to the current
  // goals inside the first useFrame — the formation is correct from the
  // first RENDERED frame; later preset changes settle through damping.
  const snapped = useRef(false)
  const frames = useRef(0)
  const fps = useRef(60)

  // Per-resource disposal + invalidate-bus registration + a kick on
  // every preset change (a frozen field must wake to morph routes).
  // NOTE: `field` is deliberately NEVER a hook-argument (dep array) —
  // routing disposal through a stable ref keeps the owned three.js
  // state mutable inside useFrame (RUNE-1 uniforms lineage: closures over
  // memos are escape-analyzed, dep-array values are frozen).
  const fieldRef = useRef(field)
  useEffect(() => {
    const f = fieldRef.current
    return () => f.dispose()
  }, [])
  useEffect(() => {
    setRuneInvalidate(invalidate)
    invalidate()
    return () => setRuneInvalidate(null)
  }, [invalidate])
  useEffect(() => {
    invalidate()
  }, [invalidate, goals])

  useFrame((state, delta) => {
    const dt = delta > 0 ? Math.min(delta, 0.1) : 1 / 60
    const { D, S, vy } = getScrollClocks()
    const energy = scrollEnergy()
    const aspect = state.size.width / state.size.height

    // noUncheckedIndexedAccess-safe views (literal indices on tuples are
    // exact; loop variables would widen to `| undefined`)
    const slotList: SlotObj[] = [field.slots[0], field.slots[1], field.slots[2], field.slots[3]]
    const runeGoals: SlotGoal[] = [goals.runes[0], goals.runes[1], goals.runes[2], goals.runes[3]]
    const washList: WashCur[] = [field.washCur[0], field.washCur[1]]
    const washGoalList: WashGoal[] = [goals.washes[0], goals.washes[1]]
    const washMeshList: THREE.Mesh[] = [field.washMeshes[0], field.washMeshes[1]]
    const washUList: WashUniforms[] = [field.washUniforms[0], field.washUniforms[1]]
    const dustUList: [DustUniforms] = [field.dustUniforms]

    // ortho rig self-heal: map the whole viewport to world units
    // (y ∈ [-1, 1], x ∈ [-aspect, aspect]). Runs on every rendered frame
    // BEFORE the draw, so the very first frame is already correct, and
    // re-asserts the mapping after R3F-managed resize resets. state.camera
    // (the useFrame argument) is owned three.js state — the canonical
    // mutable pattern.
    const cam = state.camera as THREE.OrthographicCamera
    if (cam.top !== 1 || cam.bottom !== -1 || Math.abs(cam.right - aspect) > 1e-3) {
      cam.left = -aspect
      cam.right = aspect
      cam.top = 1
      cam.bottom = -1
      cam.position.set(0, 0, 10)
      cam.updateProjectionMatrix()
    }

    if (!snapped.current) {
      snapped.current = true
      for (let i = 0; i < slotList.length; i++) {
        const slot = slotList[i]
        const goal = runeGoals[i]
        if (!slot || !goal) continue
        const cur = slot.cur
        for (const k of SLOT_NUM_KEYS) cur[k] = goal[k]
        cur.colorA.copy(goal.colorA)
        cur.colorB.copy(goal.colorB)
        cur.colorC.copy(goal.colorC)
        cur.colorG.copy(goal.colorG)
        cur.haloA.copy(goal.haloA)
        cur.haloB.copy(goal.haloB)
      }
      for (let i = 0; i < washList.length; i++) {
        const cur = washList[i]
        const goal = washGoalList[i]
        if (!cur || !goal) continue
        for (const k of WASH_NUM_KEYS) cur[k] = goal[k]
        cur.color.copy(goal.color)
      }
      // dust density eases in through the morph damper below (no direct
      // write — the immutable-memo lint owns that path)
    }

    // --- route morph: damp every scalar toward its goal ----------------
    const s = 1 - Math.exp(-MORPH_K * dt)
    let morphDelta = 0
    for (let i = 0; i < slotList.length; i++) {
      const slot = slotList[i]
      const goal = runeGoals[i]
      if (!slot || !goal) continue
      const cur = slot.cur
      for (const k of SLOT_NUM_KEYS) {
        const d = goal[k] - cur[k]
        cur[k] += d * s
        const r = Math.abs(goal[k] - cur[k])
        if (r > morphDelta) morphDelta = r
      }
      cur.colorA.lerp(goal.colorA, s)
      cur.colorB.lerp(goal.colorB, s)
      cur.colorC.lerp(goal.colorC, s)
      cur.colorG.lerp(goal.colorG, s)
      cur.haloA.lerp(goal.haloA, s)
      cur.haloB.lerp(goal.haloB, s)
    }
    for (let i = 0; i < washList.length; i++) {
      const cur = washList[i]
      const goal = washGoalList[i]
      if (!cur || !goal) continue
      for (const k of WASH_NUM_KEYS) {
        const d = goal[k] - cur[k]
        cur[k] += d * s
        const r = Math.abs(goal[k] - cur[k])
        if (r > morphDelta) morphDelta = r
      }
      cur.color.lerp(goal.color, s)
    }
    // (dust density damps inside the dust block below — same aliased
    // uniform path the compiler already accepts)

    // --- slot transforms: PURE functions of D and S --------------------
    for (let i = 0; i < slotList.length; i++) {
      const slot = slotList[i]
      if (!slot) continue
      const cur = slot.cur
      const De = D * cur.depth
      const x = (cur.ax * 2 - 1) * aspect + cur.rax * 2 * Math.sin(De * cur.fx + cur.px)
      const y = (cur.ay * 2 - 1) + cur.ray * 2 * Math.sin(De * cur.fy + cur.py)
      const scale = Math.max(cur.base * (1 + cur.breathe * 0.5 * Math.sin(S * cur.sk + cur.sp)), 0.0001)
      const g = slot.group
      g.position.set(x, y, 0)
      g.scale.setScalar(scale)
      g.rotation.set(
        0.22 + Math.sin(S * 0.0016 + cur.sp) * 0.12,
        De * cur.spin,
        De * cur.spin * 0.18
      )

      const u = slot.uniforms
      u.uS.value = S
      u.uAmp.value = cur.amp
      u.uFreq.value = cur.freq
      u.uTwist.value = cur.twist
      u.uMorph.value = cur.morph
      u.uPhase.value = cur.sp
      u.uOpacity.value = cur.opacity
      u.uEnergy.value = energy
      const h = slot.haloUniforms
      h.uS.value = S
      h.uFade.value = cur.opacity * cur.halo
      h.uEnergy.value = energy
      h.uPixelRatio.value = state.viewport.dpr
    }

    // --- washes: the atmosphere roams with the same clocks -------------
    for (let i = 0; i < washList.length; i++) {
      const cur = washList[i]
      if (!cur) continue
      const x = (cur.ax * 2 - 1) * aspect + cur.rax * 2 * Math.sin(D * cur.fx + cur.px)
      const y = (cur.ay * 2 - 1) + cur.ray * 2 * Math.sin(D * cur.fy + cur.py)
      const mesh = washMeshList[i]
      if (mesh) {
        mesh.position.set(x, y, 0)
        mesh.scale.setScalar(Math.max(cur.scale * 2, 0.0001))
      }
      const mat = washUList[i]
      if (mat) mat.uAlpha.value = cur.alpha
    }

    // --- dust -----------------------------------------------------------
    // (dustUList — local array literal, the same provenance break the
    // slot/wash morph loops ride; direct field.dustUniforms chains are
    // compiler-frozen for self-referential writes)
    const du = dustUList[0]
    const dd = Math.abs(goals.dust - du.uDensity.value)
    du.uDensity.value = dampNum(du.uDensity.value, goals.dust, s)
    if (dd > morphDelta) morphDelta = dd
    du.uD.value = D
    du.uS.value = S
    du.uAspect.value = aspect
    du.uEnergy.value = energy
    du.uPixelRatio.value = state.viewport.dpr

    // --- frame chaining: scroll events already poke the bus; keep the
    // loop alive only while the glow tail drains or a morph settles.
    const tailActive = tickScrollTail(dt)
    if (tailActive || morphDelta > MORPH_EPS) invalidate()

    // --- dev introspection ----------------------------------------------
    if (DEV) {
      frames.current += 1
      const measured = dt > 0 ? 1 / dt : 60
      fps.current += (measured - fps.current) * 0.1
      window.__elyraRuneDebug = {
        preset: presetKey,
        frames: frames.current,
        fps: fps.current,
        D,
        S,
        vy,
        vel01: energy,
        morphDelta,
        runes: slotList.map((slot) => ({
          x: slot.group.position.x,
          y: slot.group.position.y,
          scale: slot.group.scale.x,
          opacity: slot.cur.opacity,
        })),
      }
    }
  })

  return <primitive object={field.root} />
}

/** Context-loss guard — same contract as hero-canvas / capability-scene
 *  (preventDefault keeps the canvas restorable; one diagnostic log). */
function ContextLossGuard() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      console.warn('[RuneField] WebGL context lost')
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl])
  return null
}

export interface RuneSceneProps {
  /** Tab-visibility gate — 'never' frameloop while hidden. */
  active: boolean
  /** Locale-stripped route preset key — drives the morph goals. */
  presetKey: RunePresetKey
}

export function RuneScene({ active, presetKey }: RuneSceneProps) {
  return (
    <Canvas
      orthographic
      frameloop={active ? 'demand' : 'never'}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 10], near: 0.1, far: 50, zoom: 1 }}
      gl={{ antialias: true, alpha: true }}
      style={{
        background: 'transparent',
        // R3F defaults its container to pointer-events:auto (its event
        // system needs raycast hits); the field is pure decoration — the
        // user style spreads LAST in R3F's container, so this overrides
        // the default and every child inherits none (G8 click-through).
        pointerEvents: 'none',
      }}
    >
      <RuneFieldCore presetKey={presetKey} />
      <ContextLossGuard />
    </Canvas>
  )
}
