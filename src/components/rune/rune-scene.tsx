'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { getScrollClocks, scrollEnergy, tickScrollTail } from '@/lib/scroll-store'
import { pokeRuneField, setRuneInvalidate } from './rune-bus'
import { BRAND_COLORS } from '@/lib/brand-colors'
import { MODEL_LIBRARY, MODEL_ROUTES, SLOT_PALETTES, type ModelDef, type PartDrive, type RunePresetKey } from './model-registry'
import { loadInstrument, type RawInstrument } from './model-loader'

/**
 * Rune Instruments scene (HEAVY-1) — the REAL-MODEL core.
 *
 * OWNER'S CONTRACT (2025, restated as enforced invariants):
 * 1. «أجسام ثقيلة واقعية مصنوعة ببلندر» — every body is now a REAL,
 *    downloaded, CC0, Blender-authored instrument (Poly Haven), loaded
 *    through the GLTF cache and rendered with full PBR (studio
 *    environment, warm key + cool rim, contact ground shadow).
 * 2. «تموضع صحيح» — each instrument holds ONE STABLE, composed slot in
 *    its section's free margin: constant size (a fraction of the
 *    viewport), constant depth plane, museum-plinth position from the
 *    section's own rect. It does NOT roam and does NOT balloon; it
 *    MATERIALIZES (fade + rise + settle) as its section arrives and
 *    dissolves as it leaves — scrolling up replays it in reverse.
 * 3. «أنيميشن صحيحة» — three designed motion layers, all pure
 *    functions of (section rect, D, S), zero wall-clock, zero
 *    randomness:
 *      · whole-body SCRUB — rotation.y sweeps `scrub` radians across
 *        the section's travel (reversible, frame-identical);
 *      · PART drives — the clock's hands, the compass needle, the
 *        multimeter needle, the radio's antenna/dial/morse key: real
 *        named nodes of the real models, driven by D (odometers — the
 *        hands advance exactly as far as you scroll) or by the eased
 *        section progress p (sweeps and discrete steps);
 *      · pointer micro-parallax — the camera eases ±0.06 world units;
 *        the depth planes (models vs atmosphere) separate subtly.
 *    Stop scrolling (and stop moving the pointer) and the GPU renders
 *    ZERO frames — frameloop="demand" + the invalidate bus + the
 *    freeze-proof `frames` counter.
 *
 * Atmosphere (unchanged physics, frustum-adapted math): the dust field
 * streams with the same clocks; the two washes follow the ACTIVE
 * instrument (position + palette), so the background literally travels
 * with the object, section by section.
 *
 * Route changes (and the first build): the instrument SET differs per
 * route, so transitions run through one fade-out → rebuild → fade-in
 * machine — no popping, no remount of the GL context, one damped
 * `fade`. Models load asynchronously through the module cache; a slot
 * stays dark until its model resolves, then its own damped presence
 * carries it in.
 */

/* ------------------------------------------------------------------ *
 * Rig constants — one perspective stage.
 * ------------------------------------------------------------------ */
const FOV = 34
const CAM_Z = 7.5
/** Atmosphere planes sit behind the instruments (real depth). */
const WASH_Z = -2.5
/** Route fade damping (out AND in): 1 - e^(-6·t) ≈ 95% after 0.5s. */
const FADE_K = 6
/** Convergence threshold below which settling stops chaining frames. */
const FADE_EPS = 0.002
/** Presence damping for each instrument's materialise/dissolve. */
const PRESENCE_K = 5.5
/** Element rescan cadence (rendered frames) — catches lazy sections. */
const RESCAN_EVERY = 45

/* ------------------------------------------------------------------ *
 * GLSL — atmosphere layers (proven RUNE-2 physics, frustum units)
 * ------------------------------------------------------------------ */

/* Dust — the ambient field, now spanning the perspective frustum's
 * z=0 slab (uHalfH = half viewport height in world units at that
 * depth). All scroll-clock: a stopped page has frozen dust. */
const DUST_VERTEX = /* glsl */ `
  attribute float aDepth;
  attribute float aPhase;
  attribute float aAlpha;
  uniform float uD;
  uniform float uS;
  uniform float uAspect;
  uniform float uHalfH;
  uniform float uDensity;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform float uParX;
  uniform float uParY;
  varying float vAlpha;

  void main() {
    float x = (position.x * uAspect + sin(uS * 0.0009 + aPhase) * 0.03) * uHalfH + uParX;
    float y = mod(position.y * uHalfH + uD * 0.00021 * aDepth + uParY + uHalfH, 2.0 * uHalfH) - uHalfH;
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

/* Wash — the atmosphere layer: a huge soft radial field that FOLLOWS
 * the active instrument (the driver eases its position/color toward
 * the visible body). */
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

/* The ground-shadow sprite (shared, page-lifetime): a soft white
 * radial that a dark MeshBasicMaterial tints into ink; plane-scaled
 * per instrument into the elliptical drop shadow that GROUNDS each
 * body in the UI. */
let shadowTex: THREE.CanvasTexture | null = null

function groundShadowSprite(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 31)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(0.6, 'rgba(255,255,255,0.35)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 64)
  }
  shadowTex = new THREE.CanvasTexture(c)
  return shadowTex
}

/* ------------------------------------------------------------------ *
 * Tuning
 * ------------------------------------------------------------------ */
const DUST_COUNT = 260

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

/** Smooth 0..1 ease used for scrub/sweep pacing. */
function ease01(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
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
 * The studio environment — PMREM from the procedural RoomEnvironment
 * (no network, no HDR file): neutral studio reflections for the PBR
 * metals. Held at module level and applied per-material at clone
 * time (the react-compiler contract forbids mutating the useThree
 * scene object; materials own their envMap anyway). Generated once
 * per scene mount, disposed on unmount (the official three.js
 * RoomEnvironment pattern).
 * ------------------------------------------------------------------ */
let studioEnv: THREE.Texture | null = null

/* ------------------------------------------------------------------ *
 * Instrument runtime — a real model mounted into a slot
 * ------------------------------------------------------------------ */

interface MatEntry {
  mat: THREE.Material
  baseOpacity: number
  baseTransparent: boolean
}

interface DriveRT {
  node: THREE.Object3D
  axis: 'x' | 'y' | 'z'
  base: number
  drive: PartDrive
}

export interface InstrumentRT {
  /** Centered clone holder — added to the slot's group. */
  group: THREE.Group
  /** Per-mount cloned materials (owned here; textures stay shared). */
  mats: MatEntry[]
  /** Resolved named parts (drives). */
  drives: DriveRT[]
  fitDim: number
  size: THREE.Vector3
  center: THREE.Vector3
  /** Last applied presence (skips needless material traversals). */
  lastPresence: number
  dispose: () => void
}

/** Find a node by name (exact, then suffix, then substring). */
function findNode(root: THREE.Object3D, part: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null
  root.traverse((o) => {
    if (hit) return
    if (o.name === part) hit = o
  })
  if (hit) return hit
  root.traverse((o) => {
    if (hit) return
    if (o.name.endsWith(`_${part}`)) hit = o
  })
  if (hit) return hit
  root.traverse((o) => {
    if (hit) return
    if (o.name.includes(part)) hit = o
  })
  return hit
}

/** Clone + prepare a real instrument for its slot: centered at the
 * bbox origin, materials cloned for presence fades, PBR env intensity
 * set, drive nodes resolved. The cache keeps owning geometries and
 * textures — only the cloned materials are disposed per mount. */
function buildInstrument(def: ModelDef, raw: RawInstrument): InstrumentRT {
  const clone = raw.scene.clone(true)
  // Center the bbox at the holder origin (rotation/scale pivot).
  clone.position.set(-raw.center.x, -raw.center.y, -raw.center.z)

  const group = new THREE.Group()
  group.add(clone)

  const mats: MatEntry[] = []
  const disposables: THREE.Material[] = []
  clone.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    o.renderOrder = 10
    const prep = (m: THREE.Material): THREE.Material => {
      const c = m.clone()
      const std = c as THREE.MeshStandardMaterial
      if ('envMapIntensity' in std) {
        if (studioEnv) std.envMap = studioEnv
        std.envMapIntensity = def.envIntensity ?? 1
      }
      // IDEA-GLOW (MODEL-2, VLM r3): optional uniform warm emissive —
      // the lightbulb's inner idea-glow («الفكرة تبدأ بمحادثة»). A pure
      // material constant: a given scroll position renders identically.
      if (def.glow && 'emissiveIntensity' in std) {
        std.emissive = new THREE.Color(0xffd9a0)
        std.emissiveIntensity = def.glow
      }
      // GLASS DISCIPLINE (VLM rounds 2–4): the assets' smoked-glass
      // panes (clock hood, meter faces, lantern, searchlight lens)
      // reflect the dark scene and read as black mirrors that swallow
      // the cream dials BEHIND them. Dim every glass pane — few env
      // reflections, half opacity — so the instruments' faces stay
      // readable through a subtle sheen.
      if (/glass/i.test(c.name ?? '')) {
        if ('envMapIntensity' in std) std.envMapIntensity = (def.envIntensity ?? 1) * 0.25
        c.opacity = c.opacity * 0.45
      }
      disposables.push(c)
      mats.push({ mat: c, baseOpacity: c.opacity, baseTransparent: c.transparent })
      return c
    }
    o.material = Array.isArray(o.material) ? o.material.map(prep) : prep(o.material)
  })

  const drives: DriveRT[] = []
  for (const d of def.drives ?? []) {
    const node = findNode(clone, d.node)
    if (node) drives.push({ node, axis: d.axis, base: node.rotation[d.axis], drive: d })
  }

  const fitDim =
    def.fit === 'height'
      ? raw.size.y
      : def.fit === 'width'
        ? raw.size.x
        : Math.max(raw.size.x, raw.size.y, raw.size.z)

  return {
    group,
    mats,
    drives,
    fitDim: Math.max(fitDim, 1e-6),
    size: raw.size,
    center: raw.center,
    lastPresence: -1,
    dispose: () => {
      for (const m of disposables) m.dispose()
    },
  }
}

interface SlotRT {
  slot: (typeof MODEL_ROUTES)[RunePresetKey]['slots'][number]
  def: ModelDef
  holder: THREE.Group
  shadow: THREE.Mesh
  shadowMat: THREE.MeshBasicMaterial
  /** Resolved SECTION node; null while (possibly lazy) not mounted. */
  el: HTMLElement | null
  p: number
  env: number
  /** Damped materialise/dissolve value (0..1). */
  presence: number
  ready: boolean
  instrument: InstrumentRT | null
  /** Liveness token — rejects async attaches after a rebuild. */
  token: { alive: boolean }
  shadowW: number
  shadowY: number
}

interface WashRT {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  color: THREE.Color
  goalColor: THREE.Color
  gx: number
  gy: number
  goalX: number
  goalY: number
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
  uHalfH: { value: number }
  uDensity: { value: number }
  uEnergy: { value: number }
  uPixelRatio: { value: number }
  uParX: { value: number }
  uParY: { value: number }
  uColor: { value: THREE.Color }
}

interface FieldRT {
  root: THREE.Group
  /** The route's instrument set — swappable by the fade machine. */
  registry: { list: SlotRT[]; dispose: () => void }
  dustMaterial: THREE.ShaderMaterial
  dustUniforms: DustUniforms
  washes: [WashRT, WashRT]
  disposeBase: () => void
}

/** Resolve a slot's SECTION element from its heading id. */
function resolveSection(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const heading = document.getElementById(id)
  if (!heading) return null
  const section = heading.closest('section')
  return (section as HTMLElement | null) ?? heading
}

/** Build the instrument set for a route (holders + shadows + async
 * model loads). A slot stays dark until its model resolves, then its
 * own damped presence carries it in (the load pokes the bus). */
function buildSlots(routeKey: RunePresetKey): { list: SlotRT[]; dispose: () => void } {
  const route = MODEL_ROUTES[routeKey]
  const list: SlotRT[] = []
  const disposables: (() => void)[] = []
  const shadowPlane = new THREE.PlaneGeometry(1, 1)
  disposables.push(() => shadowPlane.dispose())

  for (const slot of route.slots) {
    const def = MODEL_LIBRARY[slot.model]
    if (!def) continue

    const holder = new THREE.Group()
    holder.visible = false
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x050a18, // MODEL-2: deeper ink — grounds bodies on BOTH the
      // light bands and the dark bands (VLM r1–r3 "floating" notes).
      map: groundShadowSprite(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    disposables.push(() => shadowMat.dispose())
    const shadow = new THREE.Mesh(shadowPlane, shadowMat)
    shadow.renderOrder = 9
    shadow.frustumCulled = false
    shadow.visible = false

    const token = { alive: true }
    const rt: SlotRT = {
      slot, def, holder, shadow, shadowMat,
      el: null, p: 0, env: 0, presence: 0, ready: false, instrument: null, token,
      shadowW: 1, shadowY: -0.5,
    }
    list.push(rt)
    disposables.push(() => {
      token.alive = false
      if (rt.instrument) {
        rt.instrument.dispose()
        rt.instrument = null
      }
      holder.clear()
    })

    loadInstrument(def.src)
      .then((raw) => {
        if (!token.alive) return
        const inst = buildInstrument(def, raw)
        rt.instrument = inst
        rt.ready = true
        holder.add(inst.group)
        rt.shadowW = Math.max(inst.size.x, inst.size.z * 0.6, 0.02)
        rt.shadowY = inst.center.y - inst.size.y * 0.5
        // The async attach happens outside the frame loop — poke the
        // invalidate bus so the presence spring starts rendering.
        pokeRuneField()
      })
      .catch((err: unknown) => {
        console.warn('[RuneInstruments] load failed:', def.src, err)
      })
  }

  return {
    list,
    dispose: () => {
      for (const d of disposables) d()
    },
  }
}

/** The persistent scene skeleton — studio lighting + atmosphere + an
 * (initially empty) instrument set the fade machine populates. */
function buildField(): FieldRT {
  const root = new THREE.Group()

  // The STUDIO: a warm key from upper-start, a cool brand rim from the
  // opposite low corner, a soft ambient base. The PMREM environment
  // (RoomEnvironment, applied in the component) gives the PBR metals
  // their reflections. The rig never animates — lighting is a DESIGN
  // CONSTANT, so a given scroll position always produces the identical
  // frame.
  const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.1)
  keyLight.position.set(2.6, 3.2, 3.5)
  const ambLight = new THREE.AmbientLight(0xffffff, 0.28)
  const rimLight = new THREE.DirectionalLight(new THREE.Color(BRAND_COLORS.gBlueLight), 1.25)
  rimLight.position.set(-3, -1.2, 2)
  root.add(keyLight, ambLight, rimLight)

  // The MUSEUM SPOTLIGHT — a warm wash aimed at the hero slot's plinth
  // region (where every route's authority instrument stands), tight
  // enough to put a readable highlight on dials and faces against the
  // dark bands. A design constant like the rest of the rig — it never
  // animates.
  const spot = new THREE.SpotLight(0xffe3b8, 55, 0, 0.45, 0.75, 1.0)
  spot.position.set(0.6, 2.6, 5.2)
  const spotTarget = new THREE.Object3D()
  spotTarget.position.set(-2.0, 0.75, -0.45)
  spot.target = spotTarget
  root.add(spot, spotTarget)

  const dustGeo = makeDustGeometry(0x5eed0042)
  const dustUniforms: DustUniforms = {
    uD: { value: 0 },
    uS: { value: 0 },
    uAspect: { value: 1 },
    uHalfH: { value: 2 },
    uDensity: { value: 1 },
    uEnergy: { value: 0.35 },
    uPixelRatio: { value: 1 },
    uParX: { value: 0 },
    uParY: { value: 0 },
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
    mesh.position.z = WASH_Z
    root.add(mesh)
    const color = material.uniforms['uColor']?.value as THREE.Color | undefined
    return {
      mesh,
      material,
      color: color ?? new THREE.Color(baseColor),
      goalColor: new THREE.Color(baseColor),
      gx: 0, gy: 0, goalX: 0, goalY: 0,
      scale: 1.6, goalScale: 1.6,
      alpha: 0, goalAlpha: 0.05,
    }
  }
  const washes: [WashRT, WashRT] = [buildWash(BRAND_COLORS.gBlue), buildWash(BRAND_COLORS.gGreen)]

  const emptySet = { list: [] as SlotRT[], dispose: () => {} }

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
  models: { id: string; slug: string; p: number; env: number; presence: number; ready: boolean; found: boolean; x: number; y: number; scale: number; drives: { node: string; rot: number }[] }[]
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
function InstrumentsCore({ presetKey, dir }: { presetKey: RunePresetKey; dir: 'rtl' | 'ltr' }) {
  const field = useMemo(() => buildField(), [])
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)

  const fieldRef = useRef(field)
  // Route-fade machine: 'out' drains the fade, the instrument set is
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
  const dustGoal = useRef(MODEL_ROUTES[presetKey].dust)

  // Studio environment — generated once per mount; materials pick it
  // up at clone time (see buildInstrument).
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const tex = pmrem.fromScene(room, 0.04).texture
    studioEnv = tex
    invalidate()
    return () => {
      studioEnv = null
      tex.dispose()
      pmrem.dispose()
    }
  }, [gl, invalidate])

  // Pointer micro-parallax — the CAMERA eases ±~0.06 world units, so
  // the depth planes (instruments at z≈0, atmosphere at z=-2.5)
  // separate subtly. Pointer input is user input: when the pointer
  // stops, the ease converges and the frame loop goes back to sleep.
  const parTarget = useRef({ x: 0, y: 0 })
  const par = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      parTarget.current.x = ((e.clientX / w) * 2 - 1) * 0.05
      parTarget.current.y = -((e.clientY / h) * 2 - 1) * 0.035
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Per-resource disposal + invalidate-bus registration.
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
    dustGoal.current = MODEL_ROUTES[presetKey].dust
    if (presetKey !== builtKey.current) {
      fadePhase.current = 'out'
    }
    invalidate()
  }, [presetKey, invalidate])

  // Writing-direction changes re-resolve sides live.
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
    const tanHalf = Math.tan((FOV * Math.PI) / 360)
    const halfH0 = tanHalf * CAM_Z

    // Camera: fixed stage rig + damped pointer micro-parallax. Setting
    // it every frame is deterministic (pure function of par) — no
    // self-heal state needed.
    const cam = state.camera as THREE.PerspectiveCamera
    if (Math.abs(cam.fov - FOV) > 1e-3) {
      cam.fov = FOV
      cam.updateProjectionMatrix()
    }
    cam.position.set(par.current.x * 1.35, par.current.y * 1.1, CAM_Z)
    cam.lookAt(0, 0, 0)

    const f = field
    // provenance break (RUNE-2 slot-list lineage): the registry handle
    // rides a local array literal so the compiler treats downstream
    // writes as fresh, not as mutations of the hook-argument value.
    const regArr: [{ list: SlotRT[]; dispose: () => void }] = [f.registry]
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
          for (const rt of reg.list) {
            f.root.remove(rt.holder)
            f.root.remove(rt.shadow)
          }
          reg.dispose()
          const built = buildSlots(next)
          for (const rt of built.list) {
            f.root.add(rt.holder)
            f.root.add(rt.shadow)
          }
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

    // --- instrument driver: pure f(rect, D, S) --------------------------
    rescans.current += 1
    const doRescan = rescans.current % RESCAN_EVERY === 1
    let activeId = ''
    let activeEnv = 0
    let cfx = 0
    let cfy = 0
    let cw = 0
    let dominant: SlotRT | null = null

    // Narrower viewports shrink the instruments a touch (margins are
    // tighter); wide screens get the full composed size.
    const sizeK = aspect / 1.55 < 0.62 ? 0.62 : aspect / 1.55 > 1 ? 1 : aspect / 1.55

    for (const rt of reg.list) {
      if (doRescan || rt.el === null) {
        rt.el = resolveSection(rt.slot.id)
      }
      const el = rt.el
      const rawP =
        el === null
          ? 0
          : (vh - el.getBoundingClientRect().top) / (el.getBoundingClientRect().height + vh)
      const p = rawP < 0 ? 0 : rawP > 1 ? 1 : rawP
      const env = el === null ? 0 : envelope(p)
      rt.p = p
      rt.env = env

      // Presence: the designed materialise/dissolve value, damped.
      const targetEnv = env * fadeV * (rt.ready ? 1 : 0)
      const pks = 1 - Math.exp(-PRESENCE_K * dt)
      const prevPresence = rt.presence
      rt.presence += (targetEnv - rt.presence) * pks
      const pd = Math.abs(rt.presence - prevPresence)
      if (pd > settleDelta) settleDelta = pd

      const presence = rt.presence
      if (presence <= 0.015) {
        rt.holder.visible = false
        rt.shadow.visible = false
        continue
      }
      rt.holder.visible = true

      const slot = rt.slot
      const inst = rt.instrument

      // glue: the section's designed anchor point, in world units at
      // the slot's depth plane (stable — held for the whole stay).
      const halfH = tanHalf * (CAM_Z - slot.z)
      const xFrac =
        (slot.side === 'center'
          ? 0.5
          : dirRef.current === 'rtl'
            ? slot.side === 'start'
              ? 0.76
              : 0.24
            : slot.side === 'start'
              ? 0.24
              : 0.76) + (slot.xPad ?? 0)
      const maxX = halfH * aspect - 0.35
      const x = Math.max(-maxX, Math.min(maxX, (xFrac * 2 - 1) * halfH * aspect))
      const anchorPx = el === null ? 0 : el.getBoundingClientRect().top + el.getBoundingClientRect().height * slot.yFrac
      const fy = anchorPx / vh
      const modelH = slot.viewFrac * 2 * halfH
      const rise = (1 - presence) * -0.12 * halfH
      const y = (1 - 2 * fy) * halfH + rise + (slot.yOff ?? 0) * modelH

      const holder = rt.holder
      holder.position.set(x, y, slot.z)

      // STABLE scale — a fraction of the viewport held constant.
      const fitDim = inst ? inst.fitDim : 1
      const scale = Math.max((sizeK * modelH) / fitDim, 1e-4)
      holder.scale.setScalar(scale)

      // Whole-body scrub (reversible) + yaw + dissolve settle.
      holder.rotation.y =
        rt.def.yaw + slot.scrub * ease01(p) + (1 - presence) * -0.4
      holder.rotation.x = rt.def.tilt ?? 0

      // Part drives — real named nodes, pure functions of (D, p).
      if (inst) {
        const pe = ease01(p)
        for (const d of inst.drives) {
          let rot = d.base
          const drive = d.drive
          if (drive.sweep) {
            const from = drive.sweep[0] ?? 0
            const to = drive.sweep[1] ?? 0
            rot = from + (to - from) * pe
          } else {
            if (drive.rate !== undefined) rot += D * drive.rate
            if (drive.swing !== undefined) {
              rot += Math.sin(D * (drive.rate ?? 0.01)) * drive.swing
            }
            if (drive.steps !== undefined) {
              rot += Math.floor(pe * drive.steps) * ((Math.PI * 2) / drive.steps)
            }
          }
          d.node.rotation[d.axis] = rot
        }

        // Presence fades the cloned materials (transparent only while
        // fading — full presence restores authored transparency).
        if (Math.abs(presence - inst.lastPresence) > 0.003) {
          inst.lastPresence = presence
          const opaque = presence > 0.995
          for (const me of inst.mats) {
            me.mat.opacity = me.baseOpacity * presence
            me.mat.transparent = me.baseTransparent ? true : !opaque
          }
        }
      }

      // Ground shadow: root-level billboard glued just under the
      // bbox bottom (grounds the body; never inherits its rotation).
      rt.shadow.visible = presence > 0.02
      rt.shadow.position.set(x, y + rt.shadowY * scale - 0.02 * scale, slot.z - 0.02)
      rt.shadow.scale.set(
        Math.max(rt.shadowW * scale * 0.95, 1e-4),
        Math.max(rt.shadowW * scale * 0.26, 1e-4),
        1,
      )
      rt.shadowMat.opacity = 0.38 * presence

      if (env > activeEnv) {
        activeEnv = env
        activeId = slot.id
        dominant = rt
      }
      cfx += xFrac * env
      cfy += fy * env
      cw += env
    }

    // --- pointer parallax ease -------------------------------------------
    const pksCam = 1 - Math.exp(-8 * dt)
    par.current.x += (parTarget.current.x - par.current.x) * pksCam
    par.current.y += (parTarget.current.y - par.current.y) * pksCam
    const parDelta =
      Math.abs(parTarget.current.x - par.current.x) +
      Math.abs(parTarget.current.y - par.current.y)

    // --- washes: the atmosphere follows the active instrument -----------
    const halfHW = tanHalf * (CAM_Z - WASH_Z)
    const washArr: [WashRT, WashRT] = [f.washes[0], f.washes[1]]
    if (cw > 0.001 && dominant !== null) {
      const w0 = washArr[0]
      const w1 = washArr[1]
      if (w0 && w1) {
        const pal = SLOT_PALETTES[dominant.slot.palette]
        w0.goalX = cfx / cw
        w0.goalY = cfy / cw
        w0.goalScale = 1.5 + activeEnv * 0.6
        w0.goalAlpha = 0.045 + 0.05 * activeEnv
        w0.goalColor.set(pal.edge)
        w1.goalX = -w0.goalX * 0.6
        w1.goalY = -0.3 - w0.goalY * 0.4
        w1.goalScale = 1.1
        w1.goalAlpha = 0.03 + 0.035 * activeEnv
        w1.goalColor.set(pal.edge2)
      }
    }
    const ws = 1 - Math.exp(-2.5 * dt)
    for (const w of washArr) {
      w.gx += (w.goalX - w.gx) * ws
      w.gy += (w.goalY - w.gy) * ws
      w.scale += (w.goalScale - w.scale) * ws
      w.alpha += (w.goalAlpha - w.alpha) * ws
      w.color.lerp(w.goalColor, ws)
      w.mesh.position.set(w.gx * halfHW * aspect + par.current.x * 0.6, w.gy * halfHW + par.current.y * 0.4, WASH_Z)
      w.mesh.scale.set(Math.max(w.scale * 2 * halfHW * aspect, 1e-4), Math.max(w.scale * 2 * halfHW, 1e-4), 1)
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
      d0.uHalfH.value = halfH0
      d0.uEnergy.value = energy
      d0.uPixelRatio.value = state.viewport.dpr
      d0.uParX.value = par.current.x * 2.2
      d0.uParY.value = par.current.y * 1.6
    }

    // --- frame chaining: scroll events already poke the bus; keep the
    // loop alive only while the fade/presence/wash/dust settle, the
    // pointer parallax eases, or the velocity tail drains. Idle page
    // (no scroll, no pointer motion) ⇒ zero rendered frames.
    const tailActive = tickScrollTail(dt)
    if (tailActive || settleDelta > FADE_EPS || parDelta > 0.0015) invalidate()

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
        models: reg.list.map((rt) => ({
          id: rt.slot.id,
          slug: rt.def.slug,
          p: rt.p,
          env: rt.env,
          presence: rt.presence,
          ready: rt.ready,
          found: rt.el !== null,
          x: rt.holder.position.x,
          y: rt.holder.position.y,
          scale: rt.holder.scale.x,
          drives: (rt.instrument?.drives ?? []).map((d) => ({
            node: d.node.name,
            rot: Math.round(d.node.rotation[d.axis] * 1000) / 1000,
          })),
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
      console.warn('[RuneInstruments] WebGL context lost')
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl])
  return null
}

export interface RuneSceneProps {
  /** Tab-visibility gate — 'never' frameloop while hidden. */
  active: boolean
  /** Locale-stripped route key — drives the instrument set. */
  presetKey: RunePresetKey
  /** Writing direction — resolves the anchors' logical sides. */
  dir: 'rtl' | 'ltr'
}

export function RuneScene({ active, presetKey, dir }: RuneSceneProps) {
  return (
    <Canvas
      frameloop={active ? 'demand' : 'never'}
      dpr={[1, 1.6]}
      camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.5, far: 60 }}
      gl={{ antialias: true, alpha: true, toneMappingExposure: 1.2 }}
      style={{
        background: 'transparent',
        // R3F defaults its container to pointer-events:auto; this layer
        // is pure decoration — clicks must always fall through (G8).
        pointerEvents: 'none',
      }}
    >
      <InstrumentsCore presetKey={presetKey} dir={dir} />
      <ContextLossGuard />
    </Canvas>
  )
}
