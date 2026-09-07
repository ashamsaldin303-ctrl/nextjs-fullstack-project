'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getScrollClocks, scrollEnergy, tickScrollTail } from '@/lib/scroll-store'
import { setRuneInvalidate } from './rune-bus'
import { BRAND_COLORS } from '@/lib/brand-colors'
import { buildAssembly, LANDMARK_PALETTES, type Assembly } from './rune-assemblies'
import { LANDMARK_ROUTES, type LandmarkSpec, type RunePresetKey } from './rune-landmarks'

/**
 * Rune Landmarks scene (RUNE-3) — the semantic scroll-clocked core.
 *
 * OWNER'S CONTRACT (2025, restated as enforced invariants):
 * 1. «مجسمات تدل على كل شيء على كل صفحة» — every landmark is a real,
 *    recognizable object BOUND to its section's actual DOM node: the
 *    automation gears, the calculator dials, the story's self-drawing
 *    path, the contact envelope… Nothing abstract, nothing roaming
 *    free. Each section's heading id resolves its SECTION element
 *    (closest('section')) — the object glues to the section's own box.
 * 2. «يتماشى الموقع مع التمرير لأعلى/أسفل» — the whole life of a
 *    landmark is a designed function of its section's travel through
 *    the viewport: entering → materialising + growing to presence;
 *    centred → holding, breathing (S clock), rotating with the signed
 *    scroll clock D; leaving → shrinking away. Scrolling UP replays
 *    the same design in reverse, frame-identical — pure functions.
 * 3. «مدروسة في كل مكان وكل ثانية وكل إطار» — zero randomness, zero
 *    wall-clock: every transform is f(section rect, D, S). Stop
 *    scrolling and the GPU renders ZERO frames (frameloop="demand" +
 *    the invalidate bus + the freeze-proof `frames` counter).
 * 4. «تكبير وتصغير» — the presence envelope scales each landmark in
 *    and out per section, and the S-clocked breathing keeps the held
 *    bodies alive while their section is on stage.
 *
 * Atmosphere: the dust field (proven RUNE-2 shader) streams with the
 * same clocks; TWO washes now FOLLOW the landmarks — their position
 * eases toward the visible ensemble's centroid and their color toward
 * the dominant section's palette, so the background literally travels
 * with the objects («الخلفية تتماشى معها»), section by section.
 *
 * Route changes (including the first build): the landmark SET differs
 * per route (different meanings), so transitions run through one
 * fade-out → rebuild → fade-in machine — no popping, no remount of the
 * GL context, one damped `fade` value.
 */

/* ------------------------------------------------------------------ *
 * GLSL — atmosphere layers (proven RUNE-2 shaders, unchanged physics)
 * ------------------------------------------------------------------ */

/* Dust — the ambient field. uD streams the motes past the viewport
 * with scroll-parallax (per-particle depth), S-clocked twinkle. All
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

/* Wash — the atmosphere layer: a huge soft radial field that now
 * FOLLOWS the landmarks (the driver eases its position/color toward
 * the visible ensemble). */
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

/* ------------------------------------------------------------------ *
 * Tuning
 * ------------------------------------------------------------------ */
const DUST_COUNT = 260
/** Route fade damping (out AND in): 1 - e^(-6·t) ≈ 95% after 0.5s. */
const FADE_K = 6
/** Convergence threshold below which settling stops chaining frames. */
const FADE_EPS = 0.002
/** Element rescan cadence (rendered frames) — catches lazy sections. */
const RESCAN_EVERY = 45

/** The designed presence envelope over a section's travel p (0..1):
 * materialise through the entry third, hold through the middle,
 * dissolve through the exit third. Pure — reverses exactly. */
function envelope(p: number): number {
  const inn = p < 0.04 ? 0 : p > 0.32 ? 1 : (p - 0.04) / 0.28
  const si = inn * inn * (3 - 2 * inn)
  const outt = p < 0.66 ? 1 : p > 0.96 ? 0 : 1 - (p - 0.66) / 0.3
  const so = outt * outt * (3 - 2 * outt)
  return si * so
}

/* ------------------------------------------------------------------ *
 * Dust geometry (deterministic — no Math.random in the render path)
 * ------------------------------------------------------------------ */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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

/* ------------------------------------------------------------------ *
 * Runtime landmark state
 * ------------------------------------------------------------------ */
interface LandmarkRT {
  spec: LandmarkSpec
  holder: THREE.Group
  assembly: Assembly
  /** Resolved SECTION node (heading id → closest('section')); null
   * while the (possibly lazy) section has not mounted yet. */
  el: HTMLElement | null
  /** Last computed travel progress (debug + wash weighting). */
  p: number
  env: number
}

interface WashRT {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  color: THREE.Color
  goalColor: THREE.Color
  x: number
  y: number
  gx: number
  gy: number
  scale: number
  goalScale: number
  alpha: number
  goalAlpha: number
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

interface FieldRT {
  root: THREE.Group
  /** The route's landmark set — swappable by the fade machine (a
   * nested mutable container, the RUNE-2 slot-state lineage). */
  registry: { list: LandmarkRT[]; dispose: () => void }
  dustMaterial: THREE.ShaderMaterial
  dustUniforms: DustUniforms
  washes: [WashRT, WashRT]
  disposeBase: () => void
}

/** Resolve a landmark's SECTION element from its heading id. */
function resolveSection(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const heading = document.getElementById(id)
  if (!heading) return null
  const section = heading.closest('section')
  return (section as HTMLElement | null) ?? heading
}

/** Build the landmark set for a route (assemblies + holders). */
function buildLandmarks(routeKey: RunePresetKey): { list: LandmarkRT[]; dispose: () => void } {
  const specs = LANDMARK_ROUTES[routeKey].landmarks
  const list: LandmarkRT[] = []
  const disposables: { dispose: () => void }[] = []
  for (const spec of specs) {
    const assembly = buildAssembly(spec)
    disposables.push({ dispose: assembly.dispose })
    const holder = new THREE.Group()
    holder.add(assembly.group)
    holder.visible = false
    // the semantic bodies draw above the atmosphere layers
    holder.traverse((o) => {
      o.renderOrder = 10
    })
    list.push({ spec, holder, assembly, el: null, p: 0, env: 0 })
  }
  return {
    list,
    dispose: () => {
      for (const d of disposables) d.dispose()
    },
  }
}

/** The persistent scene skeleton — atmosphere + an (initially empty)
 * landmark set the fade machine populates on the first frames. */
function buildField(): FieldRT {
  const root = new THREE.Group()

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

  const planeGeo = new THREE.PlaneGeometry(1, 1)
  const buildWash = (baseColor: string): WashRT => {
    const material = new THREE.ShaderMaterial({
      vertexShader: WASH_VERTEX,
      fragmentShader: WASH_FRAGMENT,
      uniforms: {
        uColor: { value: new THREE.Color(baseColor) },
        uAlpha: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(planeGeo, material)
    mesh.renderOrder = 0
    mesh.frustumCulled = false
    root.add(mesh)
    const color = material.uniforms['uColor']?.value as THREE.Color | undefined
    return {
      mesh,
      material,
      color: color ?? new THREE.Color(baseColor),
      goalColor: new THREE.Color(baseColor),
      x: 0, y: 0, gx: 0, gy: 0,
      scale: 1.6, goalScale: 1.6,
      alpha: 0, goalAlpha: 0.05,
    }
  }
  const washes: [WashRT, WashRT] = [buildWash(BRAND_COLORS.gBlue), buildWash(BRAND_COLORS.gGreen)]

  const emptySet = { list: [] as LandmarkRT[], dispose: () => {} }

  return {
    root,
    registry: emptySet,
    dustMaterial,
    dustUniforms,
    washes,
    disposeBase: () => {
      dustGeo.dispose()
      dustMaterial.dispose()
      planeGeo.dispose()
      for (const w of washes) w.material.dispose()
    },
  }
}

/* ------------------------------------------------------------------ *
 * Dev-only introspection (powers the verification gates)
 * ------------------------------------------------------------------ */
interface RuneDebug {
  route: RunePresetKey | null
  frames: number
  fps: number
  D: number
  S: number
  vy: number
  vel01: number
  fade: number
  fadePhase: 'in' | 'out'
  active: string
  landmarks: { id: string; kind: string; p: number; env: number; x: number; y: number; scale: number; found: boolean }[]
}

declare global {
  interface Window {
    __elyraRuneDebug?: RuneDebug
  }
}

const DEV = process.env.NODE_ENV !== 'production'

/* ------------------------------------------------------------------ *
 * Core
 * ------------------------------------------------------------------ */
function LandmarksCore({ presetKey, dir }: { presetKey: RunePresetKey; dir: 'rtl' | 'ltr' }) {
  const field = useMemo(() => buildField(), [])
  const invalidate = useThree((s) => s.invalidate)

  const fieldRef = useRef(field)
  // Route-fade machine: 'out' drains the fade, the landmark set is
  // rebuilt at zero, 'in' refills it. The FIRST build rides the same
  // machine (mount = fade-in, so nothing ever pops).
  const fade = useRef(0)
  const fadePhase = useRef<'in' | 'out'>('out')
  const builtKey = useRef<RunePresetKey | null>(null)
  const pendingKey = useRef<RunePresetKey | null>(presetKey)
  const frames = useRef(0)
  const fps = useRef(60)
  const dirRef = useRef(dir)
  const rescans = useRef(0)
  const dustGoal = useRef(LANDMARK_ROUTES[presetKey].dust)

  // Per-resource disposal + invalidate-bus registration. The field is
  // read through the MEMO closure inside useFrame (the RUNE-1 lineage:
  // closures over memos are escape-analyzed; the ref exists only for
  // the unmount disposal).
  useEffect(() => {
    const f = fieldRef.current
    return () => {
      f.registry.dispose()
      f.disposeBase()
    }
  }, [])

  useEffect(() => {
    setRuneInvalidate(invalidate)
    invalidate()
    return () => setRuneInvalidate(null)
  }, [invalidate])

  // Route change (and the very first run) → arm the fade machine.
  useEffect(() => {
    pendingKey.current = presetKey
    dustGoal.current = LANDMARK_ROUTES[presetKey].dust
    if (presetKey !== builtKey.current) {
      fadePhase.current = 'out'
    }
    invalidate()
  }, [presetKey, invalidate])

  // Writing-direction changes re-resolve sides live (no rebuild — the
  // anchors' logical sides are computed per frame from this ref).
  useEffect(() => {
    dirRef.current = dir
    invalidate()
  }, [dir, invalidate])

  useFrame((state, delta) => {
    const dt = delta > 0 ? Math.min(delta, 0.1) : 1 / 60
    const { D, S, vy } = getScrollClocks()
    const energy = scrollEnergy()
    const aspect = state.size.width / state.size.height
    const vh = state.size.height

    // ortho rig self-heal (y ∈ [-1,1] = viewport height, x by aspect)
    const cam = state.camera as THREE.OrthographicCamera
    if (cam.top !== 1 || cam.bottom !== -1 || Math.abs(cam.right - aspect) > 1e-3) {
      cam.left = -aspect
      cam.right = aspect
      cam.top = 1
      cam.bottom = -1
      cam.position.set(0, 0, 10)
      cam.updateProjectionMatrix()
    }

    const f = field
    // provenance break (RUNE-2 slot-list lineage): the registry handle
    // rides a local array literal so the compiler treats downstream
    // writes as fresh, not as mutations of the hook-argument value.
    const regArr: [{ list: LandmarkRT[]; dispose: () => void }] = [f.registry]
    const reg = regArr[0]
    if (!reg) return

    // --- route fade machine --------------------------------------------
    const fs = 1 - Math.exp(-FADE_K * dt)
    if (fadePhase.current === 'out') {
      fade.current += (0 - fade.current) * fs
      if (fade.current < FADE_EPS) {
        fade.current = 0
        const next = pendingKey.current
        if (next !== null && next !== builtKey.current) {
          for (const lm of reg.list) f.root.remove(lm.holder)
          reg.dispose()
          const built = buildLandmarks(next)
          for (const lm of built.list) f.root.add(lm.holder)
          reg.list = built.list
          reg.dispose = built.dispose
          builtKey.current = next
          rescans.current = 0
        }
        fadePhase.current = 'in'
      }
    } else {
      fade.current += (1 - fade.current) * fs
    }
    const fadeV = fade.current
    let settleDelta = Math.abs(1 - fadeV)

    // --- landmark driver: pure f(rect, D, S) -----------------------------
    // Element rescan cadence + null-retry (lazy sections mount late).
    rescans.current += 1
    const doRescan = rescans.current % RESCAN_EVERY === 1
    let activeId = ''
    let activeEnv = 0
    let cx = 0
    let cy = 0
    let cw = 0
    let dominant: LandmarkRT | null = null

    for (const lm of reg.list) {
      if (doRescan || lm.el === null) {
        lm.el = resolveSection(lm.spec.id)
      }
      const el = lm.el
      if (el === null) {
        lm.env = 0
        lm.p = 0
        lm.holder.visible = false
        continue
      }
      const rect = el.getBoundingClientRect()
      const travel = rect.height + vh
      const rawP = (vh - rect.top) / travel
      const p = rawP < 0 ? 0 : rawP > 1 ? 1 : rawP
      const env = envelope(p)
      lm.p = p
      lm.env = env

      const alpha = env * fadeV
      if (alpha <= 0.015) {
        lm.holder.visible = false
        continue
      }
      lm.holder.visible = true

      // glue: the section's designed anchor point, in world units
      const spec = lm.spec
      const xFrac =
        (spec.side === 'center'
          ? 0.5
          : dirRef.current === 'rtl'
            ? spec.side === 'start'
              ? 0.76
              : 0.24
            : spec.side === 'start'
              ? 0.24
              : 0.76) + (spec.xPad ?? 0)
      const maxX = aspect - 0.18
      let x = (xFrac * 2 - 1) * aspect
      if (x > maxX) x = maxX
      if (x < -maxX) x = -maxX
      x += Math.sin(S * 0.0011 + spec.phase) * 0.03 // designed gentle sway
      const anchorPx = rect.top + rect.height * spec.yFrac
      const y = 1 - 2 * (anchorPx / vh) + (spec.yOff ?? 0)

      const breath = 1 + spec.breath * 0.5 * Math.sin(S * 0.0024 + spec.phase)
      const scale = Math.max(spec.scale * env * breath, 0.0001)

      const holder = lm.holder
      holder.position.set(x, y, 0)
      holder.scale.setScalar(scale)
      holder.rotation.y = D * spec.spin

      lm.assembly.tick(p, D, S, energy, alpha)

      if (env > activeEnv) {
        activeEnv = env
        activeId = spec.id
        dominant = lm
      }
      cx += x * env
      cy += y * env
      cw += env
    }

    // --- washes: the atmosphere follows the ensemble ----------------------
    // (local-array provenance break — the RUNE-2 washCur lineage)
    const washArr: [WashRT, WashRT] = [f.washes[0], f.washes[1]]
    if (cw > 0.001 && dominant !== null) {
      const w0 = washArr[0]
      const w1 = washArr[1]
      const pal = LANDMARK_PALETTES[dominant.spec.palette]
      if (w0 && w1) {
        w0.gx = cx / cw
        w0.gy = cy / cw
        w0.goalScale = 1.5 + activeEnv * 0.6
        w0.goalAlpha = 0.045 + 0.05 * activeEnv
        w0.goalColor.set(pal.edge)
        // the counterpoint wash rests opposite, quieter
        w1.gx = -w0.gx * 0.6
        w1.gy = -0.3 - w0.gy * 0.4
        w1.goalScale = 1.1
        w1.goalAlpha = 0.03 + 0.035 * activeEnv
        w1.goalColor.set(pal.edge2)
      }
    }
    const ws = 1 - Math.exp(-2.5 * dt)
    for (const w of washArr) {
      w.x += (w.gx - w.x) * ws
      w.y += (w.gy - w.y) * ws
      w.scale += (w.goalScale - w.scale) * ws
      w.alpha += (w.goalAlpha - w.alpha) * ws
      w.color.lerp(w.goalColor, ws)
      w.mesh.position.set(w.x, w.y, 0)
      w.mesh.scale.setScalar(Math.max(w.scale * 2, 0.0001))
      // uniform write through the sanctioned local-alias path
      const wU = w.material.uniforms
      const uA = wU['uAlpha'] as { value: number } | undefined
      if (uA) uA.value = w.alpha
      const wd = Math.abs(w.goalAlpha - w.alpha)
      if (wd > settleDelta) settleDelta = wd
    }

    // --- dust --------------------------------------------------------------
    const dustUList: [DustUniforms] = [f.dustUniforms]
    const d0 = dustUList[0]
    if (d0) {
      const dd = Math.abs(dustGoal.current - d0.uDensity.value)
      d0.uDensity.value += (dustGoal.current - d0.uDensity.value) * ws
      if (dd > settleDelta) settleDelta = dd
      d0.uD.value = D
      d0.uS.value = S
      d0.uAspect.value = aspect
      d0.uEnergy.value = energy
      d0.uPixelRatio.value = state.viewport.dpr
    }

    // --- frame chaining: scroll events already poke the bus; keep the
    // loop alive only while the fade/wash/dust settle or the velocity
    // tail drains. Idle page ⇒ zero rendered frames (freeze proof).
    const tailActive = tickScrollTail(dt)
    if (tailActive || settleDelta > FADE_EPS) invalidate()

    // --- dev introspection ---------------------------------------------------
    if (DEV) {
      frames.current += 1
      const measured = dt > 0 ? 1 / dt : 60
      fps.current += (measured - fps.current) * 0.1
      window.__elyraRuneDebug = {
        route: builtKey.current,
        frames: frames.current,
        fps: fps.current,
        D,
        S,
        vy,
        vel01: energy,
        fade: fadeV,
        fadePhase: fadePhase.current,
        active: activeId,
        landmarks: reg.list.map((lm) => ({
          id: lm.spec.id,
          kind: lm.spec.kind,
          p: lm.p,
          env: lm.env,
          x: lm.holder.position.x,
          y: lm.holder.position.y,
          scale: lm.holder.scale.x,
          found: lm.el !== null,
        })),
      }
    }
  })

  return <primitive object={field.root} />
}

/** Context-loss guard — same contract as hero-canvas / capability-scene. */
function ContextLossGuard() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      console.warn('[RuneLandmarks] WebGL context lost')
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl])
  return null
}

export interface RuneSceneProps {
  /** Tab-visibility gate — 'never' frameloop while hidden. */
  active: boolean
  /** Locale-stripped route key — drives the landmark set. */
  presetKey: RunePresetKey
  /** Writing direction — resolves the anchors' logical sides. */
  dir: 'rtl' | 'ltr'
}

export function RuneScene({ active, presetKey, dir }: RuneSceneProps) {
  return (
    <Canvas
      orthographic
      frameloop={active ? 'demand' : 'never'}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 10], near: 0.1, far: 50, zoom: 1 }}
      gl={{ antialias: true, alpha: true }}
      style={{
        background: 'transparent',
        // R3F defaults its container to pointer-events:auto; this layer
        // is pure decoration — clicks must always fall through (G8).
        pointerEvents: 'none',
      }}
    >
      <LandmarksCore presetKey={presetKey} dir={dir} />
      <ContextLossGuard />
    </Canvas>
  )
}
