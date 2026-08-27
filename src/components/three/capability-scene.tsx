'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Interactive 3D capability scene for /services/websites.
 *
 * Centerpiece (Task 4 visual upgrade): a "liquid glass / iridescent" blob —
 * an IcosahedronGeometry whose vertices are displaced by time-animated 3D
 * simplex noise (custom ShaderMaterial, GLSL1 attribute/varying style per
 * repo convention) and shaded with a Fresnel rim + iridescent gradient
 * through the brand blues (#4285F4 → #0071E3 → #60A5FA) with a hint of
 * brand green (#34A853) at grazing angles and a soft deep-blue inner glow.
 * Around it: three glass satellites (clearcoat + RoomEnvironment IBL) on
 * tilted elliptical orbits marked by thin additive torus rings, plus a
 * ~600-point particle halo in the brand palette.
 *
 * Kept from the previous architecture: PMREM/RoomEnvironment IBL, ambient +
 * 4 brand-colored point lights, drag-to-rotate with pointer capture, mouse
 * parallax lerp, auto-spin when idle, DPR [1,2], frameloop gated on `active`,
 * ContextLossGuard, WebGL feature detection, and explicit disposal of every
 * prop-passed geometry/material (R3F only disposes JSX-declared ones).
 *
 * React 19 note: react-hooks/immutability disallows mutating plain useRef
 * objects inside useFrame — we mutate only attached object refs (group
 * rotation/position, owned shader uniforms via the material's uniform
 * object) and accumulate drag deltas in event handlers. Impure Math.random
 * (halo particle field) lives exclusively in a lazy useState initializer.
 */

const LIGHTS: { color: string; pos: [number, number, number] }[] = [
  { color: '#4285F4', pos: [3, 2, 4] },
  { color: '#34A853', pos: [-3, 2, 4] },
  { color: '#0071E3', pos: [3, -2, 2] },
  { color: '#E8F2FF', pos: [-3, -2, 2] },
]

/** Halo palette — brand blues with green/cool-white counterpoints. */
const HALO_COLORS = [
  new THREE.Color('#4285F4'),
  new THREE.Color('#4285F4'),
  new THREE.Color('#0071E3'),
  new THREE.Color('#0071E3'),
  new THREE.Color('#60A5FA'),
  new THREE.Color('#60A5FA'),
  new THREE.Color('#34A853'),
  new THREE.Color('#E8F2FF'),
]

const HALO_COUNT = 600

/** Deterministic satellite orbit layout (no randomness → useMemo stays pure). */
interface OrbitConfig {
  /** Base orbit radius (local units, before the ellipse stretch) */
  radius: number
  /** Ellipse stretch on the local X axis (ring + satellite share it) */
  sx: number
  /** Satellite sphere radius */
  size: number
  color: string
  /** Orbit plane tilt (applied to the whole orbit group) */
  tilt: [number, number, number]
  /** Angular speed (rad/s) — negative = opposite direction */
  speed: number
  /** Start angle (rad) so satellites never cluster at launch */
  phase: number
}

const ORBITS: OrbitConfig[] = [
  { radius: 1.9, sx: 1.35, size: 0.1, color: '#4285F4', tilt: [Math.PI * 0.42, 0, Math.PI * 0.1], speed: 0.45, phase: 0 },
  { radius: 2.3, sx: 0.8, size: 0.085, color: '#60A5FA', tilt: [Math.PI * 0.55, 0.2, -Math.PI * 0.3], speed: -0.34, phase: 2.2 },
  { radius: 2.55, sx: 1.12, size: 0.095, color: '#34A853', tilt: [Math.PI * 0.35, -0.5, Math.PI * 0.38], speed: 0.27, phase: 4.4 },
]

/* ------------------------------------------------------------------ *
 * GLSL — Ashima 3D simplex noise (Stefan Gustavson / Ian McEwan, MIT),
 * identical to the NOISE_GLSL block in hero-canvas.tsx so both shader
 * materials share one proven noise implementation. GLSL1 style.
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
`

/* Liquid-glass blob: vertices displaced along the radial direction by two
 * simplex octaves sampled in a slowly-translating space (the surface flows
 * like liquid instead of pulsing in place). Normals are recomputed with
 * finite differences on the displaced surface so the Fresnel shading stays
 * crisp — no CPU geometry updates, everything lives on the GPU. */
const BLOB_VERTEX = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uTime;
  uniform float uAmp;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vNoise;

  // Any unit vector perpendicular to v (numerically safe for poles).
  vec3 orthogonal(vec3 v) {
    return normalize(abs(v.x) > abs(v.z)
      ? vec3(-v.y, v.x, 0.0)
      : vec3(0.0, -v.z, v.y));
  }

  float surfaceNoise(vec3 p) {
    vec3 dir = normalize(p);
    vec3 q = dir * 1.7;
    float n = snoise(q + vec3(0.0, uTime * 0.16, uTime * 0.11));
    n += 0.45 * snoise(q * 2.3 - vec3(uTime * 0.09, 0.0, uTime * 0.13));
    return n;
  }

  void main() {
    // Slow "breathing" keeps the silhouette organic but stable (~0.12).
    float amp = uAmp * (0.85 + 0.15 * sin(uTime * 0.45));

    vec3 dir = normalize(position);
    float n0 = surfaceNoise(position);
    vNoise = n0;
    vec3 p = position + dir * n0 * amp;

    // Tangent frame on the sphere → displaced neighbors → cross product
    // gives the perturbed normal (duplicated icosphere vertices share
    // positions, so seams get identical results — no cracks).
    float eps = 0.06;
    vec3 tangent = orthogonal(dir);
    vec3 bitangent = normalize(cross(dir, tangent));
    vec3 pt = position + tangent * eps;
    pt += normalize(pt) * surfaceNoise(pt) * amp;
    vec3 pb = position + bitangent * eps;
    pb += normalize(pb) * surfaceNoise(pb) * amp;
    vec3 n = normalize(cross(pt - p, pb - p));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * n);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const BLOB_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA; // #4285F4 brand blue
  uniform vec3 uColorB; // #0071E3 deep blue
  uniform vec3 uColorC; // #60A5FA light blue
  uniform vec3 uColorG; // #34A853 brand green
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vNoise;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    // Fresnel rim — the glassy edge highlight
    float fresnel = pow(1.0 - ndv, 2.4);

    // Iridescent body gradient driven by the displacement field: deep blue
    // valleys → brand blue → light blue crests.
    float g = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
    vec3 body = mix(uColorB * 0.45, uColorA, g);
    body = mix(body, uColorC, pow(g, 2.2) * 0.55);
    // Thin-film hint of brand green only at grazing angles.
    body = mix(body, uColorG, fresnel * 0.30);

    // Soft inner glow — deep-blue energy core seen through the glass.
    vec3 col = body + uColorB * pow(ndv, 2.5) * 0.35;
    // Bright rim, slightly whitened.
    col += mix(uColorC, vec3(1.0), 0.4) * fresnel * 0.85;
    // Gentle animated sheen for the "liquid" feel.
    col += uColorC * 0.06 * sin(uTime * 0.5 + vNoise * 6.28318);

    // Single fake key-light glint (view space) — a specular sparkle without
    // needing the IBL, which ShaderMaterial cannot sample anyway.
    vec3 L = normalize(vec3(0.4, 0.65, 0.8));
    vec3 R = reflect(-V, N);
    col += vec3(0.9, 0.95, 1.0) * pow(max(dot(R, L), 0.0), 48.0) * 0.55;

    gl_FragColor = vec4(col, 1.0);
  }
`

/* Particle halo — soft round additive sprites (same pattern as
 * hero-canvas.tsx), gently breathing and twinkling in the brand palette. */
const HALO_VERTEX = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    // gentle radial breathing of the whole shell
    p *= 1.0 + 0.03 * sin(uTime * 0.3 + aPhase);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aScale * uPixelRatio * (24.0 / -mv.z);
    gl_PointSize = clamp(size, 1.0, 20.0);
    vColor = aColor;
    // soft per-particle twinkle
    vAlpha = 0.45 + 0.35 * sin(uTime * 0.8 + aPhase);
  }
`

const HALO_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`

function Centerpiece({ dragging }: { dragging: boolean }) {
  // spinner: drag/auto-spin rotation. parallax: mouse-lerp position (parent
  // of everything so halo + satellites drift together for depth).
  const spinner = useRef<THREE.Group>(null)
  const parallax = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Points>(null)
  const satRefs = useRef<(THREE.Mesh | null)[]>([])
  const last = useRef({ x: 0, y: 0 })
  const mouse = useRef({ tx: 0, ty: 0 })
  // FIX(2-c/4): R3F pointer events can't be rAF-coalesced (they fire inside
  // the render loop's event pass), so throttle to ~60Hz with a timestamp
  // guard — early return when the last processed event was <16ms ago.
  const lastPointerTs = useRef(0)
  const { viewport } = useThree()

  // --- liquid-glass blob ------------------------------------------------
  const blobGeo = useMemo(() => new THREE.IcosahedronGeometry(1.1, 5), [])
  const blobUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.12 },
      uColorA: { value: new THREE.Color('#4285F4') },
      uColorB: { value: new THREE.Color('#0071E3') },
      uColorC: { value: new THREE.Color('#60A5FA') },
      uColorG: { value: new THREE.Color('#34A853') },
    }),
    []
  )
  const blobMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BLOB_VERTEX,
        fragmentShader: BLOB_FRAGMENT,
        uniforms: blobUniforms,
      }),
    [blobUniforms]
  )

  // --- particle halo ------------------------------------------------------
  // Geometry is generated ONCE per mount with Math.random — an impure call
  // that React 19 only permits inside a lazy state initializer (never in a
  // render body or useMemo factory). See react-hooks/purity.
  const [haloBuffers] = useState(() => {
    const positions = new Float32Array(HALO_COUNT * 3)
    const scales = new Float32Array(HALO_COUNT)
    const phases = new Float32Array(HALO_COUNT)
    const colors = new Float32Array(HALO_COUNT * 3)
    for (let i = 0; i < HALO_COUNT; i++) {
      // uniform direction on the sphere → spherical shell around the blob
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 2.1 + Math.random() * 1.1
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.85
      positions[i * 3 + 2] = r * Math.cos(phi)
      scales[i] = 0.5 + Math.random() * 1.1
      phases[i] = Math.random() * Math.PI * 2
      const c = HALO_COLORS[Math.floor(Math.random() * HALO_COLORS.length)]
      if (!c) continue
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    return { positions, scales, phases, colors }
  })
  const haloGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(haloBuffers.positions, 3))
    g.setAttribute('aScale', new THREE.BufferAttribute(haloBuffers.scales, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(haloBuffers.phases, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(haloBuffers.colors, 3))
    return g
  }, [haloBuffers])
  const haloUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
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

  // FIX(2-c/10): R3F does not dispose prop-passed geometry/material (only
  // JSX-declared ones) — free the GPU buffers explicitly on unmount. The
  // satellites/rings below are JSX-declared so R3F handles those.
  useEffect(() => {
    return () => {
      blobGeo.dispose()
      blobMat.dispose()
      haloGeo.dispose()
      haloMat.dispose()
    }
  }, [blobGeo, blobMat, haloGeo, haloMat])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    // Shader uniforms are owned three.js objects — canonical R3F pattern.
    // eslint-disable-next-line react-hooks/immutability
    blobUniforms.uTime.value = t
    // eslint-disable-next-line react-hooks/immutability
    haloUniforms.uTime.value = t

    if (spinner.current && !dragging) {
      // gentle auto-spin
      spinner.current.rotation.y += delta * 0.25
    }
    // mouse parallax (lerp position toward mouse target)
    if (parallax.current) {
      const tx = (mouse.current.tx * viewport.width) / 4
      const ty = (mouse.current.ty * viewport.height) / 4
      parallax.current.position.x += (tx - parallax.current.position.x) * 0.04
      parallax.current.position.y += (ty - parallax.current.position.y) * 0.04
    }
    // ambient halo drift — independent of the drag spinner so the dust
    // cloud feels like environment, not part of the object
    if (haloRef.current) {
      haloRef.current.rotation.y += delta * 0.04
      haloRef.current.rotation.z += delta * 0.01
    }
    // satellites ride their tilted elliptical orbits (local XY plane of
    // each tilted group; sx mirrors the ring's non-uniform scale)
    ORBITS.forEach((o, i) => {
      const mesh = satRefs.current[i]
      if (!mesh) return
      const a = o.phase + t * o.speed
      mesh.position.set(Math.cos(a) * o.radius * o.sx, Math.sin(a) * o.radius, 0)
    })
  })

  return (
    <group
      ref={parallax}
      onPointerDown={(e) => {
        last.current.x = e.clientX
        last.current.y = e.clientY
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        // FIX(2-c/4): ~60Hz throttle — skips the rect read + drag delta
        // math for sub-frame events. Early return BEFORE updating
        // `last` keeps drag deltas accumulation-correct.
        const now = performance.now()
        if (now - lastPointerTs.current < 16) return
        lastPointerTs.current = now
        // mutate spinner.current.rotation directly — Three.js Object3D, allowed
        if (spinner.current && dragging) {
          const dx = e.clientX - last.current.x
          const dy = e.clientY - last.current.y
          spinner.current.rotation.y += dx * 0.01
          spinner.current.rotation.x += dy * 0.01
        }
        last.current.x = e.clientX
        last.current.y = e.clientY
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect?.()
        if (rect) {
          mouse.current.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1
          mouse.current.ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
        }
      }}
    >
      <group ref={spinner}>
        {/* liquid-glass iridescent centerpiece */}
        <mesh geometry={blobGeo} material={blobMat} />
        {/* glass satellites + orbit-path rings */}
        {ORBITS.map((o, i) => (
          <group key={`orbit-${i}`} rotation={o.tilt}>
            <mesh ref={(m) => { satRefs.current[i] = m }}>
              <sphereGeometry args={[o.size, 24, 24]} />
              {/* clearcoat + RoomEnvironment IBL reads as glass without the
                  cost of a transmission pass */}
              <meshPhysicalMaterial
                color={o.color}
                metalness={0.1}
                roughness={0.05}
                clearcoat={1}
                clearcoatRoughness={0.12}
                envMapIntensity={1.6}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* faint additive ring marking the orbit path — stretched on X
                to match the satellite's ellipse */}
            <mesh scale={[o.sx, 1, 1]}>
              <torusGeometry args={[o.radius, 0.006, 6, 96]} />
              <meshBasicMaterial
                color={o.color}
                transparent
                opacity={0.16}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}
      </group>
      <points ref={haloRef} geometry={haloGeo} material={haloMat} frustumCulled={false} />
    </group>
  )
}

/** Batch 3 item 14 — image-based lighting for the glass satellites.
 * PMREMGenerator + RoomEnvironment ship with three itself (no new
 * dependency); the prefiltered radiance map is applied via
 * scene.environment so every MeshStandard/Physical material in the scene
 * gets ambient reflections. The room scene, render target and generator
 * are all disposed on unmount. */
function RoomEnv() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.04)
    // scene.environment is the canonical three.js IBL wiring (Object3D
    // property, written once per mount) — same R3F mutation exemption as
    // the per-frame uniform updates in hero-canvas.
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/immutability
    scene.environment = target.texture
    room.dispose()
    return () => {
      scene.environment = null
      target.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

/** FIX(2-c/10): context-loss guard — `preventDefault()` marks the event
 *  as handled so the browser keeps the canvas alive for a possible restore
 *  (and stops the default console error spam); we log once for diagnostics. */
function ContextLossGuard() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      console.warn('[CapabilityScene] WebGL context lost')
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl])
  return null
}

export function CapabilityScene({ active }: { active: boolean }) {
  const [glAvailable, setGlAvailable] = useState(true)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      try {
        const test =
          document.createElement('canvas').getContext('webgl2') ??
          document.createElement('canvas').getContext('webgl')
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

  if (!glAvailable) return null

  return (
    <div
      className="absolute inset-0"
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? 'always' : 'never'}
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.25} />
        {LIGHTS.map((l, i) => (
          <pointLight key={i} color={l.color} position={l.pos} intensity={28} distance={12} />
        ))}
        <RoomEnv />
        <Centerpiece dragging={dragging} />
        <ContextLossGuard />
      </Canvas>
    </div>
  )
}
