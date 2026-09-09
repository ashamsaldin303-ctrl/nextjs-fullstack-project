/**
 * Tech kits (MODEL-3) — the authored technical bodies.
 *
 * OWNER'S THIRD VERDICT (verbatim intent): the workshop/craft bodies were
 * «أثاث منزل وقطع تاريخية» — the site's bodies must be TECHNICAL objects
 * that say what Elyra BUILDS, «ليس على هويته، وإنما على ماهيته ووظيفته»
 * (not its identity, but its essence and its function): software,
 * infrastructure, automation, devices, signals.
 *
 * Research that shaped this file (full record: scripts/fetch-models-m3.mjs
 * + worklog MODEL-3): Poly Haven's 521-model catalog holds exactly ONE
 * fitting technical photoscan (a real PCB — downloaded as circuit_board,
 * the only downloaded member of this set). Every other reachable source
 * is either vintage consumer electronics (the aesthetic the owner just
 * rejected) or flat low-poly kits that would clash with the studio-PBR
 * stage. The professional route for technical hero bodies — the
 * Stripe/Linear school — is AUTHORED kits: procedural geometry with real
 * PBR materials keyed to the brand tokens, and NAMED part nodes the
 * scroll-driver articulates. That is this file.
 *
 * The set (each body MEANS its section — the mapping is the design):
 *   · serverRack   — home hero: «نبني ما يعمل» — the machine room; every
 *     site Elyra ships lives in one. Its three fans are LIVE ODOMETERS of
 *     D: the rack runs exactly as far as you scroll, and freezes when you
 *     stop (fan_a / fan_b / fan_c).
 *   · cpuChip      — home method: «بدقة العلماء» — engineering precision
 *     at micrometer scale: die, capacitors, a gold pin-grid, etched
 *     traces. Says everything by being exact — no part drives.
 *   · laptopStudio — websites hero: «اللوحة التي تولد عليها المواقع» —
 *     the open studio laptop; its screen is a live wireframe of a
 *     homepage being born (browser chrome, emerald blocks, gold
 *     underline). The lid breathes gently with the scroll (lid).
 *   · robotArm     — automation hero: «الآلة التي تعمل بتمريرك» — THE
 *     machine, successor of the drill press: shoulder/elbow/wrist/grip
 *     sweeps ride the section's travel p, so the arm cycles through a
 *     work pose — reaching, then presenting its glowing workpiece — and
 *     replays it exactly in reverse when you scroll back up.
 *   · smartphone   — work hero: «العمل يعمل في يد العميل» — the shipped
 *     product in the hand: app-grid wireframe screen, camera island,
 *     gold side keys. The product shot — no part drives.
 *   · circuitBoard — about hero: the REAL photoscanned PCB (Poly Haven,
 *     downloaded) — «صنعة اليد الجديدة: دوائر مطبوعة». Lives in the
 *     MODEL_LIBRARY like any GLTF asset — nothing in this file.
 *   · dataStack    — about story: «الأرشيف» — four storage sleds in a
 *     gold-railed frame; sled_c SLIDES OUT of the array as the story
 *     travels (a volume pulled from the shelf — successor of the pulled
 *     encyclopedia volumes).
 *   · dishAntenna  — contact hero: «أرسل الإشارة» — the parabolic dish
 *     that ACQUIRES you: azimuth + elevation sweeps track the section's
 *     travel; the feed tip glows emerald (the signal, waiting).
 *
 * CONTRACTS (unchanged, binding on every kit):
 * · Pure TS + three.js geometry only — no network, no external files.
 * · Deterministic: no Math.random, no wall-clock, no per-frame state —
 *   a given scroll position renders a byte-identical frame.
 * · Every moving part is a NAMED node (fan_a, shoulder, azimuth, sled_c…)
 *   so the registry's PartDrives resolve them by name (suffix-match
 *   contract of rune-scene's findNode).
 * · Cache-owned: each kit is built ONCE per module lifetime and cached;
 *   the scene clones it per mount (geometries/textures/material
 *   originals are shared and never disposed — the exact GLTF-cache
 *   contract; only per-mount material clones are disposed).
 * · Materials are MeshStandardMaterial so the scene's studio
 *   environment, presence fades and env-intensity handling apply to
 *   them identically. Brand-critical emissives are EXACT token colors
 *   (gGreen / gYellow / gBlueLight from the brand registry); structural
 *   metal shades are documented derivations of registry tokens.
 */

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BRAND_COLORS } from '@/lib/brand-colors'
import type { RawInstrument } from './model-loader'

/* ------------------------------------------------------------------ *
 * Palette — structural shades derived from the brand registry (the
 * registry tokens stay the source of truth for brand-critical values).
 * ------------------------------------------------------------------ */

/** gunmetal slate — BRAND_COLORS.dark #0F172A lifted one step. */
const ENCLOSURE = '#242e40'
/** faceplate — dark lifted two steps (front panels, sleds). */
const PANEL = '#37415a'
/** near-black insets — between dark #0F172A and deep #08080A. */
const INK = '#10151f'
/** brushed aluminum. */
const SILVER = '#c3cbd6'
/** metal gold — gYellow #FBBC05 muted toward metal for pins/rails. */
const GOLD = '#c9a227'
/** substrate green — gGreen #34A853 darkened (PCB of the chip). */
const PCB = '#123524'
/** dish cream — the paper/silk family (real satellite dishes are white);
 * double-sided: the lathe's concave face is what the visitor sees. */
const CREAM = '#e9e5da'

/* ------------------------------------------------------------------ *
 * Shared materials (cache-owned originals; the scene clones per mount)
 * ------------------------------------------------------------------ */

function std(color: string, metalness: number, roughness: number, extra?: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra })
}

const M = {
  enclosure: std(ENCLOSURE, 0.62, 0.42),
  panel: std(PANEL, 0.5, 0.55),
  ink: std(INK, 0.35, 0.6),
  silver: std(SILVER, 0.95, 0.22, { envMapIntensity: 1.25 }),
  gold: std(GOLD, 1.0, 0.24, { envMapIntensity: 1.3 }),
  pcb: std(PCB, 0.15, 0.55),
  cream: std(CREAM, 0.06, 0.42, { envMapIntensity: 1.1, side: THREE.DoubleSide, emissive: CREAM, emissiveIntensity: 0.35 }),
  /** activity LED — exact gGreen token. */
  ledGreen: std('#062e19', 0.1, 0.4, {
    emissive: BRAND_COLORS.gGreen, emissiveIntensity: 2.4,
  }),
  /** status LED — exact gYellow token. */
  ledGold: std('#2d2405', 0.1, 0.4, {
    emissive: BRAND_COLORS.gYellow, emissiveIntensity: 1.9,
  }),
  /** the signal / workpiece glow — exact gGreen, hotter. */
  signal: std('#062e19', 0.1, 0.4, {
    emissive: BRAND_COLORS.gGreen, emissiveIntensity: 4.6,
  }),
  /** phone body — glossy dark glass-metal (the "held product"). */
  phoneBody: std(ENCLOSURE, 0.78, 0.26, { envMapIntensity: 1.35 }),
}

/* ------------------------------------------------------------------ *
 * Screen wireframes — deterministic CanvasTexture drawings (no
 * randomness; identical pixels every build). A website being born
 * (laptop) and the shipped app (phone).
 * ------------------------------------------------------------------ */

function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D context unavailable for screen texture')
  return { c, ctx }
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Round-rect helper (deterministic, rounded pixels). */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** The WEBSITES screen: a homepage wireframe being born — browser
 * chrome, emerald hero, gold underline, content cards. */
function drawBrowserWireframe(): THREE.CanvasTexture {
  const W = 1024
  const H = 640
  const { c, ctx } = makeCanvas(W, H)
  // deep canvas
  ctx.fillStyle = '#0a1120'
  ctx.fillRect(0, 0, W, H)
  // chrome bar
  ctx.fillStyle = '#182238'
  ctx.fillRect(0, 0, W, 64)
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#ea4335', '#fbbc05', '#34a853'][i] as string
    ctx.beginPath()
    ctx.arc(34 + i * 26, 32, 7, 0, Math.PI * 2)
    ctx.fill()
  }
  // URL pill
  ctx.fillStyle = '#0e1830'
  rr(ctx, 150, 14, 460, 36, 18)
  ctx.fill()
  ctx.fillStyle = '#fbbc05'
  ctx.beginPath()
  ctx.arc(178, 32, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#31405f'
  ctx.fillRect(196, 28, 180, 8)
  ctx.fillRect(392, 28, 90, 8)
  // faint grid dots behind content
  ctx.fillStyle = 'rgba(96,165,250,0.10)'
  for (let y = 96; y < H; y += 44) {
    for (let x = 40; x < W - 30; x += 44) ctx.fillRect(x, y, 2, 2)
  }
  // hero block (emerald outline + translucent fill)
  ctx.fillStyle = 'rgba(52,168,83,0.14)'
  rr(ctx, 48, 104, 600, 180, 14)
  ctx.fill()
  ctx.strokeStyle = '#34a853'
  ctx.lineWidth = 3
  rr(ctx, 48, 104, 600, 180, 14)
  ctx.stroke()
  // hero heading bars + gold underline
  ctx.fillStyle = '#34a853'
  ctx.fillRect(84, 150, 320, 18)
  ctx.fillRect(84, 182, 210, 12)
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(84, 222, 130, 7)
  // hero CTA pill
  ctx.strokeStyle = '#60a5fa'
  ctx.lineWidth = 2.5
  rr(ctx, 84, 246, 132, 26, 13)
  ctx.stroke()
  // side column
  ctx.strokeStyle = 'rgba(96,165,250,0.55)'
  rr(ctx, 676, 104, 300, 180, 10)
  ctx.stroke()
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(96,165,250,0.5)'
    ctx.fillRect(700, 130 + i * 36, 250 - i * 34, 10)
  }
  // three content cards
  for (let i = 0; i < 3; i++) {
    const x = 48 + i * 208
    ctx.fillStyle = 'rgba(52,168,83,0.08)'
    rr(ctx, x, 316, 188, 150, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(52,168,83,0.75)'
    rr(ctx, x, 316, 188, 150, 10)
    ctx.stroke()
    ctx.fillStyle = '#34a853'
    ctx.fillRect(x + 22, 342, 92, 10)
    ctx.fillStyle = 'rgba(234,179,8,0.85)'
    ctx.fillRect(x + 22, 366, 64, 6)
    ctx.fillStyle = 'rgba(96,165,250,0.4)'
    ctx.fillRect(x + 22, 390, 144 - (i % 2) * 30, 6)
    ctx.fillRect(x + 22, 406, 120, 6)
    ctx.fillRect(x + 22, 422, 150, 6)
  }
  // footer bar
  ctx.fillStyle = 'rgba(96,165,250,0.25)'
  ctx.fillRect(48, 508, 928, 8)
  ctx.fillRect(48, 530, 560, 6)
  // the gold CURSOR — the hand placing the next block
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(636, 346, 3, 18)
  ctx.fillRect(636, 364, 12, 3)
  return toTexture(c)
}

/** The WORK screen: the shipped app — status bar, search pill, card
 * grid (one live/emerald), bottom tab bar. */
function drawAppWireframe(): THREE.CanvasTexture {
  const W = 480
  const H = 1000
  const { c, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#0a1120'
  ctx.fillRect(0, 0, W, H)
  // status bar
  ctx.fillStyle = '#31405f'
  ctx.fillRect(44, 30, 90, 12)
  ctx.fillRect(388, 30, 56, 12)
  ctx.fillStyle = '#fbbc05'
  ctx.beginPath()
  ctx.arc(226, 34, 6, 0, Math.PI * 2)
  ctx.fill()
  // search pill
  ctx.fillStyle = '#131d33'
  rr(ctx, 36, 84, 408, 44, 22)
  ctx.fill()
  ctx.strokeStyle = 'rgba(96,165,250,0.5)'
  rr(ctx, 36, 84, 408, 44, 22)
  ctx.stroke()
  ctx.fillStyle = '#31405f'
  ctx.beginPath()
  ctx.arc(64, 106, 7, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillRect(84, 101, 150, 10)
  // section heading
  ctx.fillStyle = '#34a853'
  ctx.fillRect(40, 164, 190, 16)
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(40, 192, 90, 7)
  // card grid 2×3 — the middle card is the LIVE one
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const x = 36 + col * 204
      const y = 232 + row * 200
      const live = row === 1 && col === 0
      ctx.fillStyle = live ? 'rgba(52,168,83,0.24)' : 'rgba(25,38,66,0.95)'
      rr(ctx, x, y, 184, 172, 16)
      ctx.fill()
      ctx.strokeStyle = live ? '#3ddc70' : 'rgba(96,165,250,0.6)'
      ctx.lineWidth = live ? 4 : 2.5
      rr(ctx, x, y, 184, 172, 16)
      ctx.stroke()
      if (live) {
        ctx.fillStyle = 'rgba(52,168,83,0.4)'
        rr(ctx, x + 20, y + 18, 84, 84, 12)
        ctx.fill()
        ctx.strokeStyle = '#3ddc70'
        rr(ctx, x + 20, y + 18, 84, 84, 12)
        ctx.stroke()
      } else {
        ctx.fillStyle = 'rgba(96,165,250,0.45)'
        rr(ctx, x + 20, y + 18, 84, 84, 12)
        ctx.fill()
      }
      ctx.fillStyle = live ? '#3ddc70' : '#6684ad'
      ctx.fillRect(x + 20, y + 118, 110, 12)
      ctx.fillStyle = 'rgba(234,179,8,0.95)'
      ctx.fillRect(x + 20, y + 140, 60, 6)
    }
  }
  // bottom tab bar
  ctx.fillStyle = '#0d1628'
  rr(ctx, 20, 872, 440, 100, 26)
  ctx.fill()
  for (let i = 0; i < 4; i++) {
    const cx = 76 + i * 110
    const active = i === 0
    ctx.strokeStyle = active ? '#34a853' : '#31405f'
    ctx.lineWidth = active ? 4 : 2.5
    if (i % 2 === 0) {
      rr(ctx, cx - 13, 902, 26, 26, 7)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(cx, 915, 13, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  return toTexture(c)
}

/* Screen materials (cache-owned; emissive-map driven so they read as
 * LIT displays — the "born on" light of the canvas). */
const browserTex = /* lazy */ { value: null as THREE.CanvasTexture | null }
const appTex = /* lazy */ { value: null as THREE.CanvasTexture | null }

function screenMaterial(kind: 'browser' | 'app'): THREE.MeshStandardMaterial {
  // Textures are created lazily: canvas needs a DOM. First kit build
  // happens in the browser (client-only scene), never at SSR.
  if (kind === 'browser') {
    if (!browserTex.value) browserTex.value = drawBrowserWireframe()
    const t = browserTex.value
    return std('#0a1120', 0.05, 0.32, { map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 1.35 })
  }
  if (!appTex.value) appTex.value = drawAppWireframe()
  const t = appTex.value
  return std('#0a1120', 0.05, 0.3, { map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 1.9 })
}

/* ------------------------------------------------------------------ *
 * Small builders
 * ------------------------------------------------------------------ */

/** A named group at a position (drive nodes resolve by name). */
function node(name: string, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group()
  g.name = name
  g.position.set(x, y, z)
  return g
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  return m
}

/** An LED dot — small emissive cylinder facing +z. */
const ledGeo = /* shared */ new THREE.CylinderGeometry(0.009, 0.009, 0.014, 10)
function led(mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(ledGeo, mat, x, y, z)
  m.rotation.x = Math.PI / 2
  return m
}

/* ------------------------------------------------------------------ *
 * KIT 1 · serverRack — home hero
 * ------------------------------------------------------------------ */

function buildServerRack(): THREE.Group {
  const g = node('serverRack')
  const W = 0.62
  const H = 1.6
  const D = 0.72

  // shell + feet
  g.add(mesh(new RoundedBoxGeometry(W, H, D, 3, 0.028), M.enclosure, 0, 0, 0))
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(mesh(new RoundedBoxGeometry(0.09, 0.05, 0.09, 2, 0.012), M.ink, sx * 0.24, -H / 2 - 0.02, sz * 0.28))
    }
  }
  // front bezel + gold rails (the brand's metal, at the door)
  g.add(mesh(new RoundedBoxGeometry(W - 0.06, H - 0.06, 0.022, 2, 0.012), M.panel, 0, 0, D / 2 + 0.002))
  for (const sx of [-1, 1]) {
    g.add(mesh(new RoundedBoxGeometry(0.03, H - 0.06, 0.018, 2, 0.008), M.gold, sx * (W / 2 - 0.015), 0, D / 2 + 0.016))
  }

  // FAN BANK — the odometers (named nodes; blades + hub + ring)
  const fanY = 0.52
  const fanXs = [-0.18, 0, 0.18]
  const fanNames = ['fan_a', 'fan_b', 'fan_c']
  const fanRates = [0.02, 0.026, 0.02] // registry mirrors these as D-odometers
  void fanRates
  for (let i = 0; i < 3; i++) {
    const fx = fanXs[i] as number
    // recessed ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.014, 10, 28), M.ink)
    ring.position.set(fx, fanY, D / 2 + 0.03)
    g.add(ring)
    // the DRIVE node — rotates around z (faces the viewer)
    const fan = node(fanNames[i] as string, fx, fanY, D / 2 + 0.03)
    fan.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.028, 12), M.silver).rotateX(Math.PI / 2))
    for (let b = 0; b < 7; b++) {
      const blade = mesh(new RoundedBoxGeometry(0.016, 0.062, 0.008, 1, 0.003), M.panel, 0, 0.042, 0.006)
      blade.rotation.z = (b / 7) * Math.PI * 2
      fan.add(blade)
    }
    // corner LED beside each fan
    g.add(led(i === 1 ? M.ledGold : M.ledGreen, fx + 0.098, fanY + 0.078, D / 2 + 0.036))
    g.add(fan)
  }
  // top cap dot
  g.add(led(M.ledGreen, 0, 0.72, D / 2 + 0.02))

  // SERVER SLEDS — eight units, handles + LED pairs + vent slats
  const sledGeo = new RoundedBoxGeometry(0.5, 0.112, 0.02, 2, 0.008)
  const handleGeo = new RoundedBoxGeometry(0.14, 0.026, 0.03, 2, 0.01)
  const ventGeo = new THREE.BoxGeometry(0.2, 0.008, 0.004)
  for (let i = 0; i < 8; i++) {
    const y = -0.72 + i * 0.152
    g.add(mesh(sledGeo, i % 3 === 2 ? M.silver : M.panel, 0, y, D / 2 + 0.014))
    g.add(mesh(handleGeo, M.ink, 0.06, y, D / 2 + 0.03))
    for (let v = 0; v < 3; v++) {
      g.add(mesh(ventGeo, M.ink, -0.14 - v * 0.045, y, D / 2 + 0.026))
    }
    g.add(led(M.ledGreen, -0.225, y + 0.026, D / 2 + 0.026))
    g.add(led(i % 2 === 0 ? M.ledGold : M.ledGreen, -0.225, y - 0.026, D / 2 + 0.026))
  }
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 2 · cpuChip — home method
 * ------------------------------------------------------------------ */

function buildCpuChip(): THREE.Group {
  const g = node('cpuChip')
  // substrate
  g.add(mesh(new RoundedBoxGeometry(1.0, 0.055, 1.0, 2, 0.01), M.pcb, 0, 0, 0))
  // silicon die + inner plane (VLM r2: crisper die)
  const dieMat = std('#cdd6e2', 0.9, 0.18, { envMapIntensity: 1.3 })
  g.add(mesh(new RoundedBoxGeometry(0.42, 0.05, 0.42, 2, 0.006), dieMat, 0, 0.05, 0))
  g.add(mesh(new RoundedBoxGeometry(0.34, 0.052, 0.34, 2, 0.004), M.ink, 0, 0.051, 0))
  // pin-1 marker: gold corner chamfer
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.006, 0.09), M.gold, -0.4, 0.03, -0.42))
  // etched traces — thin gold lines running from die to edge
  const traceGeo = new THREE.BoxGeometry(0.012, 0.005, 1)
  const traceZGeo = new THREE.BoxGeometry(1, 0.005, 0.012)
  for (let i = 0; i < 3; i++) {
    const t = i - 1
    g.add(mesh(traceGeo, M.gold, 0.235 + i * 0.05, 0.029, 0.2 + t * 0.18))
    g.add(mesh(traceZGeo, M.gold, -0.2 - t * 0.18, 0.029, -0.235 - i * 0.05))
  }
  // pin grid (bottom, 13×13) — instanced gold pins (VLM r2: denser)
  const pinGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.1, 6)
  const pins = new THREE.InstancedMesh(pinGeo, M.gold, 169)
  const mat4 = new THREE.Matrix4()
  let idx = 0
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      mat4.makeTranslation(-0.42 + i * 0.07, -0.077, -0.42 + j * 0.07)
      pins.setMatrixAt(idx, mat4)
      idx++
    }
  }
  pins.name = 'pinGrid'
  g.add(pins)
  // capacitors around the die (two tones)
  const capGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.052, 12)
  const capTan = std('#a8814f', 0.3, 0.5)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const r = 0.33 + (i % 2) * 0.05
    g.add(mesh(capGeo, i % 2 === 0 ? M.silver : capTan, Math.cos(a) * r, 0.054, Math.sin(a) * r))
  }
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 3 · laptopStudio — websites hero
 * ------------------------------------------------------------------ */

function buildLaptopStudio(): THREE.Group {
  const g = node('laptopStudio')
  const baseW = 1.04
  const baseD = 0.68

  // base deck
  g.add(mesh(new RoundedBoxGeometry(baseW, 0.036, baseD, 2, 0.014), M.silver, 0, 0.018, 0))
  // keyboard well + keys (instanced) + space bar + trackpad
  g.add(mesh(new RoundedBoxGeometry(0.64, 0.01, 0.3, 1, 0.005), M.ink, 0, 0.038, -0.05))
  const keyGeo = new THREE.BoxGeometry(0.046, 0.008, 0.044)
  const keys = new THREE.InstancedMesh(keyGeo, M.panel, 48)
  const mat4 = new THREE.Matrix4()
  let k = 0
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 12; col++) {
      mat4.makeTranslation(-0.27 + col * 0.0492, 0.042, -0.17 + row * 0.051)
      keys.setMatrixAt(k, mat4)
      k++
    }
  }
  keys.name = 'keyGrid'
  g.add(keys)
  g.add(mesh(new THREE.BoxGeometry(0.18, 0.008, 0.044), M.panel, -0.06, 0.042, 0.085))
  g.add(mesh(new RoundedBoxGeometry(0.26, 0.008, 0.17, 1, 0.004), M.ink, 0.08, 0.039, 0.21))

  // hinge — a full-width gold bar at the pivot (bridges deck ↔ lid as
  // one cohesive rigid assembly; the VLM r2 note about hinge cohesion)
  const hingeBar = mesh(new THREE.CylinderGeometry(0.02, 0.02, baseW - 0.06, 12), M.gold, 0, 0.034, -baseD / 2 + 0.01)
  hingeBar.rotation.z = Math.PI / 2
  g.add(hingeBar)

  // LID — the drive node. Pivot at the back edge; built CLOSED (flat
  // on the deck, screen facing down like a real laptop) so the open
  // rest pose is a single negative rotation around x. ALL lid panels
  // are FLAT in the lid's own frame: x = width, y = thickness, z =
  // length (pivot → front edge) — the lid rotates as one rigid slab.
  // Local anatomy: +z runs from the hinge toward the deck's front
  // edge, so the drawing's "up" lies toward the FRONT — exactly like
  // a real laptop, the screen's top edge lands at the far edge when
  // closed and stands up when open.
  const lid = node('lid', 0, 0.034, -baseD / 2 + 0.01)
  lid.rotation.x = -1.75
  // shell (spans y 0.014..0.038 — outer back is +y, the closed top)
  lid.add(mesh(new RoundedBoxGeometry(baseW, 0.024, 0.7, 2, 0.012), M.silver, 0, 0.026, 0.352))
  // bezel plate on the inner face (visible from −y)
  lid.add(mesh(new RoundedBoxGeometry(0.98, 0.005, 0.66, 2, 0.006), M.ink, 0, 0.0125, 0.352))
  // screen (normal = local −y: faces the deck closed, the visitor open;
  // drawing-up = +z = the front edge — upright for the open viewer)
  const screen = mesh(new THREE.PlaneGeometry(0.94, 0.6), screenMaterial('browser'), 0, 0.0098, 0.352)
  screen.rotation.x = Math.PI / 2
  lid.add(screen)
  // webcam — top bezel (far edge: stands highest when open)
  const cam = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 10), M.ink, 0, 0.009, 0.646)
  cam.rotation.x = Math.PI / 2
  lid.add(cam)
  // rear logo — the gold maker's mark on the outer back (+y face)
  lid.add(mesh(new RoundedBoxGeometry(0.1, 0.004, 0.1, 1, 0.02), M.gold, 0, 0.039, 0.352))
  g.add(lid)
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 4 · robotArm — automation hero
 * ------------------------------------------------------------------ */

function buildRobotArm(): THREE.Group {
  const g = node('robotArm')
  // plinth + gold bolt ring + status LED
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.09, 28), M.enclosure, 0, 0.045, 0))
  const boltGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.03, 6)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    g.add(mesh(boltGeo, M.gold, Math.cos(a) * 0.21, 0.09, Math.sin(a) * 0.21))
  }
  g.add(led(M.ledGreen, 0, 0.16, 0.12))

  // SHOULDER — drive node (rotation.z; the arm plane faces the viewer)
  const shoulder = node('shoulder', 0, 0.09, 0)
  shoulder.rotation.z = 0.42
  shoulder.add(mesh(new RoundedBoxGeometry(0.2, 0.32, 0.26, 2, 0.02), M.enclosure, 0, 0.16, 0))
  const shoulderJoint = mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.3, 20), M.silver, 0, 0.33, 0)
  shoulderJoint.rotation.x = Math.PI / 2
  shoulder.add(shoulderJoint)
  // upper arm
  shoulder.add(mesh(new RoundedBoxGeometry(0.14, 0.56, 0.18, 2, 0.03), M.panel, 0, 0.62, 0))
  shoulder.add(mesh(new THREE.BoxGeometry(0.146, 0.06, 0.186), M.gold, 0, 0.86, 0))
  g.add(shoulder)

  // ELBOW — drive node nested at the upper arm's top
  const elbow = node('elbow', 0, 0.9, 0)
  elbow.rotation.z = -1.02
  const elbowJoint = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 18), M.silver, 0, 0, 0)
  elbowJoint.rotation.x = Math.PI / 2
  elbow.add(elbowJoint)
  // forearm + gold band
  elbow.add(mesh(new RoundedBoxGeometry(0.11, 0.46, 0.15, 2, 0.024), M.enclosure, 0, 0.24, 0))
  elbow.add(mesh(new THREE.BoxGeometry(0.116, 0.05, 0.156), M.gold, 0, 0.38, 0))
  shoulder.add(elbow)

  // WRIST — drive node at the forearm's end
  const wrist = node('wrist', 0, 0.5, 0)
  wrist.rotation.z = 0.55
  const wristJoint = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.17, 14), M.silver, 0, 0, 0)
  wristJoint.rotation.x = Math.PI / 2
  wrist.add(wristJoint)
  wrist.add(mesh(new RoundedBoxGeometry(0.09, 0.17, 0.11, 2, 0.016), M.panel, 0, 0.085, 0))
  elbow.add(wrist)

  // GRIPPER — two fingers (drive nodes) pinching the glowing workpiece
  const grip_l = node('grip_l', -0.05, 0.19, 0)
  grip_l.rotation.z = 0.3
  grip_l.add(mesh(new RoundedBoxGeometry(0.028, 0.15, 0.055, 1, 0.008), M.gold, 0, 0.065, 0))
  const grip_r = node('grip_r', 0.05, 0.19, 0)
  grip_r.rotation.z = -0.3
  grip_r.add(mesh(new RoundedBoxGeometry(0.028, 0.15, 0.055, 1, 0.008), M.gold, 0, 0.065, 0))
  wrist.add(grip_l, grip_r)
  // the WORKPIECE — a small emerald-lit cube between the fingers: the
  // thing being automated
  const workpiece = mesh(new RoundedBoxGeometry(0.075, 0.075, 0.075, 2, 0.012), M.signal, 0, 0.245, 0)
  workpiece.name = 'workpiece'
  wrist.add(workpiece)
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 5 · smartphone — work hero
 * ------------------------------------------------------------------ */

function buildSmartphone(): THREE.Group {
  const g = node('smartphone')
  // body (pill edges, glossy glass-metal) + bezel + screen
  g.add(mesh(new RoundedBoxGeometry(0.36, 0.74, 0.048, 4, 0.06), M.phoneBody, 0, 0, 0))
  g.add(mesh(new RoundedBoxGeometry(0.335, 0.705, 0.004, 2, 0.052), M.ink, 0, 0, 0.0242))
  // screen — IN FRONT of the bezel slab's front face (0.0262): a
  // coplanar plane inside the slab is occluded by it (VLM r2 read the
  // phone as a "blank slab" — the screen was buried in the bezel).
  const screen = mesh(new THREE.PlaneGeometry(0.312, 0.672), screenMaterial('app'), 0, 0, 0.0268)
  g.add(screen)
  // side keys — gold
  g.add(mesh(new THREE.BoxGeometry(0.012, 0.11, 0.014), M.gold, 0.183, 0.16, 0))
  g.add(mesh(new THREE.BoxGeometry(0.012, 0.06, 0.014), M.gold, 0.183, 0.3, 0))
  // camera island (back) — two lenses + flash dot
  g.add(mesh(new RoundedBoxGeometry(0.15, 0.15, 0.014, 2, 0.03), M.panel, -0.085, 0.26, -0.028))
  for (const dy of [-0.032, 0.032]) {
    g.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 16), M.silver, -0.108, 0.26 + dy, -0.037).rotateX(Math.PI / 2))
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.014, 12), M.ink, -0.108, 0.26 + dy, -0.038).rotateX(Math.PI / 2))
  }
  g.add(led(M.ledGold, -0.032, 0.32, -0.036))
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 6 · dataStack — about story
 * ------------------------------------------------------------------ */

function buildDataStack(): THREE.Group {
  const g = node('dataStack')
  // gold-railed frame + base plate
  for (const sx of [-1, 1]) {
    g.add(mesh(new RoundedBoxGeometry(0.03, 0.72, 0.52, 2, 0.01), M.gold, sx * 0.385, 0.02, 0))
  }
  g.add(mesh(new RoundedBoxGeometry(0.8, 0.05, 0.54, 2, 0.014), M.enclosure, 0, -0.33, 0))
  // four sleds; sled_c is the drive node that slides out
  const names = ['sled_a', 'sled_b', 'sled_c', 'sled_d']
  const sledGeo = new RoundedBoxGeometry(0.72, 0.13, 0.48, 2, 0.018)
  const handleGeo = new RoundedBoxGeometry(0.17, 0.03, 0.032, 2, 0.012)
  const ventGeo = new THREE.BoxGeometry(0.22, 0.01, 0.004)
  for (let i = 0; i < 4; i++) {
    const y = -0.16 + i * 0.165
    const sled = node(names[i] as string, 0, y, 0)
    sled.add(mesh(sledGeo, i % 2 === 1 ? M.silver : M.panel, 0, 0, 0))
    sled.add(mesh(handleGeo, M.ink, 0.12, 0, 0.252))
    for (let v = 0; v < 3; v++) {
      sled.add(mesh(ventGeo, M.ink, -0.15 - v * 0.05, 0.02, 0.252))
      sled.add(mesh(ventGeo, M.ink, -0.15 - v * 0.05, -0.02, 0.252))
    }
    sled.add(led(M.ledGreen, -0.28, 0.032, 0.252))
    sled.add(led(i === 3 ? M.ledGold : M.ledGreen, -0.28, -0.032, 0.252))
    g.add(sled)
  }
  return g
}

/** A strut (thin cylinder) from point a to point b — used by the
 * dish's tripod feed legs (VLM r3: the feed must visibly INTERSECT the
 * rim, not float). */
function strut(a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
  const dir = b.clone().sub(a)
  const len = Math.max(dir.length(), 1e-4)
  const geo = new THREE.CylinderGeometry(radius, radius, len, 8)
  const m = new THREE.Mesh(geo, mat)
  m.position.copy(a).addScaledVector(dir, 0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  return m
}

/* ------------------------------------------------------------------ *
 * KIT 7 · dishAntenna — contact hero
 * ------------------------------------------------------------------ */

function buildDishAntenna(): THREE.Group {
  const g = node('dishAntenna')
  // tripod legs + collar + mast
  const legGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.6, 10)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2
    const leg = mesh(legGeo, M.ink, Math.cos(a) * 0.16, 0.24, Math.sin(a) * 0.16)
    leg.rotation.z = -Math.cos(a) * 0.34
    leg.rotation.x = Math.sin(a) * 0.34
    g.add(leg)
  }
  g.add(mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.14, 16), M.enclosure, 0, 0.52, 0))
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 12), M.silver, 0, 0.66, 0))

  // AZIMUTH — drive node (rotation.y): the whole head swivels
  const azimuth = node('azimuth', 0, 0.8, 0)
  azimuth.rotation.y = 0.55
  // yoke arms + trunnions
  for (const sx of [-1, 1]) {
    azimuth.add(mesh(new RoundedBoxGeometry(0.05, 0.22, 0.06, 2, 0.012), M.enclosure, sx * 0.15, 0.1, 0))
  }
  // ELEVATION — drive node (rotation.x): the dish tilts to acquire.
  // Negative base = the +z dish axis swings UP toward the visitor
  // (elevation-local +z maps to (0, −sinθ, cosθ); θ = −0.55 → up 32°).
  const elevation = node('elevation', 0, 0.16, 0)
  elevation.rotation.x = -0.55
  // the dish — lathed parabola, cream (real dishes are white: it reads
  // against every band and ties to the silk/paper family)
  const profile: THREE.Vector2[] = []
  for (let i = 0; i <= 10; i++) {
    const r = (i / 10) * 0.52
    profile.push(new THREE.Vector2(r, r * r * 0.8))
  }
  const dishGeo = new THREE.LatheGeometry(profile, 44)
  const dish = new THREE.Mesh(dishGeo, M.cream)
  dish.rotation.x = Math.PI / 2 // lathe opens +y → concave faces +z local; rim lands toward the visitor
  elevation.add(dish)
  // gold rim clamp (VLM r2: contrast so the cream reads as designed)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.018, 10, 44), M.gold)
  rim.position.set(0, 0, 0.165)
  elevation.add(rim)
  // back hub (behind the vertex) + trunnion clamp
  const hub = mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.09, 14), M.enclosure, 0, 0, -0.055)
  hub.rotation.x = Math.PI / 2
  elevation.add(hub)
  // FEED ASSEMBLY — three struts from the RIM to the prime focus
  // (R 0.52, depth 0.17 → focus ≈ 0.42 out on the boresight). Real
  // prime-focus geometry: the feed visibly intersects the dish rim
  // (VLM r3 "floating horn" — the single cantilever read detached).
  const focus = new THREE.Vector3(0, -0.115, 0.42)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6
    const rimPt = new THREE.Vector3(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.155)
    elevation.add(strut(rimPt, focus, 0.011, M.silver))
  }
  // feed horn + THE SIGNAL (emerald tip) at the focus
  const horn = mesh(new THREE.CylinderGeometry(0.044, 0.03, 0.11, 12), M.gold, 0, -0.115, 0.4)
  horn.rotation.x = Math.PI / 2
  elevation.add(horn)
  const tip = mesh(new THREE.SphereGeometry(0.044, 14, 12), M.signal, 0, -0.115, 0.475)
  tip.name = 'signalTip'
  elevation.add(tip)
  // the glow halo — additive sphere so the tip READS as a live signal
  // at hero scale (no postprocessing in the scene; a static material
  // stays freeze-contract-pure).
  const halo = mesh(
    new THREE.SphereGeometry(0.085, 14, 12),
    new THREE.MeshBasicMaterial({
      color: BRAND_COLORS.gGreen, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    0, -0.115, 0.475,
  )
  halo.name = 'signalHalo'
  elevation.add(halo)
  azimuth.add(elevation)
  g.add(azimuth)
  return g
}

/* ------------------------------------------------------------------ *
 * Registry + cache (module-lifetime; the scene clones per mount)
 * ------------------------------------------------------------------ */

const KIT_BUILDERS: Record<string, () => THREE.Group> = {
  serverRack: buildServerRack,
  cpuChip: buildCpuChip,
  laptopStudio: buildLaptopStudio,
  robotArm: buildRobotArm,
  smartphone: buildSmartphone,
  dataStack: buildDataStack,
  dishAntenna: buildDishAntenna,
}

const kitCache = new Map<string, RawInstrument>()

/** Build (or fetch from cache) an authored tech kit as a RawInstrument —
 * the same contract loadInstrument gives GLTF assets: bbox-centered
 * clone source with size/center in the kit's own units. */
export function buildTechKit(kit: string): RawInstrument {
  const cached = kitCache.get(kit)
  if (cached) return cached
  const builder = KIT_BUILDERS[kit]
  if (!builder) throw new Error(`[tech-kits] unknown kit: ${kit}`)
  const scene = builder()
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const safe = size.clone()
  if (safe.x < 1e-6) safe.x = 1e-6
  if (safe.y < 1e-6) safe.y = 1e-6
  if (safe.z < 1e-6) safe.z = 1e-6
  const raw = { scene, size: safe, center }
  kitCache.set(kit, raw)
  return raw
}
