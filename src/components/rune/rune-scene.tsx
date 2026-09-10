'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { getScrollClocks, scrollEnergy, tickScrollTail } from '@/lib/scroll-store'
import { pokeRuneField, setRuneInvalidate } from './rune-bus'
import { BRAND_COLORS } from '@/lib/brand-colors'
import { noteGlLost, noteGlRestored } from '@/lib/gl-health'
import { MODEL_LIBRARY, MODEL_ROUTES, SLOT_PALETTES, type ModelDef, type PartDrive, type RunePresetKey } from './model-registry'
import { resolveModel, type RawInstrument } from './model-loader'

/**
 * Rune Instruments scene (HEAVY-1 / MODEL-4) — the SEMANTIC-BODY core.
 *
 * OWNER'S CONTRACT (restated as enforced invariants):
 * 1. «متطابقة تمامًا مع ما نتحدث عنه» — every body IS its section's
 *    literal subject (authored kits from tech-kits.ts: the assembling
 *    experience, the pipeline journey, the site canvas, the flow
 *    graph, the results deck, the exploded detail, the braid, the
 *    message composer, the broken link), loaded through the module
 *    cache and rendered with full PBR (studio environment, warm key +
 *    cool rim, contact ground shadow).
 * 2. «تموضع صحيح» — each body holds ONE STABLE, composed slot in its
 *    section's free margin: constant size (a fraction of the
 *    viewport), constant depth plane, plinth position from the
 *    section's own rect. It does NOT roam and does NOT balloon; it
 *    MATERIALIZES (fade + rise + settle) as its section arrives and
 *    dissolves as it leaves — scrolling up replays it in reverse.
 * 3. «تعيش وتتفاعل مع السكرول ومع المستخدم في كل تحرك» — the motion
 *    layers: f(rect, D, S, pointer) PLUS (MODEL-5 amendment) the LIFE
 *    clock — a wall-clock accumulator that advances ONLY while frames
 *    render:
 *      · whole-body SCRUB — rotation.y sweeps `scrub` radians across
 *        the section's travel (reversible, frame-identical);
 *      · PART drives — named nodes driven by D (odometers), by the
 *        eased section progress p (windowed sweeps, slides, scales,
 *        glow deltas — the designed SEQUENCES), by the pointer (follow
 *        cursors, peek expansions, glow boosts), and by the life clock
 *        (idle harmonics + spins + glow pulses — each kit's own
 *        personality, presence-scaled so a body NEVER idle-animates
 *        while off screen);
 *      · pointer micro-parallax — the camera eases ±0.06 world units
 *        (depth planes separate subtly) PLUS per-body lean springs
 *        and proximity hover — every body answers every pointer move
 *        (each move pokes the invalidate bus).
 *    MODEL-5 (owner's instruction, verbatim intent): «أن تظهر
 *    الأنميشنز بشكل صحيح ومباشر للمستخدم» — the animations must show
 *    DIRECTLY to the reading visitor, i.e. the bodies keep LIVING
 *    while visible even with zero input; «ألا يتم تفعيل الأنميشن
 *    بينما لا تظهر المجسمات» — nothing animates while the bodies are
 *    NOT visible. The amended freeze contract: ALIVE while any body
 *    is on stage (the loop keeps rendering), ZERO frames once every
 *    body is off screen (the offscreen guarantee is now machine-
 *    checked on the same `frames` counter).
 *    (Tab hidden ⇒ frameloop 'never'; reduced-motion / mobile ⇒ the
 *    layer never mounts — gated upstream in edge-rune.tsx.)
 *
 *    MODEL-6 (owner's instruction, verbatim intent): «أنيميشن سلس
 *    وجميل، مثل بناء المجسم، أو انبثاق وظهور له» + «يتحرك بشكل سلس،
 *    ثابت، ومتناسق… تكبر وتصغر… دون أن تحجب أي شيء… تظهر المجسمات
 *    الـ 3D بشكل كامل»:
 *      · BIRTH — every body plays a staged BUILD-IN the moment it
 *        first takes its slot (first load, every route change, every
 *        section arrival): the holder bursts from 55% scale with a
 *        back-out overshoot, rises and spins into its resting face,
 *        while the kit's own parts converge from a staggered exploded
 *        halo — «بناء المجسم، أو انبثاق وظهور». The build rides a
 *        bounded clock that advances ONLY while the body is on stage
 *        (alive frames — the assembly always COMPLETES even if the
 *        scroll stops mid-entry) and drains fast on exit, so every
 *        re-entry replays the birth. While the homepage intro curtain
 *        is armed (`data-intro`) presence holds at zero — the birth
 *        plays strictly AFTER the reveal (the R9 contract, extended to
 *        the rune field; the overlay pokes the bus when it lifts).
 *      · EDGE LIFE — while the section travels: a vertical edge-glide
 *        (the body drifts gently against its section — pure f(p),
 *        reversible, «سلس ومتناسق»; the x anchor stays composed
 *        «ثابت») plus a scale swell that grows the body through the
 *        middle of its stay and eases it back at the edges («تكبر
 *        وتصغر بشكل سلس»), per-slot tunable in the registry
 *        (grow/glide).
 *      · FULL VISIBILITY — rotation-conservative projected half-extents
 *        (the bbox diagonal bound) clamp every holder inside the
 *        viewport at ANY yaw/tilt and through the grow peak: the whole
 *        body is always on screen («بشكل كامل»), never clipped, and
 *        pointer-events-none keeps it from ever blocking the page.
 *
 * Atmosphere (unchanged physics, frustum-adapted math): the dust field
 * streams with the same clocks; the two washes follow the ACTIVE
 * body (position + palette), so the background literally travels with
 * the object, section by section.
 *
 * Route changes (and the first build): the body set differs per
 * route, so transitions run through one fade-out → rebuild → fade-in
 * machine — no popping, no remount of the GL context, one damped
 * `fade`. Kits build synchronously through the module cache; a slot
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
/** Presence damping for each body's materialise/dissolve. */
const PRESENCE_K = 7
/** Element rescan cadence (rendered frames) — catches lazy sections. */
const RESCAN_EVERY = 45
/** MODEL-6 build clock (s): staged-birth advance / exit drain. */
const BUILD_T = 1.15
const BUILD_DRAIN = 0.5
/** MODEL-6 per-part assembly window inside the build clock (0..1). */
const BUILD_PART_W = 0.5
/** MODEL-6 viewport breathing room for the full-visibility clamps. */
const EDGE_PAD = 0.09
/** MODEL-6 — the fixed navbar strip (px, = scroll-padding-top 6rem):
 * the top clamp reserves it so a body never reads as "cut off by the
 * header" while it glides high through its stay. */
const NAV_PX = 96

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

/** MODEL-6 back-out easing — the «انبثاق» settle: overshoots ~10% on
 * the way to 1, so the birth's scale/rise land with one soft pop
 * instead of a dead stop. */
function backOut(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  const c1 = 1.70158
  const t = c - 1
  return 1 + (c1 + 1) * t * t * t + c1 * t * t
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
  /** Base position on the axis (slide drives offset from this). */
  basePos: number
  /** Full base position (follow drives write x AND y). */
  basePosVec: THREE.Vector3
  /** Base uniform scale (scale drives are absolute). */
  baseScale: number
  /** Cloned MeshStandardMaterials under the node (glow drives) with
   *  their authored emissive-intensity bases. */
  mats: { mat: THREE.MeshStandardMaterial; base: number }[]
  drive: PartDrive
}

/** MODEL-6 — one assembling part of a body: a direct kit child with
 * its authored base position and a capped radial explode offset (away
 * from the bbox center — peripheral parts fly in, the chassis stays). */
interface BuildPart {
  node: THREE.Object3D
  basePos: THREE.Vector3
  out: THREE.Vector3
  /** Start point inside the build clock (staggered across siblings). */
  stagger: number
}

export interface InstrumentRT {
  /** Centered clone holder — added to the slot's group. */
  group: THREE.Group
  /** Per-mount cloned materials (owned here; textures stay shared). */
  mats: MatEntry[]
  /** Resolved named parts (drives). */
  drives: DriveRT[]
  /** MODEL-6 assembling parts (direct children with explode offsets). */
  parts: BuildPart[]
  /** O(1) drive-node → part lookup (birth offsets compose into the
   * position-writing drives). */
  partByNode: Map<THREE.Object3D, BuildPart>
  /** Nodes whose positions are written by slide/follow drives — the
   * generic reset pass skips them (their reset IS the drive write). */
  posDriven: Set<THREE.Object3D>
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
  // AUDIT-B2 FIX 8 (drive-aware dedupe): resolve the glow/boost drive
  // NODES first — meshes under them keep their own PER-MESH clone
  // (each drive writes emissiveIntensity on its node's materials, and
  // the driven lamps share source materials by design — e.g. the four
  // pipeline gate LEDs all use M.ledGreen with independent ignition
  // windows — so one shared clone would fuse their sequences). Every
  // other mesh dedupes BY SOURCE: kits share one M.panel/M.ink across
  // many meshes, and cloning per mesh produced k redundant clones per
  // mount. Disposal still owns each unique clone exactly once (the map
  // registers one clone per source; per-mesh clones are unique pushes).
  const driven = new Set<THREE.Mesh>()
  for (const d of def.drives ?? []) {
    if (!(d.glow || d.boost)) continue
    const node = findNode(clone, d.node)
    if (node) {
      node.traverse((o) => {
        if (o instanceof THREE.Mesh) driven.add(o)
      })
    }
  }
  const cloneOf = new Map<THREE.Material, THREE.Material>()
  const prep = (m: THREE.Material, perMesh: boolean): THREE.Material => {
    if (!perMesh) {
      const existing = cloneOf.get(m)
      if (existing) return existing
    }
    const c = m.clone()
    const std = c as THREE.MeshStandardMaterial
    if ('envMapIntensity' in std) {
      if (studioEnv) std.envMap = studioEnv
      // MODEL-3: kit materials may pre-tune their own env intensity
      // (silver brighter, cream dimmer) — compose, don't clobber.
      std.envMapIntensity = (std.envMapIntensity ?? 1) * (def.envIntensity ?? 1)
    }
    // (MODEL-4: per-body glow now lives in the GLOW drives — per-part
    // emissive deltas over windowed scroll progress + pointer boosts —
    // not a whole-body constant.)
    // GLASS DISCIPLINE (VLM rounds 2–4): dim any smoked-glass pane —
    // few env reflections, half opacity — so faces stay readable.
    if (/glass/i.test(c.name ?? '')) {
      if ('envMapIntensity' in std) std.envMapIntensity = (def.envIntensity ?? 1) * 0.25
      c.opacity = c.opacity * 0.45
    }
    if (!perMesh) cloneOf.set(m, c)
    disposables.push(c)
    mats.push({ mat: c, baseOpacity: c.opacity, baseTransparent: c.transparent })
    return c
  }
  clone.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    o.renderOrder = 10
    const perMesh = driven.has(o)
    o.material = Array.isArray(o.material)
      ? o.material.map((mm) => prep(mm, perMesh))
      : prep(o.material, perMesh)
  })

  const drives: DriveRT[] = []
  for (const d of def.drives ?? []) {
    const node = findNode(clone, d.node)
    if (node) {
      // GLOW drives need the node's CLONED materials (the traverse
      // above has already replaced them) with their authored bases.
      const mats: { mat: THREE.MeshStandardMaterial; base: number }[] = []
      if (d.glow || d.boost) {
        node.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const list = Array.isArray(o.material) ? o.material : [o.material]
            for (const m of list) {
              if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                const sm = m as THREE.MeshStandardMaterial
                mats.push({ mat: sm, base: sm.emissiveIntensity })
              }
            }
          }
        })
      }
      drives.push({
        node, axis: d.axis, base: node.rotation[d.axis],
        basePos: node.position[d.axis], basePosVec: node.position.clone(),
        baseScale: node.scale.x, mats, drive: d,
      })
    }
  }

  const fitDim =
    def.fit === 'height'
      ? raw.size.y
      : def.fit === 'width'
        ? raw.size.x
        : Math.max(raw.size.x, raw.size.y, raw.size.z)

  // MODEL-6 build parts — the kit's direct children, each remembered
  // with its authored base position and a capped RADIAL explode offset
  // from the body's bbox center. Staggered across siblings over the
  // build clock; position-writing drives compose their own offset in
  // the driver, everything else is reset by the generic pass — an
  // absolute write every frame, so nothing ever accumulates.
  const parts: BuildPart[] = []
  const partByNode = new Map<THREE.Object3D, BuildPart>()
  const kids = clone.children
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i] as THREE.Object3D
    const out = child.position.clone().sub(raw.center)
    const len = out.length()
    if (kids.length > 1 && len > 1e-4) {
      out.multiplyScalar(Math.min(len * 0.85, 0.42) / len)
    } else {
      out.set(0, 0, 0)
    }
    const part: BuildPart = {
      node: child,
      basePos: child.position.clone(),
      out,
      stagger: kids.length > 1 ? 0.08 + (0.42 * i) / (kids.length - 1) : 0.08,
    }
    parts.push(part)
    partByNode.set(child, part)
  }
  const posDriven = new Set<THREE.Object3D>()
  for (const d of drives) {
    if (d.drive.slide || d.drive.follow) posDriven.add(d.node)
  }

  return {
    group,
    mats,
    drives,
    parts,
    partByNode,
    posDriven,
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
  /** Cached section rect — top/height read ONCE per rescan tick, then
   *  the per-frame top is derived as rectTop − (scrollY − rectAt).
   *  SCROLL-FIX: the old loop called getBoundingClientRect up to 4×
   *  per slot per rendered frame; with Lenis writing scrollTop every
   *  tick each read forced a synchronous layout — 9 slots × every
   *  frame was a main-thread stall factory (the «تسريع مفاجئ» jank
   *  source). The cache makes the hot path layout-free. */
  rectTop: number
  rectH: number
  rectAt: number
  p: number
  env: number
  /** Damped materialise/dissolve value (0..1). */
  presence: number
  /** MODEL-6 staged-birth clock (0..1) — advances while on stage,
   * drains on exit so every arrival replays the assembly. */
  build: number
  ready: boolean
  instrument: InstrumentRT | null
  /** Liveness token — rejects async attaches after a rebuild. */
  token: { alive: boolean }
  /** Pointer-lean spring (eases toward the raw pointer NDC; per-slot
   *  damping variety so the field ripples organically on every move). */
  spr: { x: number; y: number }
  /** Damped pointer proximity over the body (0..1) — drives the hover
   *  lift, peek expansions and glow boosts. */
  prox: number
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
    // MODEL-4 r2: dark bands get a WARM FLOOR POOL (additive) instead
    // of the ink drop — a dark-on-dark shadow is invisible, and the VLM
    // r1 verdicts read the ungrounded bodies as "stickers pasted onto
    // the screen". A soft pool of the museum light catching the plinth
    // floor grounds the same geometry; light bands keep the deep ink.
    const isPool = slot.palette === 'dark'
    const shadowMat = new THREE.MeshBasicMaterial({
      color: isPool ? 0xf2dfae : 0x050a18, // MODEL-2: deeper ink —
      // grounds bodies on BOTH the light bands and the dark bands
      // (VLM r1–r3 "floating" notes).
      map: groundShadowSprite(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: isPool ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    disposables.push(() => shadowMat.dispose())
    const shadow = new THREE.Mesh(shadowPlane, shadowMat)
    shadow.renderOrder = 9
    shadow.frustumCulled = false
    shadow.visible = false

    const token = { alive: true }
    const rt: SlotRT = {
      slot, def, holder, shadow, shadowMat,
      el: null, rectTop: 0, rectH: 0, rectAt: 0,
      p: 0, env: 0, presence: 0, build: 0, ready: false, instrument: null, token,
      spr: { x: 0, y: 0 }, prox: 0,
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

    resolveModel(def)
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
        console.warn('[RuneInstruments] load failed:', def.kit, err)
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
  /** MODEL-5: the life clock (s) — advances while frames render; the
   *  idle choreography's time base. */
  life: number
  /** MODEL-5: true while any body is on stage (the alive gate). */
  alive: boolean
  D: number
  S: number
  vy: number
  vel01: number
  fade: number
  fadePhase: 'in' | 'out'
  active: string
  models: { id: string; slug: string; p: number; env: number; presence: number; build: number; ready: boolean; found: boolean; x: number; y: number; scale: number; prox: number; sprx: number; spry: number; drives: { node: string; rot: number; pos: number; scl: number; glow: number | null; fx: number; fy: number }[] }[]
  /** MODEL-6: true while the homepage intro curtain is armed — the
   *  staged births are held (R9) until the reveal completes. */
  introHold: boolean
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
  /** LIFE CLOCK (MODEL-5) — wall-clock seconds accumulated ONLY inside
   *  useFrame: it advances exactly while the scene renders frames, so
   *  every idle harmonic/spin/pulse is frozen by construction the
   *  moment the loop parks (all bodies off screen ⇒ zero frames ⇒ the
   *  clock stops). Continuous, deterministic (pure sin of life), and
   *  never advances on a hidden tab (frameloop 'never'). */
  const life = useRef(0)
  /** Viewport height at the last rect cache — a resize invalidates the
   *  cache (reflow moved the sections), forcing an immediate rescan. */
  const lastVh = useRef(0)

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
      // AUDIT-B2 FIX 1: RoomEnvironment owns a box geometry + Lambert/
      // standard materials (three 0.185 .dispose() frees them); without
      // this the leak re-accumulated on every EdgeRune remount at the
      // mobile-tier 768px crossings (capability-scene RoomEnv mirrors
      // the same disposal).
      room.dispose()
      pmrem.dispose()
    }
  }, [gl, invalidate])

  // Pointer micro-parallax — the CAMERA eases ±~0.06 world units, so
  // the depth planes (bodies at z≈0, atmosphere at z=-2.5) separate
  // subtly. MODEL-4 INTERACTIVITY: the FULL pointer NDC is kept for
  // the per-slot lean springs / proximity / follow drives, and EVERY
  // pointer move now pokes the invalidate bus — the bodies answer
  // each move immediately (the demand loop parks again once all
  // springs converge and the input stops).
  const parTarget = useRef({ x: 0, y: 0 })
  const par = useRef({ x: 0, y: 0 })
  const ndc = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      const nx = (e.clientX / w) * 2 - 1
      const ny = -((e.clientY / h) * 2 - 1)
      parTarget.current.x = nx * 0.05
      parTarget.current.y = ny * 0.035
      ndc.current.x = nx
      ndc.current.y = ny
      pokeRuneField()
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
    // AUDIT-C2R (LOW): a zero-height frame (tier-flip/remount edge) must
    // not yield NaN/Infinity optics — the || 1 mirrors the innerHeight
    // guard on the sibling path above.
    const aspect = state.size.width / (state.size.height || 1)
    const vh = state.size.height || 1
    const tanHalf = Math.tan((FOV * Math.PI) / 360)
    const halfH0 = tanHalf * CAM_Z
    // MODEL-5: the life clock ticks with rendered time — the idle
    // choreography below breathes on it while a body is visible, and
    // freezes the instant the loop parks (no frames ⇒ no ticks).
    life.current += dt
    const lifeT = life.current
    // MODEL-6: while the homepage entry curtain is armed (`data-intro`)
    // the bodies hold dark — their staged birth must play strictly
    // AFTER the reveal (the R9 contract, extended to the rune field;
    // intro-overlay pokes the bus the moment it lifts the curtain).
    // hasAttribute is a plain attribute read — no layout, safe per frame.
    const introHold = document.documentElement.hasAttribute('data-intro')
    // A viewport resize means reflow — the rect cache is stale, rescan.
    const vhChanged = lastVh.current !== vh
    if (vhChanged) lastVh.current = vh

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

    // --- instrument driver: pure f(rect, D, S, life, pointer) ---------
    rescans.current += 1
    const doRescan = rescans.current % RESCAN_EVERY === 1 || vhChanged
    let activeId = ''
    let activeEnv = 0
    let cfx = 0
    let cfy = 0
    let cw = 0
    let dominant: SlotRT | null = null
    // MODEL-5 alive gate — flips true while ANY body is on stage; the
    // invalidate chain below then keeps the loop rendering (the bodies
    // live for the reading visitor). All bodies off screen ⇒ false ⇒
    // the loop parks once the fades/settles drain.
    let anyAlive = false

    // Narrower viewports shrink the instruments a touch (margins are
    // tighter); wide screens get the full composed size.
    const sizeK = aspect / 1.55 < 0.62 ? 0.62 : aspect / 1.55 > 1 ? 1 : aspect / 1.55

    let slotIdx = -1
    for (const rt of reg.list) {
      slotIdx += 1
      if (doRescan || rt.el === null) {
        rt.el = resolveSection(rt.slot.id)
        if (rt.el) {
          // Cache ONCE — the hot path below derives the live top from
          // this rect + ΔscrollY (SCROLL-FIX: no per-frame gBCR → no
          // forced layout under Lenis's scrollTop writes).
          const r = rt.el.getBoundingClientRect()
          rt.rectTop = r.top
          rt.rectH = r.height
          rt.rectAt = window.scrollY
        }
      }
      const el = rt.el
      const liveTop = el === null ? 0 : rt.rectTop - (window.scrollY - rt.rectAt)
      const rawP = el === null ? 0 : (vh - liveTop) / (rt.rectH + vh)
      const p = rawP < 0 ? 0 : rawP > 1 ? 1 : rawP
      const env = el === null ? 0 : envelope(p)
      rt.p = p
      rt.env = env

      // Presence: the designed materialise/dissolve value, damped.
      // MODEL-6: introHold pins the target at zero — the curtain must
      // never reveal a half-born body (the birth starts at time 0 on a
      // fully revealed stage).
      const targetEnv = introHold ? 0 : env * fadeV * (rt.ready ? 1 : 0)
      const pks = 1 - Math.exp(-PRESENCE_K * dt)
      const prevPresence = rt.presence
      rt.presence += (targetEnv - rt.presence) * pks
      const pd = Math.abs(rt.presence - prevPresence)
      if (pd > settleDelta) settleDelta = pd

      // MODEL-6 build clock — the staged BIRTH. Advances while the body
      // is on stage (the alive loop's frames tick it, so the assembly
      // always COMPLETES even when the scroll stops mid-entry), drains
      // fast once the body is gone so the next arrival replays it. A
      // bounded clock — settles at 1 and never idles past it.
      const prevBuild = rt.build
      if (!introHold) {
        if (rt.presence > 0.06 && rt.build < 1) {
          rt.build = Math.min(1, rt.build + dt / BUILD_T)
        } else if (rt.presence <= 0.03 && rt.build > 0) {
          rt.build = Math.max(0, rt.build - dt / BUILD_DRAIN)
        }
      }
      const bd = Math.abs(rt.build - prevBuild)
      if (bd > settleDelta) settleDelta = bd
      const build = rt.build
      const bk = backOut(build)

      const presence = rt.presence
      if (presence <= 0.015) {
        rt.holder.visible = false
        rt.shadow.visible = false
        continue
      }
      rt.holder.visible = true
      anyAlive = true

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
      let x = (xFrac * 2 - 1) * halfH * aspect
      const anchorPx = el === null ? 0 : liveTop + rt.rectH * slot.yFrac
      const fy = anchorPx / vh
      const modelH = slot.viewFrac * 2 * halfH
      // MODEL-6: the presence rise is deepened by the BIRTH rise — the
      // body climbs into place as it assembles (the back-out overshoot
      // gives it one soft settling bounce above its slot).
      const rise =
        (1 - presence) * -0.12 * halfH + (1 - bk) * -0.22 * modelH

      // --- MODEL-5 IDLE (whole body) ------------------------------------
      // The life layer: a per-slot breathing (bob ±1.2% of the body's
      // height, a slow ±3° sway, ±1% scale breath) phased by the golden
      // angle so neighbouring bodies never sync. presence-scaled ⇒ a
      // dissolving body calms as it fades; off screen ⇒ zero (the gate
      // above already skipped it). idleEnergy tunes each kit's
      // temperament (registry). Subtle by design — the SLOT stays
      // composed (the VLM-tuned stability); the life reads through the
      // per-part drives below plus this gentle breathing.
      const idx = slotIdx
      const iE = (rt.def.idleEnergy ?? 1) * presence
      const ph = (idx * 2.399) % (Math.PI * 2)
      const bob = iE * 0.012 * modelH * Math.sin(lifeT * 1.1 + ph)
      const sway = iE * 0.05 * Math.sin(lifeT * 0.5 + ph * 0.6)
      const breath = 1 + iE * 0.01 * Math.sin(lifeT * 0.7 + ph * 0.8)

      // --- POINTER INTERACTIVITY (MODEL-4) ------------------------------
      // Lean springs: each body eases toward the raw pointer NDC with
      // its own damping (variety across slots ⇒ the field ripples
      // organically on every move); proximity: how near the pointer
      // world-point is to the body (hover lift, peek, glow boosts).
      const lean = rt.def.react?.lean ?? 0.09
      const hoverW = rt.def.react?.hover ?? 1
      // K 9..13.4/s: snappy on real GPUs (≈0.4s settle), few frames on
      // software renderers — the park test converges fast either way.
      // AUDIT-B2 FIX 7: slotIdx (the running loop index) replaces
      // reg.list.indexOf(rt) — identical value, O(1) instead of O(n²)
      // across the per-slot frame loop.
      const kSpr = 1 - Math.exp(-(9 + (slotIdx % 3) * 2.2) * dt)
      const sprXPrev = rt.spr.x
      const sprYPrev = rt.spr.y
      rt.spr.x += (ndc.current.x - rt.spr.x) * kSpr
      rt.spr.y += (ndc.current.y - rt.spr.y) * kSpr
      const sprDelta = Math.abs(rt.spr.x - sprXPrev) + Math.abs(rt.spr.y - sprYPrev)
      if (sprDelta > settleDelta) settleDelta = sprDelta

      const halfHS = halfH
      const pwx = ndc.current.x * halfHS * aspect
      const pwy = ndc.current.y * halfHS
      // base slot Y (pre-hover) for the proximity distance test
      const baseY = (1 - 2 * fy) * halfH + rise + (slot.yOff ?? 0) * modelH
      const dxP = pwx - x
      const dyP = pwy - baseY
      const proxR = Math.max(modelH * 0.75, 0.5) * 1.7
      let tp = 1 - Math.min(Math.sqrt(dxP * dxP + dyP * dyP) / proxR, 1)
      tp = tp * tp * (3 - 2 * tp)
      const proxPrev = rt.prox
      rt.prox += (tp - rt.prox) * (1 - Math.exp(-10 * dt))
      const proxDelta = Math.abs(rt.prox - proxPrev)
      if (proxDelta > settleDelta) settleDelta = proxDelta

      // Hover lift — a small interactive rise (≈4% of the model's
      // height) when the pointer is over the body; the slot stays
      // composed, the body just breathes up toward your hand.
      const hoverLift = rt.prox * 0.04 * modelH * hoverW
      // MODEL-6 EDGE-GLIDE: the body drifts gently against its section
      // while scrolling (pure f(p) gated by the envelope — smooth,
      // reversible, «سلس ومتناسق»; «ثابت» comes from the untouched x
      // anchor — the body roams its edge corridor, never the column).
      const glide = (p - 0.5) * (slot.glide ?? 0.5) * modelH * env
      let y = baseY + hoverLift + bob + glide

      const holder = rt.holder

      // SCALE — MODEL-6 amendment of the stable-slot contract: the base
      // is still the composed viewport fraction, now shaped by (a) the
      // BIRTH burst (55% → back-out overshoot ≈ +4.5% → 1), (b) the
      // scroll SWELL — the body grows through the middle of its stay
      // and eases back at the edges («تكبر وتصغر بشكل سلس ومتناسق») —
      // CAPPED to the free outward corridor (see the pin below), (c) the
      // pointer proximity breath (≤4.5%, pure pointer function) and (d)
      // the MODEL-5 idle breath (±1%). All continuous in (build, p,
      // prox, life) — reversible.
      const fitDim = inst ? inst.fitDim : 1
      const baseScale = Math.max((sizeK * modelH) / fitDim, 1e-4)
      const grow = slot.grow ?? 0.15
      // MODEL-6 yaw-aware projected silhouette — the EXACT horizontal
      // half-extent of the rotated bbox (Euler XYZ: the x row is
      // (cosYaw, 0, sinYaw) — tilt mixes y/z only, so this is exact for
      // any tilt; the birth spin and the lean ride the yaw too).
      const yawNow =
        rt.def.yaw +
        slot.scrub * ease01(p) +
        (1 - bk) * -0.55 +
        lean * rt.spr.x +
        sway
      const hw1 =
        inst && inst.size.x > 0
          ? 0.5 * (inst.size.x * Math.abs(Math.cos(yawNow)) + inst.size.z * Math.abs(Math.sin(yawNow)))
          : 0
      const halfSpan = halfH * aspect
      const hwBase = hw1 * baseScale
      // Growth corridor — the free room OUTWARD from the anchored edge
      // of the base silhouette to the viewport pad. The swell may use up
      // to 95% of it; the pin below then guarantees the body grows INTO
      // the free edge space, NEVER inward toward the reading column.
      const room = Math.max(halfSpan - EDGE_PAD - hwBase - Math.abs(x), 0)
      const growCap = hwBase > 1e-4 ? Math.min((0.95 * room) / hwBase, 1) : 1
      const growEff = Math.min(grow, growCap)
      const scale =
        baseScale *
        (0.55 + 0.45 * bk) *
        (1 + growEff * Math.sin(Math.PI * p)) *
        (1 + rt.prox * 0.045 * hoverW) *
        breath
      // INNER-EDGE PIN — every scale term beyond the base (swell,
      // proximity breath, idle breath) shifts the holder OUTWARD by the
      // half-extent it gained: the body's inner silhouette edge holds
      // its designed, VLM-tuned clearance from the text for the whole
      // stay («دون أن تحجب أي شيء»), and the growth reads as the body
      // swelling toward the free edge, never over the copy. During the
      // birth (scale < base) the pin is exactly zero — the assembling
      // body stays anchored.
      const growthK = scale / baseScale
      if (growthK > 1 && x !== 0) {
        x += Math.sign(x) * hwBase * (growthK - 1)
      }

      // MODEL-6 FULL-VISIBILITY clamps — the exact projected silhouette
      // (horizontal) and the tilt-conservative bbox diagonal (vertical)
      // keep the WHOLE body inside the viewport at any yaw/tilt, through
      // the grow peak and the edge-glide. The top band additionally
      // reserves the fixed navbar strip so nothing reads as "cut off by
      // the header": «تظهر المجسمات الـ 3D بشكل كامل», never clipped.
      if (inst) {
        const hw = hw1 * scale
        const hh = 0.5 * Math.sqrt(inst.size.y * inst.size.y + inst.size.z * inst.size.z) * scale
        const spanMaxX = Math.max(halfSpan - EDGE_PAD - hw, 0.05)
        const navPad = (NAV_PX / vh) * 2 * halfH
        const yMax = Math.max(halfH - navPad - hh, 0.05)
        // Lower bound: the proper negative bound, falling back to −0.05
        // ONLY when the body is taller than the viewport (degenerate) —
        // Math.min picks the more negative (permissive) of the two.
        const yMin = Math.min(-(halfH - EDGE_PAD - hh), -0.05)
        if (x > spanMaxX) x = spanMaxX
        else if (x < -spanMaxX) x = -spanMaxX
        if (y > yMax) y = yMax
        else if (y < yMin) y = yMin
      }
      holder.position.set(x, y, slot.z)
      holder.scale.setScalar(scale)

      // Whole-body scrub (reversible) + yaw + dissolve settle + the
      // MODEL-6 BIRTH spin-in (the body turns into its resting face as
      // it assembles) + the POINTER LEAN (the body turns its face
      // toward your hand — pure function of the damped springs,
      // converges when input stops) + the MODEL-5 idle sway.
      holder.rotation.y =
        rt.def.yaw +
        slot.scrub * ease01(p) +
        (1 - presence) * -0.4 +
        (1 - bk) * -0.55 +
        lean * rt.spr.x +
        sway
      holder.rotation.x = (rt.def.tilt ?? 0) - lean * rt.spr.y * 0.7

      // Part drives — real named nodes, functions of (D, p, prox, life).
      if (inst) {
        const pe = ease01(p)
        const rtl = dirRef.current === 'rtl'
        const prox = rt.prox
        for (const d of inst.drives) {
          const drive = d.drive
          // MODEL-6 BIRTH offset for this node — if it is a direct kit
          // child inside its staggered assembly window, its explode
          // offset composes ON TOP of the drive's authored write (and
          // is exactly zero once the build completes, leaving the
          // authored scroll poses untouched at rest).
          const birthPart = inst.partByNode.get(d.node)
          let box = 0
          let boy = 0
          let boz = 0
          if (birthPart && build < 1) {
            const bl = (build - birthPart.stagger) / BUILD_PART_W
            const k = 1 - backOut(bl < 0 ? 0 : bl > 1 ? 1 : bl)
            if (k > 1e-3) {
              box = birthPart.out.x * k
              boy = birthPart.out.y * k
              boz = birthPart.out.z * k
            }
          }
          // MODEL-5 IDLE term — the drive's own life harmonic:
          // harmonic: amp·sin(life·2π·hz + phase) (slides/rotations),
          // unipolar: amp·(0.5+0.5·sin(…)) (scales/glows — never below
          // the authored base), spin: amp·life (linear radians/sec —
          // odometers that keep turning while visible). All
          // presence-scaled via the whole-body gate (this loop only
          // runs for present bodies) and pure functions of lifeT.
          const idle = drive.idle
          const idleHz = idle ? lifeT * Math.PI * 2 * idle.hz : 0
          const idlePhase = idle?.phase ?? 0
          const idleH = idle ? (idle.spin ? idle.amp * lifeT : idle.amp * Math.sin(idleHz + idlePhase)) : 0
          const idleU = idle ? idle.amp * (0.5 + 0.5 * Math.sin(idleHz + idlePhase)) : 0
          // PROGRESS WINDOW — the designed SEQUENCE (absent = whole
          // travel): smoothstepped local progress lp.
          let lp = pe
          if (drive.win) {
            const w0 = drive.win[0] ?? 0
            const w1 = drive.win[1] ?? 1
            const raw = w1 > w0 ? (p - w0) / (w1 - w0) : 1
            lp = ease01(raw < 0 ? 0 : raw > 1 ? 1 : raw)
          }
          // FOLLOW — the on-screen cursor mirroring the visitor's real
          // pointer (slide = [xRange, yRange] NDC multipliers).
          if (drive.follow) {
            const rx = drive.slide?.[0] ?? 0
            const ry = drive.slide?.[1] ?? 0
            d.node.position.x = d.basePosVec.x + ndc.current.x * rx + box
            d.node.position.y = d.basePosVec.y + ndc.current.y * ry + boy
            continue
          }
          // GLOW — emissive-intensity delta over the window (+ pointer
          // boost; blink = the LIFE-clocked pulse — MODEL-5: lamps blink
          // for the reading visitor, not only while scrolling; pure
          // f(lifeT), frozen when the loop parks).
          if (drive.glow) {
            const from = drive.glow[0] ?? 0
            const to = drive.glow[1] ?? 0
            let delta = from + (to - from) * lp
            if (drive.boost) delta += drive.boost * prox
            if (idle) delta += idleU
            let mult = 1
            if (drive.blink) mult = 0.55 + 0.45 * Math.sin(lifeT * 6.2 + idlePhase)
            for (const gm of d.mats) {
              gm.mat.emissiveIntensity = Math.max(0, gm.base + delta * mult)
            }
            continue
          }
          // SCALE — absolute uniform (typing lines, the rising braid,
          // the growing chart bars) + the idle swell (unipolar — bars
          // breathe UP from their authored height, never shrink).
          if (drive.scale) {
            const from = drive.scale[0] ?? 0.02
            const to = drive.scale[1] ?? 1
            let s = from + (to - from) * lp
            if (drive.peek) s *= 1 + drive.peek * prox
            if (idle) s *= 1 + idleU
            d.node.scale.setScalar(Math.max(s, 1e-3) * d.baseScale)
            continue
          }
          if (drive.slide) {
            // SLIDE (position offset over the windowed progress) —
            // assemblies rising into place, packets hopping, the
            // workpiece riding the rail (+ peek under the pointer;
            // mirror flips x for LTR: kits are authored RTL-first) +
            // the idle harmonic (the workpiece hovers, plates breathe).
            const from = drive.slide[0] ?? 0
            const to = drive.slide[1] ?? 0
            let off = from + (to - from) * lp
            if (drive.peek) off += drive.peek * prox
            if (idle) off += idleH
            if (drive.mirror && !rtl) off = -off
            d.node.position[d.axis] =
              d.basePos + off + (d.axis === 'x' ? box : d.axis === 'y' ? boy : boz)
            continue
          }
          let rot = d.base
          if (drive.sweep) {
            const from = drive.sweep[0] ?? 0
            const to = drive.sweep[1] ?? 0
            rot = from + (to - from) * lp
          } else if (drive.swing !== undefined) {
            // SWING sways around the rest pose — rate is the SWING
            // FREQUENCY only (never accumulates).
            rot += Math.sin(D * (drive.rate ?? 0.01)) * drive.swing
          } else {
            if (drive.rate !== undefined) rot += D * drive.rate
            if (drive.steps !== undefined) {
              rot += Math.floor(lp * drive.steps) * ((Math.PI * 2) / drive.steps)
            }
          }
          // Idle rotation/spin composes on every rot branch (the gyro
          // rings keep turning, the broken halves keep swaying).
          if (idle) rot += idleH
          d.node.rotation[d.axis] = rot
        }

        // MODEL-6 part assembly — every NON-position-driven part
        // converges from its exploded halo offset (an absolute write
        // from the authored base every frame: idempotent, never
        // accumulates, and exactly the authored pose once build = 1 —
        // the drives' scroll sequences stay byte-identical at rest).
        for (const part of inst.parts) {
          if (inst.posDriven.has(part.node)) continue
          let k = 0
          if (build < 1) {
            const bl = (build - part.stagger) / BUILD_PART_W
            k = 1 - backOut(bl < 0 ? 0 : bl > 1 ? 1 : bl)
          }
          part.node.position.set(
            part.basePos.x + part.out.x * k,
            part.basePos.y + part.out.y * k,
            part.basePos.z + part.out.z * k,
          )
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
        Math.max(rt.shadowW * scale * 1.05, 1e-4),
        Math.max(rt.shadowW * scale * (rt.slot.palette === 'dark' ? 0.36 : 0.28), 1e-4),
        1,
      )
      // MODEL-3 r1–r3: deeper + wider contact ink — the VLM rounds kept
      // asking for grounding on the heavier technical bodies. MODEL-4
      // r2: dark-band warm pools run softer (additive — full ink
      // strength would bloom); light-band ink keeps its 0.5 drop.
      rt.shadowMat.opacity = (rt.slot.palette === 'dark' ? 0.16 : 0.5) * presence

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
    } else {
      // AUDIT-B2 FIX 2: no body on stage (cw ≤ 0.001 or no dominant
      // slot) — DISSOLVE the atmosphere instead of freezing the last
      // goals (the stale α≈0.045/0.03 held a faint static tint over
      // the parked canvas in no-model zones). Only goalAlpha is
      // zeroed: scale/position/color stay so the next body's wash
      // fades in AT SIZE (no swell-from-zero pop); at α=0 they are
      // invisible anyway.
      const w0 = washArr[0]
      const w1 = washArr[1]
      if (w0 && w1) {
        w0.goalAlpha = 0
        w1.goalAlpha = 0
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

    // --- frame chaining: the MODEL-5 ALIVE gate + the settle tail -------
    // anyAlive (a body is on stage) keeps the loop rendering — the
    // bodies LIVE for the reading visitor (idle choreography, blinking
    // lamps, lean springs). Scroll events and pointer moves still poke
    // the bus from outside. When EVERY body is off screen the gate
    // closes and the loop parks after the fades/washes/presence
    // dissolve and the velocity tail drain: idle page with no body
    // visible ⇒ zero rendered frames — the OFFSCREEN guarantee
    // (machine-checked on the same `frames` counter).
    const tailActive = tickScrollTail(dt)
    if (anyAlive || tailActive || settleDelta > FADE_EPS || parDelta > 0.0015) invalidate()
    if (DEV) {
      ;(window as unknown as { __elyraRuneChain?: unknown }).__elyraRuneChain = {
        settle: Math.round(settleDelta * 10000) / 10000,
        par: Math.round(parDelta * 10000) / 10000,
        tail: tailActive,
        alive: anyAlive,
        life: Math.round(lifeT * 1000) / 1000,
      }
    }

    // --- dev introspection ---------------------------------------------------
    if (DEV) {
      frames.current += 1
      const measured = dt > 0 ? 1 / dt : 60
      fps.current += (measured - fps.current) * 0.1
      window.__elyraRuneDebug = {
        route: builtKey.current,
        frames: frames.current,
        fps: fps.current,
        life: Math.round(lifeT * 1000) / 1000,
        alive: anyAlive,
        introHold,
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
          build: Math.round(rt.build * 1000) / 1000,
          ready: rt.ready,
          found: rt.el !== null,
          x: rt.holder.position.x,
          y: rt.holder.position.y,
          scale: rt.holder.scale.x,
          szx: rt.instrument ? Math.round(rt.instrument.size.x * 1000) / 1000 : 0,
          szy: rt.instrument ? Math.round(rt.instrument.size.y * 1000) / 1000 : 0,
          szz: rt.instrument ? Math.round(rt.instrument.size.z * 1000) / 1000 : 0,
          prox: Math.round(rt.prox * 1000) / 1000,
          sprx: Math.round(rt.spr.x * 1000) / 1000,
          spry: Math.round(rt.spr.y * 1000) / 1000,
          drives: (rt.instrument?.drives ?? []).map((d) => ({
            node: d.node.name,
            rot: Math.round(d.node.rotation[d.axis] * 1000) / 1000,
            pos: Math.round(d.node.position[d.axis] * 1000) / 1000,
            scl: Math.round(d.node.scale.x * 1000) / 1000,
            glow: d.mats.length > 0
              ? Math.round((d.mats[0]?.mat?.emissiveIntensity ?? 0) * 100) / 100
              : null,
            fx: Math.round(d.node.position.x * 1000) / 1000,
            fy: Math.round(d.node.position.y * 1000) / 1000,
          })),
        })),
      }
    }
  })

  return <primitive object={field.root} />
}

/** Context-loss guard — same contract as hero-canvas / capability-scene
 * (AUDIT-B2 FIX 9: restored-listener + gl-health telemetry parity —
 * `webglcontextrestored` is observed and both events bump the
 * window.__elyraGlHealth diagnostic via src/lib/gl-health.ts). */
function ContextLossGuard() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      console.warn('[RuneInstruments] WebGL context lost')
      noteGlLost('rune')
    }
    const onRestored = () => {
      console.info('[RuneInstruments] WebGL context restored')
      noteGlRestored('rune')
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
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
