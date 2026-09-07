'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { sampleScroll } from '@/lib/scroll-store'
import { RUNE_PRESETS, type RunePreset, type RunePresetKey } from './rune-presets'

/**
 * Edge Rune scene (R3) — the fixed corner sigil's WebGL core.
 *
 * One IcosahedronGeometry + one point halo = 2 draw calls. Everything the
 * owner asked for lives here:
 * · «يدور مع Scroll Up/Down» — rotation velocity chases the HELD direction
 *   of the damped scroll velocity (sampleScroll), so down/up spin opposite
 *   ways and a full stop decays into a slow idle spin.
 * · «يغيّر شكله لكل صفحة» — route presets morph via UNIFORM interpolation
 *   (amp/freq/twist/morph/speed/scale + colors), never geometry swaps, so
 *   a navigation reads as one continuous ~0.8s organic transformation.
 *
 * Patterns copied verbatim from the proven capability-scene.tsx (React 19 +
 * R3F 9 conventions): GLSL1 noise block, finite-difference normals on the
 * displaced surface, lazy-useState halo buffer init (Math.random purity),
 * per-resource disposal effects, scene-local time accumulation (immune to
 * R3F's frameloop clock resets), uPixelRatio live sync, ContextLossGuard.
 * The vertex shader EXTENDS the proven blob with uFreq / uTwist / uMorph.
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

/* Rune blob vertex — capability-scene's displaced blob, extended with the
 * morph uniforms:
 * · uFreq scales the noise sampling direction (low = smooth monolith,
 *   high = nervous node mesh)
 * · uTwist rotates each vertex around Y by uTwist·y — the "continuity band"
 *   silhouette of /about and the structural shear of /services/websites.
 *   twist=0 reduces twistVec() to the identity → the proven home math.
 * · uMorph blends two octave fields sampled at different scales/offsets,
 *   so presets differ in CHARACTER (billow vs shard) not just amount.
 * Normals: finite differences of the SAME twist+displace mapping (the
 * neighbor points run through displaced() too) — no cracks, and the
 * Fresnel shading stays crisp at every twist amount. */
const RUNE_VERTEX = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uTime;
  uniform float uAmp;
  uniform float uFreq;
  uniform float uTwist;
  uniform float uMorph;
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
    vec3 dir = normalize(tp);
    vec3 q = dir * 1.7 * uFreq;
    float n1 = snoise(q + vec3(0.0, uTime * 0.16, uTime * 0.11));
    n1 += 0.45 * snoise(q * 2.3 - vec3(uTime * 0.09, 0.0, uTime * 0.13));
    float n2 = snoise(q * 0.55 + vec3(uTime * 0.07, 3.1, uTime * 0.05) + 11.3);
    n2 += 0.35 * snoise(q * 1.4 - vec3(5.2, uTime * 0.06, 0.0));
    return mix(n1, n2, uMorph);
  }

  vec3 displaced(vec3 p, float amp) {
    vec3 tp = twistVec(p);
    return tp + normalize(tp) * surfaceNoise(tp) * amp;
  }

  void main() {
    float amp = uAmp * (0.85 + 0.15 * sin(uTime * 0.45));

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

/* Fragment — the proven liquid-glass shading (Fresnel rim + iridescent
 * 3-color body gradient + grazing green hint + one fake specular glint).
 * Presets retarget uColorA/B/C/G and the interpolation engine lerps them,
 * which is the whole "يتناسق مع الموقع" guarantee: the colors come from
 * the same brand registry as every other WebGL surface. */
const RUNE_FRAGMENT = /* glsl */ `
  uniform float uTime;
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

    float g = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
    vec3 body = mix(uColorB * 0.45, uColorA, g);
    body = mix(body, uColorC, pow(g, 2.2) * 0.55);
    body = mix(body, uColorG, fresnel * 0.30);

    vec3 col = body + uColorB * pow(ndv, 2.5) * 0.35;
    col += mix(uColorC, vec3(1.0), 0.4) * fresnel * 0.85;
    col += uColorC * 0.06 * sin(uTime * 0.5 + vNoise * 6.28318);

    vec3 L = normalize(vec3(0.4, 0.65, 0.8));
    vec3 R = reflect(-V, N);
    col += vec3(0.9, 0.95, 1.0) * pow(max(dot(R, L), 0.0), 48.0) * 0.55;

    gl_FragColor = vec4(col, 1.0);
  }
`

/* Halo — soft round additive sprites (hero/capability pattern), with the
 * preset colors carried by TWO uniforms (uHaloA/uHaloB) mixed per particle
 * by a static random aMix attribute: retargeting the uniforms morphs the
 * whole cloud's palette with zero buffer rewrites (spec §4.4 "الأبسط
 * والأكفأ"). */
const HALO_VERTEX = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute float aMix;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uHaloA;
  uniform vec3 uHaloB;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    p *= 1.0 + 0.03 * sin(uTime * 0.3 + aPhase);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aScale * uPixelRatio * (24.0 / -mv.z);
    gl_PointSize = clamp(size, 1.0, 16.0);
    vColor = mix(uHaloA, uHaloB, aMix);
    vAlpha = 0.45 + 0.35 * sin(uTime * 0.8 + aPhase);
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
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`

const HALO_COUNT = 240

/* --- directional rotation tuning (spec §4.3, dt-compensated everywhere) --
 * scroll 2000 px/s fling → 0.12 idle + 1.2 = ~1.3 rad/s; the cap keeps even
 * a violent trackpad flick from turning the sigil into a blur. */
const K_SCROLL = 0.0006
const ROT_MAX = 1.8
const IDLE_SPIN = 0.12
const ROT_K = 6
/* --- morph tuning: 1 - e^(-3.2·t) ≈ 91% after 0.8s — the spec's organic
 * route-transition window. */
const MORPH_K = 3.2

/** Interpolation goal set — preset scalars + THREE.Color targets. */
interface RuneGoals {
  amp: number
  freq: number
  twist: number
  morph: number
  speed: number
  scale: number
  colorA: THREE.Color
  colorB: THREE.Color
  colorC: THREE.Color
  colorG: THREE.Color
  haloA: THREE.Color
  haloB: THREE.Color
}

function makeGoals(p: RunePreset): RuneGoals {
  return {
    amp: p.amp,
    freq: p.freq,
    twist: p.twist,
    morph: p.morph,
    speed: p.speed,
    scale: p.scale,
    colorA: new THREE.Color(p.colorA),
    colorB: new THREE.Color(p.colorB),
    colorC: new THREE.Color(p.colorC),
    colorG: new THREE.Color(p.colorG),
    haloA: new THREE.Color(p.haloA),
    haloB: new THREE.Color(p.haloB),
  }
}

/* Dev-only introspection handle (never built into production bundles —
 * NODE_ENV is statically inlined). Powers the G2/G4/G5 verification gates:
 * FPS, directional rotation sign, and the goal-vs-current morph values. */
interface RuneDebug {
  preset: RunePresetKey
  mount: number
  active: boolean
  rotY: number
  rotVel: number
  vy: number
  fps: number
  cur: { amp: number; freq: number; twist: number; morph: number }
  goal: { amp: number; freq: number; twist: number; morph: number }
}

declare global {
  interface Window {
    __elyraRuneDebug?: RuneDebug
  }
}

const DEV = process.env.NODE_ENV !== 'production'
let mountSeq = 0

function RuneCore({ presetKey, active }: { presetKey: RunePresetKey; active: boolean }) {
  const spinner = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Points>(null)
  // scene-local time (LOOP-3 FIX 7 pattern): R3F resets clock.elapsedTime on
  // every 'never'↔'always' frameloop transition; accumulating from delta
  // keeps the surface flowing seamlessly across tab-hide resumes.
  const tRef = useRef(0)
  const speedRef = useRef(1)
  const scaleRef = useRef(1)
  const rotVel = useRef(IDLE_SPIN)
  const fps = useRef(60)
  // First-frame snap flag: uniforms start NEUTRAL and jump to the current
  // preset goals inside the first useFrame (below) — the shape is correct
  // from the first RENDERED frame no matter when the route/preset settles,
  // and no eslint-disable is needed to keep the memos dependency-clean.
  const snapped = useRef(false)
  const mount = useRef(0)

  // Route goals — a NEW object per preset change; the SAME uniforms below
  // keep interpolating toward it, which is what makes the route morph
  // continuous instead of a remount flash.
  const goals = useMemo(() => makeGoals(RUNE_PRESETS[presetKey]), [presetKey])

  // Uniforms are created ONCE (neutral values — dependency-free on
  // purpose: later preset changes must flow through the interpolation
  // engine, never through a re-created uniforms object) and snap to the
  // current goals in the first useFrame, so a direct landing renders the
  // correct shape from frame 1 with no boot-up morph.
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uAmp: { value: 0.12 },
    uFreq: { value: 1 },
    uTwist: { value: 0 },
    uMorph: { value: 0.35 },
    uColorA: { value: new THREE.Color() },
    uColorB: { value: new THREE.Color() },
    uColorC: { value: new THREE.Color() },
    uColorG: { value: new THREE.Color() },
  }), [])

  const blobGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 5), [])
  const blobMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: RUNE_VERTEX,
        fragmentShader: RUNE_FRAGMENT,
        uniforms,
      }),
    [uniforms]
  )

  // Halo buffers — generated ONCE per mount; Math.random lives in the lazy
  // state initializer only (React 19 purity convention, capability-scene).
  const [haloBuffers] = useState(() => {
    const positions = new Float32Array(HALO_COUNT * 3)
    const scales = new Float32Array(HALO_COUNT)
    const phases = new Float32Array(HALO_COUNT)
    const mixes = new Float32Array(HALO_COUNT)
    for (let i = 0; i < HALO_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1.5 + Math.random() * 0.45
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.8
      positions[i * 3 + 2] = r * Math.cos(phi)
      scales[i] = 0.5 + Math.random() * 1.1
      phases[i] = Math.random() * Math.PI * 2
      mixes[i] = Math.random()
    }
    return { positions, scales, phases, mixes }
  })
  const haloGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(haloBuffers.positions, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(haloBuffers.scales, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(haloBuffers.phases, 1))
    g.setAttribute('aMix', new THREE.BufferAttribute(haloBuffers.mixes, 1))
    return g
  }, [haloBuffers])
  const haloUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.75) },
      // neutral — snapped to the preset goals in the first useFrame
      uHaloA: { value: new THREE.Color() },
      uHaloB: { value: new THREE.Color() },
    }),
    []
  )
  const haloMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        uniforms: haloUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [haloUniforms]
  )

  // FIX(2-c/10) pattern: R3F does not dispose prop-passed resources — free
  // each GPU resource exactly once, per-resource (V-1 L3-2a P3).
  useEffect(() => () => blobGeo.dispose(), [blobGeo])
  useEffect(() => () => blobMat.dispose(), [blobMat])
  useEffect(() => () => haloGeo.dispose(), [haloGeo])
  useEffect(() => () => haloMat.dispose(), [haloMat])

  // Dev-debug mount id — assigned in an effect (never during render), so
  // G3 can detect an unintended remount by watching `mount` change.
  useEffect(() => {
    mount.current = ++mountSeq
  }, [])

  useFrame((state, delta) => {
    const dt = delta > 0 ? Math.min(delta, 0.1) : 1 / 60

    // First-frame snap: neutral uniforms jump STRAIGHT to the current
    // preset goals (render-correct from the first frame, no boot morph).
    // Later preset changes settle through the damped interpolation below.
    if (!snapped.current) {
      snapped.current = true
      uniforms.uAmp.value = goals.amp
      uniforms.uFreq.value = goals.freq
      uniforms.uTwist.value = goals.twist
      uniforms.uMorph.value = goals.morph
      uniforms.uColorA.value.copy(goals.colorA)
      uniforms.uColorB.value.copy(goals.colorB)
      uniforms.uColorC.value.copy(goals.colorC)
      uniforms.uColorG.value.copy(goals.colorG)
      haloUniforms.uHaloA.value.copy(goals.haloA)
      haloUniforms.uHaloB.value.copy(goals.haloB)
      speedRef.current = goals.speed
      scaleRef.current = goals.scale
      if (spinner.current) spinner.current.scale.setScalar(goals.scale)
    }

    // scene-local time — the shader's "energy" advances at the preset's
    // own speed (interpolated), immune to R3F frameloop clock resets.
    tRef.current += dt * speedRef.current
    const t = tRef.current

    // --- scroll → directional rotation (the owner's literal request) ----
    const { vy, dir } = sampleScroll(dt)
    const speed = Math.min(Math.abs(vy) * K_SCROLL, ROT_MAX - IDLE_SPIN)
    const target = dir === -1 ? -(IDLE_SPIN + speed) : IDLE_SPIN + speed
    const rotS = 1 - Math.exp(-ROT_K * dt)
    rotVel.current += (target - rotVel.current) * rotS

    // --- preset morph: damp every scalar toward its goal ---------------
    // (THREE uniform objects are owned three.js state — the canonical R3F
    // per-frame mutation pattern; the repo's immutability lint does not
    // flag these assignments, so no directives are used here.)
    const s = 1 - Math.exp(-MORPH_K * dt)
    uniforms.uAmp.value += (goals.amp - uniforms.uAmp.value) * s
    uniforms.uFreq.value += (goals.freq - uniforms.uFreq.value) * s
    uniforms.uTwist.value += (goals.twist - uniforms.uTwist.value) * s
    uniforms.uMorph.value += (goals.morph - uniforms.uMorph.value) * s
    speedRef.current += (goals.speed - speedRef.current) * s
    scaleRef.current += (goals.scale - scaleRef.current) * s
    uniforms.uTime.value = t
    uniforms.uColorA.value.lerp(goals.colorA, s)
    uniforms.uColorB.value.lerp(goals.colorB, s)
    uniforms.uColorC.value.lerp(goals.colorC, s)
    uniforms.uColorG.value.lerp(goals.colorG, s)
    haloUniforms.uTime.value = t
    haloUniforms.uHaloA.value.lerp(goals.haloA, s)
    haloUniforms.uHaloB.value.lerp(goals.haloB, s)
    // uPixelRatio live sync (LOOP-3 FIX 6): state.viewport.dpr is R3F's
    // clamped actual dpr, so gl_PointSize always matches the render scale.
    haloUniforms.uPixelRatio.value = state.viewport.dpr

    if (spinner.current) {
      spinner.current.rotation.y += rotVel.current * dt
      // broken-axis secondary tilt — the elegant "ميل مكسور" of spec §4.3
      spinner.current.rotation.x += rotVel.current * 0.35 * dt
      spinner.current.scale.setScalar(scaleRef.current)
    }
    if (haloRef.current) {
      // halo couples to a quarter of the spin + its own slow drift, so the
      // dust reads as environment, not part of the object
      haloRef.current.rotation.y += (rotVel.current * 0.22 + 0.03) * dt
    }

    if (DEV) {
      const measured = dt > 0 ? 1 / dt : 60
      fps.current += (measured - fps.current) * 0.1
      window.__elyraRuneDebug = {
        preset: presetKey,
        mount: mount.current,
        active,
        rotY: spinner.current ? spinner.current.rotation.y : 0,
        rotVel: rotVel.current,
        vy,
        fps: fps.current,
        cur: {
          amp: uniforms.uAmp.value as number,
          freq: uniforms.uFreq.value as number,
          twist: uniforms.uTwist.value as number,
          morph: uniforms.uMorph.value as number,
        },
        goal: { amp: goals.amp, freq: goals.freq, twist: goals.twist, morph: goals.morph },
      }
    }
  })

  return (
    <group ref={spinner} rotation={[0.25, 0, 0.08]}>
      <mesh geometry={blobGeo} material={blobMat} />
      <points ref={haloRef} geometry={haloGeo} material={haloMat} frustumCulled={false} />
    </group>
  )
}

/** Context-loss guard — same contract as hero-canvas / capability-scene
 *  (preventDefault keeps the canvas restorable; one diagnostic log). */
function ContextLossGuard() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      console.warn('[EdgeRune] WebGL context lost')
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl])
  return null
}

export interface RuneSceneProps {
  /** Tab-visibility gate — 'never' frameloop while hidden (the rune is
   *  fixed and always "in viewport", so IO gating is meaningless here). */
  active: boolean
  /** Locale-stripped route preset key — drives the morph goals. */
  presetKey: RunePresetKey
}

export function RuneScene({ active, presetKey }: RuneSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 3.4], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{
        background: 'transparent',
        // R3F defaults its container to pointer-events:auto (its event
        // system needs raycast hits); the rune is pure decoration — user
        // style spreads LAST in R3F's container, so this overrides the
        // default and every child inherits none (G8 click-through).
        pointerEvents: 'none',
      }}
    >
      <RuneCore presetKey={presetKey} active={active} />
      <ContextLossGuard />
    </Canvas>
  )
}
