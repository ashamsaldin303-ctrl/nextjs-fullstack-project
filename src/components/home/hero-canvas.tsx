'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { getHeroScroll } from '@/lib/hero-scroll'

/**
 * Elyra Hero Canvas — signature 3D (Batch 3 items 12/13/15).
 *
 * Motion model (item 12): particles are advected by a proper 3D simplex
 * CURL noise field (divergence-free — neighbouring particles share
 * velocity, so clumps stream as coherent ribbons instead of the old
 * per-particle sin/cos jitter). The noise space slowly translates past
 * the volume and particles rise on a wrapped domain with edge fade, which
 * together give the "slow global drift". uScroll (methodology bridge)
 * gently swells the flow; the camera dollies +0.8 on the same signal.
 *
 * Aurora backdrop (item 13): one additive fullscreen-ish plane BEHIND the
 * particles — 4-octave fbm curtains in blue/green with a soft cursor
 * light and a gentle vignette on the light itself. Additive blending
 * keeps the CSS stage (#08080A + hero-fallback gradient + blueprint
 * spotlight grid) visible underneath.
 *
 * Preserved performance architecture: deferred chunk (parent handles
 * requestIdleCallback/2.5s), IntersectionObserver-gated frameloop
 * ("never"/"always"), document-visibility pause, dpr [1,2] clamps,
 * pointer-lerp tilt + mouse attraction, gradient fallback for
 * no-WebGL/reduced-motion (parent handles), additive blending + soft
 * round sprites, single draw call (one THREE.Points), R3F JSX disposal,
 * context-loss guard.
 */

const PARTICLE_COUNT = 4500
// Brand family only — blues / green / cool-white (palette revert: blue
// is back — Google/Apple blue family with the brand green as counterpoint).
const COLORS = [
  new THREE.Color('#4285F4'),
  new THREE.Color('#4285F4'),
  new THREE.Color('#0071E3'),
  new THREE.Color('#0071E3'),
  new THREE.Color('#60A5FA'),
  new THREE.Color('#60A5FA'),
  new THREE.Color('#34A853'),
  new THREE.Color('#E8F2FF'),
]

const BASE_CAMERA_Z = 6 // mirrors the Canvas camera prop below
const AURORA_PLANE_Z = -9 // behind the whole particle volume
const AURORA_PLANE_DIST = BASE_CAMERA_Z - AURORA_PLANE_Z
const CAMERA_FOV_RAD = (70 * Math.PI) / 180 // mirrors the Canvas camera prop

/* ------------------------------------------------------------------ *
 * GLSL — Ashima 3D simplex noise (Stefan Gustavson / Ian McEwan, MIT)
 * + finite-difference curl. Written in GLSL1 style (attribute/varying)
 * to match the existing shaderMaterial convention in this repo.
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

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
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

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // Vector noise — three offset simplex samples packed into a vec3.
  vec3 snoiseVec3(vec3 x) {
    float s  = snoise(x);
    float s1 = snoise(vec3(x.y - 19.1, x.z + 33.4, x.x + 47.2));
    float s2 = snoise(vec3(x.z + 74.2, x.x - 124.5, x.y + 99.4));
    return vec3(s, s1, s2);
  }

  // Curl (rotational derivative) of the vector noise via central finite
  // differences. Divergence-free by construction — flow never bunches
  // into sinks, and neighbours share velocity => coherent ribbons.
  vec3 curlNoise(vec3 p) {
    const float e = 0.12;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);

    vec3 px0 = snoiseVec3(p - dx);
    vec3 px1 = snoiseVec3(p + dx);
    vec3 py0 = snoiseVec3(p - dy);
    vec3 py1 = snoiseVec3(p + dy);
    vec3 pz0 = snoiseVec3(p - dz);
    vec3 pz1 = snoiseVec3(p + dz);

    float x = py1.z - py0.z - pz1.y + pz0.y;
    float y = pz1.x - pz0.x - px1.z + px0.z;
    float z = px1.y - px0.y - py1.x + py0.x;

    vec3 curl = vec3(x, y, z) / (2.0 * e);
    // safe normalise — never NaN, even if the finite differences cancel
    return curl / max(length(curl), 1e-4);
  }
`

const PARTICLE_VERTEX = /* glsl */ `
  ${NOISE_GLSL}

  attribute float aScale;
  attribute float aSpeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform vec3 uMouse;
  uniform float uPixelRatio;
  uniform float uScroll;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;

    // --- curl flow field -------------------------------------------------
    // Sample the field in a slowly-translating noise space: the coherent
    // structures sweep past the volume so each particle's velocity keeps
    // re-forming — a streaming current, not in-place jitter.
    vec3 q = p * 0.16 + vec3(0.0, -uTime * 0.18, 0.0);
    vec3 vel = curlNoise(q);

    // Per-particle amplitude (aSpeed 0.2…0.8) + a gentle swell as the
    // methodology section scrolls through (uScroll 0…1).
    float amp = (1.1 + aSpeed * 1.6) * (1.0 + uScroll * 0.4);
    p += vel * amp;

    // --- slow global drift ------------------------------------------------
    // Embers rising through a tall wrapped domain; the edge fade below
    // dissolves particles at the recycle seam so the wrap never pops.
    const float DOMAIN = 20.0;
    float y = mod(p.y + uTime * (0.22 + aSpeed * 0.18), DOMAIN) - DOMAIN * 0.5;
    p.y = y;

    // subtle attraction toward the mouse plane (kept from v1)
    p += uMouse * 0.18;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aScale * uPixelRatio * (28.0 / -mv.z);
    gl_PointSize = clamp(size, 1.0, 64.0);
    vColor = aColor;
    // fade by distance (kept) + fade near the wrap seam
    float depthFade = clamp(1.0 - (-mv.z - 3.0) / 22.0, 0.0, 1.0);
    float edgeFade = 1.0 - smoothstep(8.5, 10.0, abs(y));
    vAlpha = depthFade * edgeFade;
  }
`

const PARTICLE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(vColor, a * vAlpha * 0.9);
  }
`

/* ------------------------------------------------------------------ *
 * GLSL — aurora backdrop (item 13). Cheap 4-octave value-noise fbm,
 * two drifting curtains, additive so the CSS stage stays visible.
 * ------------------------------------------------------------------ */
const AURORA_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vPos;
  void main() {
    vUv = uv;
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const AURORA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;   // world-space (plane local) cursor position
  uniform vec3 uColorA;  // blue
  uniform vec3 uColorB;  // green
  varying vec2 vUv;
  varying vec2 vPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // 4 octaves; the fixed rotation between octaves kills axis alignment.
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float t = uTime * 0.03;
    vec2 wp = vPos * 0.09;

    // Two aurora curtains drifting at different speeds and directions.
    float n1 = fbm(wp + vec2(t * 0.6, -t * 0.35));
    float n2 = fbm(wp * 1.35 + vec2(-t * 0.45, t * 0.3) + 7.3);

    // Vertical window in world space (aspect-safe: the fov is vertical,
    // so ±10.5 world units at the plane distance is the screen height) —
    // the curtains melt out at the very top and bottom of the viewport.
    float vert = smoothstep(-10.5, -5.0, vPos.y) * (1.0 - smoothstep(5.0, 10.5, vPos.y));

    // Gentle vignette on the aurora light itself (screen edges stay calm).
    float vig = 1.0 - smoothstep(0.15, 0.42, length(vUv - vec2(0.5)));

    float blue = pow(smoothstep(0.38, 0.85, n1), 1.6) * vert * vig;
    float green = pow(smoothstep(0.42, 0.90, n2), 1.7) * vert * vig;

    vec3 col = vec3(0.0); // additive: the CSS stage shows through
    col += uColorA * blue * 0.30;
    col += uColorB * green * 0.24;
    // cool core where the curtains cross
    col += uColorA * blue * green * 0.30;

    // Subtle cursor light — a broad cool wash following the pointer.
    float md = length(vPos - uMouse);
    col += mix(uColorB, uColorA, 0.6) * exp(-md * md / 220.0) * 0.10;

    gl_FragColor = vec4(col, 1.0);
  }
`

function Particles({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number; tx: number; ty: number }> }) {
  const pointsRef = useRef<THREE.Points>(null)
  const mouseVec = useRef(new THREE.Vector3(0, 0, 0))

  // Particle geometry is generated ONCE per mount with Math.random — an impure
  // call that React 19 only permits inside a lazy state initializer (never in
  // render body or useMemo factories). See react-hooks/purity.
  const [buffers] = useState(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const scales = new Float32Array(PARTICLE_COUNT)
    const speeds = new Float32Array(PARTICLE_COUNT)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spread in a wide box around the camera
      const radius = 4 + Math.random() * 9
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6
      positions[i * 3 + 2] = radius * Math.cos(phi) * 0.5 - 2
      scales[i] = Math.random() * 1.4 + 0.4
      speeds[i] = Math.random() * 0.6 + 0.2
      const c = COLORS[Math.floor(Math.random() * COLORS.length)]
      if (!c) continue
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    return { positions, scales, speeds, colors }
  })
  const { positions, scales, speeds, colors } = buffers

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
      uScroll: { value: 0 },
    }),
    []
  )

  useFrame((state, delta) => {
    if (!pointsRef.current) return
    // Three.js shader uniforms are mutated per-frame — the canonical R3F pattern.
    // eslint-disable-next-line react-hooks/immutability
    uniforms.uTime.value += delta

    // Lerp mouse target into the actual mouse vector (smoothing)
    mouseVec.current.x += (mouse.current.tx - mouseVec.current.x) * 0.04
    mouseVec.current.y += (mouse.current.ty - mouseVec.current.y) * 0.04
    uniforms.uMouse.value.copy(mouseVec.current)

    // Scroll bridge (methodology section) → gentle flow swell, lerped.
    const scrollTarget = getHeroScroll()
    uniforms.uScroll.value += (scrollTarget - uniforms.uScroll.value) * 0.08

    // Gentle group tilt toward mouse
    pointsRef.current.rotation.y += ((mouseVec.current.x * 0.25) - pointsRef.current.rotation.y) * 0.05
    pointsRef.current.rotation.x += ((mouseVec.current.y * 0.15) - pointsRef.current.rotation.x) * 0.05
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={PARTICLE_VERTEX}
        fragmentShader={PARTICLE_FRAGMENT}
      />
    </points>
  )
}

function AuroraBackdrop({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number; tx: number; ty: number }> }) {
  const mouseVec = useRef(new THREE.Vector2(0, 0))

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColorA: { value: new THREE.Color('#4285F4') },
      uColorB: { value: new THREE.Color('#34A853') },
    }),
    []
  )

  useFrame((state, delta) => {
    // Three.js shader uniforms are mutated per-frame — the canonical R3F pattern.
    // eslint-disable-next-line react-hooks/immutability
    uniforms.uTime.value += delta

    // Project the pointer onto the aurora plane in world space (aspect-
    // correct; numbers only — no per-frame allocations).
    const aspect = state.size.width / state.size.height
    const halfH = Math.tan(CAMERA_FOV_RAD * 0.5) * AURORA_PLANE_DIST
    mouseVec.current.x += (mouse.current.tx * halfH * aspect - mouseVec.current.x) * 0.05
    mouseVec.current.y += (mouse.current.ty * halfH - mouseVec.current.y) * 0.05
    uniforms.uMouse.value.copy(mouseVec.current)
  })

  return (
    <mesh position={[0, 0, AURORA_PLANE_Z]} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[64, 32]} />
      {/* True additive over the PAGE, not just over the framebuffer: the
          canvas is transparent, so plain AdditiveBlending (SRC_ALPHA, ONE)
          would accumulate alpha≈1 across the fullscreen plane and hide the
          CSS stage underneath. CustomBlending with (ONE,ONE / ZERO,ONE)
          adds light to the color buffer while leaving canvas alpha at 0 —
          the deep background, hero-fallback gradient and blueprint
          spotlight grid all stay visible beneath the aurora. */}
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.CustomBlending}
        blendSrc={THREE.OneFactor}
        blendDst={THREE.OneFactor}
        blendSrcAlpha={THREE.ZeroFactor}
        blendDstAlpha={THREE.OneFactor}
        uniforms={uniforms}
        vertexShader={AURORA_VERTEX}
        fragmentShader={AURORA_FRAGMENT}
      />
    </mesh>
  )
}

/** Batch 3 item 15 — scroll-driven camera dolly. Eases the camera +0.8
 *  units back as the methodology section's scroll progress (bridge)
 *  goes 0→1 — a subtle pull-away, RTL-safe (pure view-axis motion). */
function ScrollDolly() {
  useFrame((state) => {
    const targetZ = BASE_CAMERA_Z + getHeroScroll() * 0.8
    state.camera.position.z += (targetZ - state.camera.position.z) * 0.05
  })
  return null
}

/** Context-loss guard — `preventDefault()` marks the event as handled so
 *  the browser keeps the canvas alive for a possible restore (and stops
 *  the default console error spam); we log once for diagnostics. */
function ContextLossGuard() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      console.warn('[HeroCanvas] WebGL context lost')
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl])
  return null
}

interface HeroCanvasProps {
  active: boolean
}

export function HeroCanvas({ active }: HeroCanvasProps) {
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const [glAvailable, setGlAvailable] = useState(true)

  useEffect(() => {
    // WebGL feature detection — deferred to rAF so the setState isn't synchronous
    // inside the effect body (hydration-safe + lint-compliant).
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      try {
        const test = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')
        if (!test) setGlAvailable(false)
      } catch {
        setGlAvailable(false)
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.tx = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.ty = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  if (!glAvailable) return null

  return (
    <div className="absolute inset-0 -z-0">
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? 'always' : 'never'}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, BASE_CAMERA_Z], fov: 70 }}
        style={{ background: 'transparent' }}
      >
        <AuroraBackdrop mouse={mouse} />
        <Particles mouse={mouse} />
        <ScrollDolly />
        <ContextLossGuard />
      </Canvas>
    </div>
  )
}
