/**
 * Tech kits (MODEL-4) — the SECTION-VOICE bodies.
 *
 * OWNER'S FOURTH VERDICT (verbatim intent): the technical set was
 * «تتحدث عن التكنولوجيا ولكنها لا تعبر عن الموضوع الموجودة فيه» —
 * technical, yes, but not speaking the TOPIC of the section they live
 * in. «السيرفرات لا تدل على ماذا نبني» — the servers don't say what
 * we build; the robot arm «لا تدل أبداً على الأتمتة من خلال النودز» —
 * says nothing of automation-through-nodes. Each body must now be the
 * LITERAL subject of its section — the mapping IS the message:
 *
 *   · siteFlow     — home hero: the agency's whole offer in one body —
 *     a BROWSER (the beautiful sites Elyra builds) flowing down a gold
 *     pipeline into three AUTOMATION NODES (envelope → invoice →
 *     report): «مواقع فائقة الجمال… وأنظمة أتمتة ذكية بـ n8n». The
 *     pulses ride the links as you scroll — the offer, running.
 *   · journeyRail  — home method: «رحلة واضحة، من الفكرة إلى
 *     الإطلاق» — a four-station ascending rail (discover → design →
 *     build → launch); the glowing traveler rides the rail on your
 *     scroll and the station rings spin as odometers.
 *   · laptopStudio — websites hero: «مواقع تُبنى لتبهر» — the studio
 *     laptop, now with UI blocks (nav, hero, CTA) that ASSEMBLE onto
 *     the screen as the section travels: a website being born under
 *     your scrolling.
 *   · nodeFlow     — automation hero: THE n8n canvas made physical —
 *     a dot-grid editor panel carrying four node cards (trigger bolt →
 *     invoice → sheet → chat) wired by gold links; three pulses run
 *     the workflow as you scroll and freeze when you stop.
 *   · workDeck     — work hero: «نتائج تتحدث بالأرقام» — a cascade of
 *     three shipped-project browser cards, each wearing its metric
 *     (+140%, 3.2×, +92%); the deck fans open across the travel.
 *   · obsessionLens— about hero: «صغيرة الحجم، كبيرة الهوس
 *     بالتفاصيل» — a large gold magnifier sweeping across a tiny
 *     fine-traced circuit tile: the studio's obsession, literal.
 *   · dataStack    — about story (kept): the archive — four sleds,
 *     one pulled from the shelf as the story travels.
 *   · chatSignal   — contact hero: «لنبدأ الحديث — نرد عادة خلال
 *     ساعتين» — a speech bubble with three typing dots bobbing on the
 *     scroll's own oscillation: a conversation already alive.
 *   · duck         — 404 (kept, downloaded): rubber-duck debugging —
 *     programmer culture, the survivor the owner kept.
 *
 * CONTRACTS (unchanged, binding on every kit):
 * · Pure TS + three.js geometry only — no network, no external files.
 * · Deterministic: no Math.random, no wall-clock, no per-frame state —
 *   a given scroll position renders a byte-identical frame.
 * · Every moving part is a NAMED node (pulse_a, traveler, dot_a, lens…)
 *   so the registry's PartDrives resolve them by name (suffix-match
 *   contract of rune-scene's findNode). Slide drives move the node
 *   INSIDE a rotated frame group, so the pulse travels the link's own
 *   direction (a rotated group's position would move on the PARENT's
 *   axes — the child's does not).
 * · Cache-owned: each kit is built ONCE per module lifetime and cached;
 *   the scene clones it per mount (geometries/textures/material
 *   originals are shared and never disposed — the exact GLTF-cache
 *   contract; only per-mount material clones are disposed).
 * · Materials are MeshStandardMaterial so the scene's studio
 *   environment, presence fades and env-intensity handling apply to
 *   them identically. Brand-critical emissives are EXACT token colors
 *   (gGreen / gYellow from the brand registry); structural metal
 *   shades are documented derivations of registry tokens.
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
  /** the lens glass — a clear disc catching the studio env (VLM r1:
   * was reading opaque/dark — brighter tint + more env + less fill
   * so it reads as GLASS magnifying the traces beneath). */
  glass: std('#cfe4f0', 0.9, 0.05, {
    transparent: true, opacity: 0.22, envMapIntensity: 2.2, side: THREE.DoubleSide,
  }),
  /** activity LED — exact gGreen token. */
  ledGreen: std('#062e19', 0.1, 0.4, {
    emissive: BRAND_COLORS.gGreen, emissiveIntensity: 2.4,
  }),
  /** status LED — exact gYellow token. */
  ledGold: std('#2d2405', 0.1, 0.4, {
    emissive: BRAND_COLORS.gYellow, emissiveIntensity: 1.9,
  }),
  /** chrome close-dot — the browser's traffic red. */
  ledRed: std('#3a0d0a', 0.1, 0.4, {
    emissive: '#ea4335', emissiveIntensity: 1.6,
  }),
  /** the signal / pulse glow — exact gGreen, hotter. */
  signal: std('#062e19', 0.1, 0.4, {
    emissive: BRAND_COLORS.gGreen, emissiveIntensity: 4.6,
  }),
}

/* ------------------------------------------------------------------ *
 * Deterministic CanvasTextures (identical pixels every build; no
 * randomness, no wall-clock). Faces of the section-voice bodies.
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
 * chrome (skipped in the compact variant: the 3D chrome bar replaces
 * it), emerald hero, gold underline, content cards, the gold cursor. */
function drawBrowserWireframe(compact: boolean): THREE.CanvasTexture {
  const W = 1024
  const H = 640
  const { c, ctx } = makeCanvas(W, H)
  // deep canvas
  ctx.fillStyle = '#0a1120'
  ctx.fillRect(0, 0, W, H)
  const top = compact ? 12 : 96
  if (!compact) {
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
  }
  // faint grid dots behind content
  ctx.fillStyle = 'rgba(96,165,250,0.10)'
  for (let y = top + 8; y < H; y += 44) {
    for (let x = 40; x < W - 30; x += 44) ctx.fillRect(x, y, 2, 2)
  }
  // hero block (emerald outline + translucent fill)
  ctx.fillStyle = 'rgba(52,168,83,0.14)'
  rr(ctx, 48, top + 8, 600, 172, 14)
  ctx.fill()
  ctx.strokeStyle = '#34a853'
  ctx.lineWidth = 3
  rr(ctx, 48, top + 8, 600, 172, 14)
  ctx.stroke()
  // hero heading bars + gold underline
  ctx.fillStyle = '#34a853'
  ctx.fillRect(84, top + 44, 320, 18)
  ctx.fillRect(84, top + 76, 210, 12)
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(84, top + 116, 130, 7)
  // hero CTA pill
  ctx.strokeStyle = '#60a5fa'
  ctx.lineWidth = 2.5
  rr(ctx, 84, top + 140, 132, 26, 13)
  ctx.stroke()
  // side column
  ctx.strokeStyle = 'rgba(96,165,250,0.55)'
  rr(ctx, 676, top + 8, 300, 172, 10)
  ctx.stroke()
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(96,165,250,0.5)'
    ctx.fillRect(700, top + 34 + i * 36, 250 - i * 34, 10)
  }
  // three content cards
  for (let i = 0; i < 3; i++) {
    const x = 48 + i * 208
    const y = top + 212
    ctx.fillStyle = 'rgba(52,168,83,0.08)'
    rr(ctx, x, y, 188, 150, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(52,168,83,0.75)'
    rr(ctx, x, y, 188, 150, 10)
    ctx.stroke()
    ctx.fillStyle = '#34a853'
    ctx.fillRect(x + 22, y + 26, 92, 10)
    ctx.fillStyle = 'rgba(234,179,8,0.85)'
    ctx.fillRect(x + 22, y + 50, 64, 6)
    ctx.fillStyle = 'rgba(96,165,250,0.4)'
    ctx.fillRect(x + 22, y + 74, 144 - (i % 2) * 30, 6)
    ctx.fillRect(x + 22, y + 90, 120, 6)
    ctx.fillRect(x + 22, y + 106, 150, 6)
  }
  // footer bar
  ctx.fillStyle = 'rgba(96,165,250,0.25)'
  ctx.fillRect(48, top + 404, 928, 8)
  ctx.fillRect(48, top + 426, 560, 6)
  // the gold CURSOR — the hand placing the next block
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(636, top + 242, 3, 18)
  ctx.fillRect(636, top + 260, 12, 3)
  return toTexture(c)
}

/** Icon faces for the node cards — the vocabulary of automation.
 * One card face: dark panel, blue frame, an icon glyph, label bars.
 * Pure geometry (no text) — deterministic across every machine. */
function drawNodeIcon(kind: 'bolt' | 'invoice' | 'table' | 'chat' | 'envelope' | 'doc' | 'chart' | 'code'): THREE.CanvasTexture {
  const W = 288
  const H = 176
  const { c, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#0d1526'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(96,165,250,0.4)'
  ctx.lineWidth = 4
  rr(ctx, 6, 6, W - 12, H - 12, 14)
  ctx.stroke()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const icon = (draw: () => void) => {
    ctx.save()
    ctx.translate(20, 28)
    draw()
    ctx.restore()
  }
  switch (kind) {
    case 'bolt':
      icon(() => {
        ctx.fillStyle = '#fbbc05'
        ctx.beginPath()
        ctx.moveTo(62, 0)
        ctx.lineTo(32, 68)
        ctx.lineTo(50, 68)
        ctx.lineTo(40, 120)
        ctx.lineTo(74, 50)
        ctx.lineTo(54, 50)
        ctx.lineTo(70, 0)
        ctx.closePath()
        ctx.fill()
      })
      break
    case 'invoice':
      icon(() => {
        ctx.strokeStyle = '#c3cbd6'
        ctx.lineWidth = 6
        rr(ctx, 14, 6, 72, 108, 8)
        ctx.stroke()
        ctx.fillStyle = '#fbbc05'
        ctx.fillRect(26, 28, 48, 8)
        ctx.fillStyle = 'rgba(195,203,214,0.8)'
        ctx.fillRect(26, 48, 36, 6)
        ctx.fillRect(26, 64, 44, 6)
        ctx.fillStyle = '#34a853'
        ctx.fillRect(26, 92, 48, 10)
      })
      break
    case 'table':
      icon(() => {
        ctx.fillStyle = 'rgba(52,168,83,0.35)'
        rr(ctx, 10, 10, 80, 22, 6)
        ctx.fill()
        ctx.strokeStyle = '#34a853'
        ctx.lineWidth = 4
        rr(ctx, 10, 10, 80, 22, 6)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(195,203,214,0.75)'
        ctx.lineWidth = 4
        for (const y of [60, 84, 108]) {
          ctx.beginPath()
          ctx.moveTo(12, y)
          ctx.lineTo(90, y)
          ctx.stroke()
        }
        for (const x of [39, 66]) {
          ctx.beginPath()
          ctx.moveTo(x, 36)
          ctx.lineTo(x, 114)
          ctx.stroke()
        }
      })
      break
    case 'chat':
      icon(() => {
        ctx.strokeStyle = '#34a853'
        ctx.lineWidth = 6
        rr(ctx, 8, 8, 86, 62, 16)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(28, 68)
        ctx.lineTo(28, 90)
        ctx.lineTo(48, 68)
        ctx.stroke()
        ctx.fillStyle = '#fbbc05'
        for (const dx of [0, 28, 56]) {
          ctx.beginPath()
          ctx.arc(32 + dx, 39, 7, 0, Math.PI * 2)
          ctx.fill()
        }
      })
      break
    case 'envelope':
      icon(() => {
        ctx.strokeStyle = '#c3cbd6'
        ctx.lineWidth = 6
        rr(ctx, 6, 26, 90, 60, 8)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(195,203,214,0.75)'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(10, 32)
        ctx.lineTo(51, 62)
        ctx.lineTo(92, 32)
        ctx.stroke()
      })
      break
    case 'doc':
      icon(() => {
        ctx.strokeStyle = '#c3cbd6'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(22, 4)
        ctx.lineTo(78, 4)
        ctx.lineTo(88, 16)
        ctx.lineTo(88, 114)
        ctx.lineTo(22, 114)
        ctx.closePath()
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(78, 4)
        ctx.lineTo(78, 16)
        ctx.lineTo(88, 16)
        ctx.stroke()
        ctx.fillStyle = '#34a853'
        ctx.fillRect(34, 34, 40, 8)
        ctx.fillStyle = 'rgba(195,203,214,0.8)'
        ctx.fillRect(34, 54, 30, 6)
        ctx.fillRect(34, 70, 38, 6)
        ctx.fillStyle = '#fbbc05'
        ctx.fillRect(34, 92, 32, 8)
      })
      break
    case 'chart':
      icon(() => {
        ctx.fillStyle = 'rgba(52,168,83,0.85)'
        ctx.fillRect(12, 84, 18, 34)
        ctx.fillRect(44, 58, 18, 60)
        ctx.fillRect(76, 32, 18, 86)
        ctx.strokeStyle = '#fbbc05'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(10, 44)
        ctx.lineTo(88, 12)
        ctx.stroke()
        ctx.fillStyle = '#fbbc05'
        ctx.beginPath()
        ctx.moveTo(88, 12)
        ctx.lineTo(72, 14)
        ctx.lineTo(86, 26)
        ctx.closePath()
        ctx.fill()
      })
      break
    case 'code':
      icon(() => {
        ctx.strokeStyle = '#fbbc05'
        ctx.lineWidth = 7
        ctx.beginPath()
        ctx.moveTo(44, 32)
        ctx.lineTo(18, 59)
        ctx.lineTo(44, 86)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(84, 32)
        ctx.lineTo(110, 59)
        ctx.lineTo(84, 86)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(195,203,214,0.85)'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(64, 22)
        ctx.lineTo(52, 96)
        ctx.stroke()
      })
      break
  }
  // label bars (the node's name, as wires)
  ctx.fillStyle = '#34a853'
  ctx.fillRect(150, 66, 92, 12)
  ctx.fillStyle = 'rgba(195,203,214,0.7)'
  ctx.fillRect(150, 90, 64, 8)
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(150, 110, 76, 6)
  return toTexture(c)
}

/** The n8n EDITOR CANVAS backdrop — dark panel, dot grid (the exact
 * workspace texture every n8n user knows). */
function drawCanvasGrid(): THREE.CanvasTexture {
  const W = 512
  const H = 800
  const { c, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#0c1424'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(96,165,250,0.13)'
  for (let y = 16; y < H; y += 32) {
    for (let x = 16; x < W; x += 32) {
      ctx.beginPath()
      ctx.arc(x, y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return toTexture(c)
}

/** The WORK cards — shipped projects wearing their metrics. Latin
 * digits only (deterministic); the rest is geometry. */
function drawWorkCard(kind: 0 | 1 | 2): THREE.CanvasTexture {
  const W = 512
  const H = 340
  const { c, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#0a1120'
  ctx.fillRect(0, 0, W, H)
  // chrome bar
  ctx.fillStyle = '#182238'
  ctx.fillRect(0, 0, W, 40)
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#ea4335', '#fbbc05', '#34a853'][i] as string
    ctx.beginPath()
    ctx.arc(26 + i * 22, 20, 6, 0, Math.PI * 2)
    ctx.fill()
  }
  const badge = (text: string, x: number, y: number) => {
    ctx.fillStyle = 'rgba(52,168,83,0.9)'
    const w = 34 + text.length * 24
    rr(ctx, x - w, y, w, 46, 14)
    ctx.fill()
    ctx.strokeStyle = '#3ddc70'
    ctx.lineWidth = 3
    rr(ctx, x - w, y, w, 46, 14)
    ctx.stroke()
    ctx.fillStyle = '#eafff2'
    ctx.font = '700 30px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x - w / 2, y + 24)
  }
  if (kind === 0) {
    // storefront: product grid, one live card
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 28 + col * 156
        const y = 72 + row * 116
        const live = row === 0 && col === 1
        ctx.fillStyle = live ? 'rgba(52,168,83,0.22)' : 'rgba(25,38,66,0.95)'
        rr(ctx, x, y, 136, 96, 12)
        ctx.fill()
        ctx.strokeStyle = live ? '#3ddc70' : 'rgba(96,165,250,0.55)'
        ctx.lineWidth = live ? 4 : 2.5
        rr(ctx, x, y, 136, 96, 12)
        ctx.stroke()
        ctx.fillStyle = live ? '#3ddc70' : '#6684ad'
        ctx.fillRect(x + 16, y + 62, 84, 10)
        ctx.fillStyle = 'rgba(234,179,8,0.9)'
        ctx.fillRect(x + 16, y + 80, 48, 6)
      }
    }
    badge('+140%', W - 24, 58)
    // rising conversion bars
    ctx.fillStyle = 'rgba(52,168,83,0.85)'
    for (let i = 0; i < 4; i++) ctx.fillRect(28 + i * 20, 296 - i * 12, 12, 12 + i * 12)
  } else if (kind === 1) {
    // dashboard: sidebar + ascending bars + trend
    ctx.fillStyle = '#0d1628'
    rr(ctx, 20, 60, 96, 260, 14)
    ctx.fill()
    ctx.strokeStyle = 'rgba(96,165,250,0.5)'
    ctx.lineWidth = 2.5
    rr(ctx, 20, 60, 96, 260, 14)
    ctx.stroke()
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i === 0 ? '#34a853' : '#31405f'
      rr(ctx, 36, 84 + i * 40, 64, 20, 8)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(52,168,83,0.85)'
    for (let i = 0; i < 6; i++) ctx.fillRect(140 + i * 34, 300 - (18 + i * 22), 22, 18 + i * 22)
    ctx.strokeStyle = '#fbbc05'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(146, 236)
    ctx.lineTo(338, 132)
    ctx.stroke()
    badge('3.2x', W - 24, 58)
  } else {
    // landing: hero block + CTA + arrow
    ctx.fillStyle = 'rgba(52,168,83,0.14)'
    rr(ctx, 28, 66, 300, 130, 14)
    ctx.fill()
    ctx.strokeStyle = '#34a853'
    ctx.lineWidth = 3
    rr(ctx, 28, 66, 300, 130, 14)
    ctx.stroke()
    ctx.fillStyle = '#34a853'
    ctx.fillRect(52, 96, 200, 16)
    ctx.fillStyle = 'rgba(234,179,8,0.9)'
    ctx.fillRect(52, 126, 120, 7)
    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 3
    rr(ctx, 52, 152, 110, 28, 14)
    ctx.stroke()
    // side stat chips
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = 'rgba(25,38,66,0.95)'
      rr(ctx, 348, 78 + i * 70, 136, 56, 12)
      ctx.fill()
      ctx.strokeStyle = 'rgba(96,165,250,0.55)'
      ctx.lineWidth = 2.5
      rr(ctx, 348, 78 + i * 70, 136, 56, 12)
      ctx.stroke()
      ctx.fillStyle = '#6684ad'
      ctx.fillRect(366, 96 + i * 70, 88, 9)
      ctx.fillStyle = '#3ddc70'
      ctx.fillRect(366, 112 + i * 70, 56, 7)
    }
    badge('+92%', W - 24, 240)
  }
  return toTexture(c)
}

/** The obsession tile — fine gold micro-traces under the lens. */
function drawMicroTraces(): THREE.CanvasTexture {
  const W = 512
  const H = 448
  const { c, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#123524'
  ctx.fillRect(0, 0, W, H)
  // darker margin frame
  ctx.strokeStyle = '#0d2417'
  ctx.lineWidth = 18
  ctx.strokeRect(0, 0, W, H)
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#c9a227'
  // deterministic meander buses
  for (let b = 0; b < 8; b++) {
    const x = 44 + b * 58
    const jog = 40 + (b % 3) * 52
    ctx.lineWidth = b % 3 === 1 ? 5 : 3.5
    ctx.beginPath()
    ctx.moveTo(x, 24)
    ctx.lineTo(x, jog)
    ctx.lineTo(x + (b % 2 === 0 ? 26 : -26), jog + 22)
    ctx.lineTo(x + (b % 2 === 0 ? 26 : -26), jog + 96)
    ctx.lineTo(x, jog + 118)
    ctx.lineTo(x, H - 24)
    ctx.stroke()
    // via pads at both ends
    ctx.fillStyle = '#e3c65b'
    for (const y of [24, H - 24]) {
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // central chip + pins
  ctx.fillStyle = '#10151f'
  rr(ctx, 186, 164, 140, 116, 10)
  ctx.fill()
  ctx.strokeStyle = '#c3cbd6'
  ctx.lineWidth = 4
  rr(ctx, 186, 164, 140, 116, 10)
  ctx.stroke()
  ctx.fillStyle = '#c3cbd6'
  ctx.fillRect(212, 146, 88, 12)
  ctx.fillRect(212, 286, 88, 12)
  // pin-1 gold corner + two status dots
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(176, 154, 14, 14)
  ctx.beginPath()
  ctx.arc(348, 92, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#34a853'
  ctx.beginPath()
  ctx.arc(166, 372, 8, 0, Math.PI * 2)
  ctx.fill()
  return toTexture(c)
}

/* Face materials (cache-owned; emissive-map driven so they read as
 * LIT displays — the "born on" light of the canvas). */
const texCache = /* lazy */ {
  browser: null as THREE.CanvasTexture | null,
  browserCompact: null as THREE.CanvasTexture | null,
  grid: null as THREE.CanvasTexture | null,
  micro: null as THREE.CanvasTexture | null,
  icons: {} as Partial<Record<string, THREE.CanvasTexture>>,
  work: {} as Partial<Record<string, THREE.CanvasTexture>>,
}

function faceMaterial(tex: THREE.CanvasTexture, emissive = 1.35): THREE.MeshStandardMaterial {
  return std('#0a1120', 0.05, 0.32, { map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: emissive })
}

function browserFace(compact: boolean): THREE.MeshStandardMaterial {
  if (compact) {
    if (!texCache.browserCompact) texCache.browserCompact = drawBrowserWireframe(true)
    return faceMaterial(texCache.browserCompact)
  }
  if (!texCache.browser) texCache.browser = drawBrowserWireframe(false)
  return faceMaterial(texCache.browser)
}

function iconFace(kind: 'bolt' | 'invoice' | 'table' | 'chat' | 'envelope' | 'doc' | 'chart' | 'code'): THREE.MeshStandardMaterial {
  if (!texCache.icons[kind]) texCache.icons[kind] = drawNodeIcon(kind)
  return faceMaterial(texCache.icons[kind] as THREE.CanvasTexture, 1.5)
}

function gridFace(): THREE.MeshStandardMaterial {
  if (!texCache.grid) texCache.grid = drawCanvasGrid()
  return faceMaterial(texCache.grid, 0.55)
}

function workFace(kind: 0 | 1 | 2): THREE.MeshStandardMaterial {
  if (!texCache.work[kind]) texCache.work[kind] = drawWorkCard(kind)
  return faceMaterial(texCache.work[kind] as THREE.CanvasTexture, 1.4)
}

function microFace(): THREE.MeshStandardMaterial {
  if (!texCache.micro) texCache.micro = drawMicroTraces()
  return faceMaterial(texCache.micro, 0.9)
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

/** A soft additive halo around a glow point (no postprocessing in the
 * scene; a static material stays freeze-contract-pure). */
function halo(radius: number, opacity = 0.3): THREE.Mesh {
  return mesh(
    new THREE.SphereGeometry(radius, 14, 12),
    new THREE.MeshBasicMaterial({
      color: BRAND_COLORS.gGreen, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  )
}

/** A strut (thin cylinder) from point a to point b — rails, links,
 * legs. Aligned by quaternion; deterministic. */
function strut(a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
  const dir = b.clone().sub(a)
  const len = Math.max(dir.length(), 1e-4)
  const geo = new THREE.CylinderGeometry(radius, radius, len, 8)
  const m = new THREE.Mesh(geo, mat)
  m.position.copy(a).addScaledVector(dir, 0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  return m
}

/** A FLOW LINK with a traveling PULSE — the automation vocabulary.
 * The gold strut wires a→b; an (unnamed) frame group at a is rotated
 * along the link direction and carries the NAMED pulse node as a
 * child. The drive slides the pulse's position.x — inside the rotated
 * frame — so the glow travels the link's own direction (a rotated
 * group's POSITION would move on the parent's axes; the child's does
 * not). Registry drives mirror the exact `len` values. */
function flowLink(
  g: THREE.Group,
  ax: number, ay: number, bx: number, by: number,
  pulseName: string, _len: number,
): void {
  g.add(strut(new THREE.Vector3(ax, ay, 0), new THREE.Vector3(bx, by, 0), 0.007, M.gold))
  const frame = new THREE.Group()
  frame.position.set(ax, ay, 0.012)
  frame.rotation.z = Math.atan2(by - ay, bx - ax)
  const pulse = node(pulseName, 0, 0, 0)
  pulse.add(mesh(new THREE.SphereGeometry(0.02, 12, 10), M.signal))
  pulse.add(halo(0.036, 0.26))
  frame.add(pulse)
  g.add(frame)
}

/** A node CARD — the n8n building block: rounded slab, icon face,
 * title strip, top/bottom ports, a status LED. */
function nodeCard(
  name: string, x: number, y: number,
  icon: 'bolt' | 'invoice' | 'table' | 'chat' | 'envelope' | 'doc' | 'chart' | 'code',
  strip: 'gold' | 'green',
): THREE.Group {
  const card = node(name, x, y, 0.035)
  const W = 0.26
  const H = 0.18
  card.add(mesh(new RoundedBoxGeometry(W, H, 0.05, 2, 0.016), M.panel))
  // title strip (n8n's colored node header)
  card.add(mesh(new RoundedBoxGeometry(W, 0.03, 0.052, 1, 0.008), strip === 'gold' ? M.ledGold : M.ledGreen, 0, H / 2 - 0.015, 0))
  // icon face
  card.add(mesh(new THREE.PlaneGeometry(0.22, 0.135), iconFace(icon), 0, -0.008, 0.0262))
  // ports — top + bottom (vertical flow)
  const portGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.045, 10)
  card.add(mesh(portGeo, M.gold, 0, H / 2 + 0.012, 0))
  card.add(mesh(portGeo, M.gold, 0, -H / 2 - 0.012, 0))
  // status LED at a corner
  card.add(led(strip === 'gold' ? M.ledGold : M.ledGreen, W / 2 - 0.03, -H / 2 + 0.025, 0.026))
  return card
}

/** A mini browser window — the "website" glyph. */
function browserWindow(w: number, h: number): THREE.Group {
  const b = new THREE.Group()
  b.add(mesh(new RoundedBoxGeometry(w, h, 0.05, 2, 0.022), M.enclosure))
  // chrome bar + traffic dots + URL pill
  const chromeH = 0.09
  b.add(mesh(new RoundedBoxGeometry(w, chromeH, 0.056, 2, 0.018), M.panel, 0, h / 2 - chromeH / 2, 0.001))
  const dotGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.012, 10)
  const mats: THREE.Material[] = [M.ledRed, M.ledGold, M.ledGreen]
  for (let i = 0; i < 3; i++) {
    const d = mesh(dotGeo, mats[i] as THREE.Material, -w / 2 + 0.05 + i * 0.032, h / 2 - chromeH / 2, 0.029)
    d.rotation.x = Math.PI / 2
    b.add(d)
  }
  b.add(mesh(new RoundedBoxGeometry(w * 0.5, 0.036, 0.058, 1, 0.016), M.ink, w * 0.08, h / 2 - chromeH / 2, 0.001))
  // screen — the compact wireframe (the 3D chrome replaces the strip)
  const sw = w - 0.09
  const sh = h - chromeH - 0.06
  b.add(mesh(new THREE.PlaneGeometry(sw, sh), browserFace(true), 0, -chromeH / 2 - 0.015, 0.0262))
  return b
}

/* ------------------------------------------------------------------ *
 * KIT 1 · siteFlow — home hero
 * ------------------------------------------------------------------ */

function buildSiteFlow(): THREE.Group {
  const g = node('siteFlow')
  // THE BROWSER — the beautiful sites Elyra builds
  const browser = browserWindow(0.78, 0.54)
  browser.position.set(0, 0.50, 0)
  g.add(browser)
  // browser's output port (bottom center)
  const outPort = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 10), M.gold, 0, 0.205, 0.005)
  g.add(outPort)

  // THE AUTOMATION PIPELINE — three nodes flowing downward
  // (envelope → invoice → report): «أنظمة أتمتة ذكية»
  g.add(nodeCard('node_envelope', 0.06, 0.02, 'envelope', 'green'))
  g.add(nodeCard('node_invoice', -0.06, -0.24, 'invoice', 'gold'))
  g.add(nodeCard('node_chart', 0.06, -0.50, 'chart', 'green'))

  // gold links + traveling pulses (registry mirrors these lengths)
  flowLink(g, 0, 0.20, 0.06, 0.122, 'pulse_a', 0.098)
  flowLink(g, 0.06, -0.082, -0.06, -0.138, 'pulse_b', 0.132)
  flowLink(g, -0.06, -0.342, 0.06, -0.398, 'pulse_c', 0.132)
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 2 · journeyRail — home method
 * ------------------------------------------------------------------ */

function buildJourneyRail(): THREE.Group {
  const g = node('journeyRail')
  // the ascending rail: right-low (the idea) → left-high (the launch)
  const sx = 0.44
  const sy = -0.24
  const ex = -0.44
  const ey = 0.30
  const dx = ex - sx
  const dy = ey - sy
  const len = Math.hypot(dx, dy) // 1.031
  const angle = Math.atan2(dy, dx) // ≈ 2.591 rad
  const ux = dx / len
  const uy = dy / len

  const railTrack = node('railTrack', sx, sy, 0)
  railTrack.rotation.z = angle
  // the rail tube lies along the frame's local x
  const rail = mesh(new THREE.CylinderGeometry(0.013, 0.013, len, 12), M.silver, len / 2, 0, 0)
  rail.rotation.z = Math.PI / 2
  railTrack.add(rail)
  // gold end caps — idea and launch
  railTrack.add(mesh(new THREE.SphereGeometry(0.024, 12, 10), M.gold, 0, 0, 0))
  railTrack.add(mesh(new THREE.SphereGeometry(0.024, 12, 10), M.gold, len, 0, 0))

  // THE TRAVELER — the project itself, riding the rail on your scroll
  const traveler = node('traveler', 0.05, 0, 0.016)
  traveler.add(mesh(new THREE.SphereGeometry(0.03, 14, 12), M.signal))
  traveler.add(halo(0.052, 0.3))
  railTrack.add(traveler)
  g.add(railTrack)

  // FOUR STATIONS — discover · design · build · launch
  const fracs = [0.07, 0.36, 0.65, 0.94]
  const emblemPos: Array<[number, number]> = []
  for (let i = 0; i < 4; i++) {
    const f = fracs[i] as number
    const px = sx + ux * f * len
    const py = sy + uy * f * len
    emblemPos.push([px, py])
    // station ring — the DRIVE node (spinning stud makes it visible)
    const ring = node(`ring_${i + 1}`, px, py, 0.01)
    ring.add(mesh(new THREE.TorusGeometry(0.052, 0.009, 10, 26), M.gold))
    ring.add(mesh(new THREE.BoxGeometry(0.02, 0.011, 0.013), M.silver, 0.052, 0, 0.009))
    g.add(ring)
  }

  // EMBLEMS — each step's craft, standing upright above its station
  const emblemAt = (i: number): [number, number, number] => {
    const p = emblemPos[i] as [number, number]
    return [p[0], p[1] + 0.135, 0.03]
  }
  {
    // 1 · الاكتشاف — the magnifier
    const [ex, ey] = emblemAt(0)
    const m = node('emblem_discover', ex, ey, 0.03)
    m.add(mesh(new THREE.TorusGeometry(0.04, 0.009, 10, 24), M.silver))
    const handle = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), M.gold, 0.05, -0.05, 0)
    handle.rotation.z = Math.PI / 4
    m.add(handle)
    g.add(m)
  }
  {
    // 2 · التصميم — the pen
    const [ex, ey] = emblemAt(1)
    const p = node('emblem_design', ex, ey, 0.03)
    p.add(mesh(new THREE.BoxGeometry(0.018, 0.11, 0.018), M.silver))
    const tip = mesh(new THREE.ConeGeometry(0.013, 0.035, 10), M.gold, 0, -0.072, 0)
    tip.rotation.x = Math.PI
    p.add(tip)
    p.add(mesh(new THREE.BoxGeometry(0.022, 0.014, 0.022), M.gold, 0, 0.062, 0))
    g.add(p)
  }
  {
    // 3 · البناء — the code plate
    const [ex, ey] = emblemAt(2)
    const cp = node('emblem_build', ex, ey, 0.03)
    cp.add(mesh(new RoundedBoxGeometry(0.11, 0.075, 0.014, 2, 0.008), M.panel))
    cp.add(mesh(new THREE.PlaneGeometry(0.1, 0.066), iconFace('code'), 0, 0, 0.0085))
    g.add(cp)
  }
  {
    // 4 · الإطلاق — the rocket
    const [ex, ey] = emblemAt(3)
    const r = node('emblem_launch', ex, ey, 0.03)
    r.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.075, 12), M.enclosure))
    const nose = mesh(new THREE.ConeGeometry(0.028, 0.075, 12), M.silver, 0, 0.075, 0)
    r.add(nose)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const fin = mesh(new THREE.BoxGeometry(0.01, 0.04, 0.022), M.gold, Math.cos(a) * 0.032, -0.02, Math.sin(a) * 0.032)
      fin.rotation.y = -a
      r.add(fin)
    }
    const flame = mesh(new THREE.ConeGeometry(0.018, 0.05, 10), M.signal, 0, -0.062, 0)
    flame.rotation.x = Math.PI
    r.add(flame)
    g.add(r)
  }
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 3 · laptopStudio — websites hero (v2: the assembling page)
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

  // hinge — a full-width gold bar at the pivot
  const hingeBar = mesh(new THREE.CylinderGeometry(0.02, 0.02, baseW - 0.06, 12), M.gold, 0, 0.034, -baseD / 2 + 0.01)
  hingeBar.rotation.z = Math.PI / 2
  g.add(hingeBar)

  // LID — the drive node. Pivot at the back edge; built CLOSED (flat
  // on the deck, screen facing down like a real laptop) so the open
  // rest pose is a single negative rotation around x. ALL lid panels
  // are FLAT in the lid's own frame: x = width, y = thickness, z =
  // length (pivot → front edge). Local anatomy: +z runs from the hinge
  // toward the deck's front edge (the drawing's "up" for the open
  // viewer); −y is the screen's face — the side the visitor sees.
  const lid = node('lid', 0, 0.034, -baseD / 2 + 0.01)
  lid.rotation.x = -1.75
  // shell (spans y 0.014..0.038 — outer back is +y, the closed top)
  lid.add(mesh(new RoundedBoxGeometry(baseW, 0.024, 0.7, 2, 0.012), M.silver, 0, 0.026, 0.352))
  // bezel plate on the inner face (visible from −y)
  lid.add(mesh(new RoundedBoxGeometry(0.98, 0.005, 0.66, 2, 0.006), M.ink, 0, 0.0125, 0.352))
  // screen (normal = local −y: faces the deck closed, the visitor open)
  const screen = mesh(new THREE.PlaneGeometry(0.94, 0.6), browserFace(false), 0, 0.0098, 0.352)
  screen.rotation.x = Math.PI / 2
  lid.add(screen)
  // webcam — top bezel (far edge: stands highest when open)
  const cam = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 10), M.ink, 0, 0.009, 0.646)
  cam.rotation.x = Math.PI / 2
  lid.add(cam)
  // rear logo — the gold maker's mark on the outer back (+y face)
  lid.add(mesh(new RoundedBoxGeometry(0.1, 0.004, 0.1, 1, 0.02), M.gold, 0, 0.039, 0.352))

  // THE ASSEMBLING PAGE — UI blocks floating on the −y side (toward
  // the open viewer), settling onto the wireframe as the section
  // travels: «مواقع تُبنى». Local y is negative = in front of the
  // screen; slide drives move them toward the surface (y → ~ −0.02).
  const blockNav = node('block_nav', -0.16, -0.11, 0.55)
  blockNav.add(mesh(new RoundedBoxGeometry(0.34, 0.014, 0.05, 1, 0.006), M.panel))
  blockNav.add(mesh(new RoundedBoxGeometry(0.07, 0.018, 0.024, 1, 0.008), M.gold, 0.1, 0, 0))
  lid.add(blockNav)

  const blockHero = node('block_hero', 0.14, -0.14, 0.40)
  blockHero.add(mesh(new RoundedBoxGeometry(0.3, 0.016, 0.16, 2, 0.008), M.panel))
  blockHero.add(mesh(new RoundedBoxGeometry(0.24, 0.008, 0.11, 1, 0.005), M.ledGreen, 0, -0.011, 0))
  lid.add(blockHero)

  const blockCta = node('block_cta', -0.10, -0.12, 0.27)
  blockCta.add(mesh(new RoundedBoxGeometry(0.13, 0.012, 0.045, 1, 0.005), M.gold))
  lid.add(blockCta)

  g.add(lid)
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 4 · nodeFlow — automation hero (THE n8n canvas)
 * ------------------------------------------------------------------ */

function buildNodeFlow(): THREE.Group {
  const g = node('nodeFlow')
  // the editor canvas — a dark dot-grid panel (the n8n workspace)
  g.add(mesh(new RoundedBoxGeometry(0.64, 1.06, 0.02, 2, 0.014), M.ink))
  g.add(mesh(new THREE.PlaneGeometry(0.58, 1.0), gridFace(), 0, 0, 0.0115))

  // THE WORKFLOW — trigger → invoice → sheet → chat:
  // «فواتير تُصدر نفسها، تنبيهات تصل لحظيًا»
  g.add(nodeCard('node_bolt', 0.09, 0.36, 'bolt', 'green'))
  g.add(nodeCard('node_invoice', -0.09, 0.12, 'invoice', 'gold'))
  g.add(nodeCard('node_table', 0.09, -0.12, 'table', 'green'))
  g.add(nodeCard('node_chat', -0.09, -0.36, 'chat', 'gold'))

  // gold links + the three pulses that RUN the workflow on scroll
  // (registry mirrors these lengths exactly)
  flowLink(g, 0.09, 0.258, -0.09, 0.222, 'pulse_a', 0.184)
  flowLink(g, -0.09, 0.018, 0.09, -0.018, 'pulse_b', 0.184)
  flowLink(g, 0.09, -0.222, -0.09, -0.258, 'pulse_c', 0.184)
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 5 · workDeck — work hero
 * ------------------------------------------------------------------ */

/** A shipped-project browser card — slab, chrome, live screen. */
function workCard(name: string, w: number, h: number, kind: 0 | 1 | 2): THREE.Group {
  const card = node(name)
  card.add(mesh(new RoundedBoxGeometry(w, h, 0.045, 2, 0.018), M.panel))
  // chrome strip + traffic dots
  card.add(mesh(new RoundedBoxGeometry(w, 0.05, 0.05, 1, 0.012), M.ink, 0, h / 2 - 0.025, 0.001))
  const dotGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.01, 8)
  const mats: THREE.Material[] = [M.ledRed, M.ledGold, M.ledGreen]
  for (let i = 0; i < 3; i++) {
    const d = mesh(dotGeo, mats[i] as THREE.Material, -w / 2 + 0.035 + i * 0.024, h / 2 - 0.025, 0.026)
    d.rotation.x = Math.PI / 2
    card.add(d)
  }
  // the live screen — the shipped work wearing its metric
  const sw = w - 0.06
  const sh = h - 0.09
  card.add(mesh(new THREE.PlaneGeometry(sw, sh), workFace(kind), 0, -0.03, 0.0235))
  return card
}

function buildWorkDeck(): THREE.Group {
  const g = node('workDeck')
  // THE CASCADE — three shipped projects at staggered depths
  const a = workCard('card_a', 0.54, 0.36, 0)
  a.position.set(0.08, 0.11, 0.12)
  const b = workCard('card_b', 0.47, 0.32, 1)
  b.position.set(-0.17, -0.03, 0.0)
  const c = workCard('card_c', 0.41, 0.28, 2)
  c.position.set(0.13, -0.18, -0.13)
  // authored rest tilt — the deck's fanned pose (drives straighten it)
  a.rotation.z = 0.09
  c.rotation.z = -0.09
  g.add(a, b, c)
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 6 · obsessionLens — about hero
 * ------------------------------------------------------------------ */

function buildObsessionLens(): THREE.Group {
  const g = node('obsessionLens')
  // THE TILE — a small fine-traced circuit (the detail under exam)
  g.add(mesh(new RoundedBoxGeometry(0.4, 0.035, 0.34, 2, 0.012), M.pcb, -0.05, -0.30, 0))
  const tileFace = mesh(new THREE.PlaneGeometry(0.36, 0.3), microFace(), -0.05, -0.2825, 0)
  tileFace.rotation.x = -Math.PI / 2
  g.add(tileFace)
  // tiny through-hole components standing on the tile
  for (const [cx, cz, mat] of [
    [-0.18, 0.09, M.silver],
    [0.07, -0.10, M.gold],
    [0.05, 0.11, M.silver],
    [-0.13, -0.07, M.gold],
  ] as Array<[number, number, THREE.Material]>) {
    g.add(mesh(new THREE.BoxGeometry(0.045, 0.035, 0.045), mat, cx, -0.2675, cz))
  }

  // THE LENS — the studio's oversized obsession, sweeping the tile
  const lensG = node('lensG', 0.02, 0.07, 0.05)
  lensG.add(mesh(new THREE.TorusGeometry(0.21, 0.024, 14, 40), M.gold))
  lensG.add(mesh(new THREE.CircleGeometry(0.19, 36), M.glass))
  // handle — down-right at the classic magnifier angle
  const handle = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.38, 12), M.gold, 0.27, -0.27, 0)
  handle.rotation.z = Math.PI / 4
  lensG.add(handle)
  lensG.add(mesh(new THREE.SphereGeometry(0.032, 12, 10), M.gold, 0.40, -0.40, 0))
  // the focal glow — rides with the lens, lighting what it examines
  lensG.add(mesh(new THREE.SphereGeometry(0.02, 12, 10), M.signal, 0, -0.355, -0.02))
  lensG.add(halo(0.038, 0.24).translateY(-0.355).translateZ(-0.02))
  g.add(lensG)
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 7 · chatSignal — contact hero
 * ------------------------------------------------------------------ */

function buildChatSignal(): THREE.Group {
  const g = node('chatSignal')
  // THE BUBBLE — the conversation, already open
  const bubbleG = node('bubbleG', 0, 0.03, 0)
  bubbleG.add(mesh(new RoundedBoxGeometry(0.6, 0.42, 0.13, 4, 0.065), M.enclosure))
  bubbleG.add(mesh(new RoundedBoxGeometry(0.52, 0.34, 0.01, 2, 0.012), M.ink, 0, 0, 0.062))
  // the tail (bottom-right — the side the reply comes from in RTL)
  const tail = mesh(new RoundedBoxGeometry(0.14, 0.12, 0.1, 2, 0.03), M.enclosure, 0.17, -0.245, 0)
  tail.rotation.z = 0.35
  bubbleG.add(tail)
  // corner status LEDs
  bubbleG.add(led(M.ledGreen, 0.21, 0.16, 0.068))
  bubbleG.add(led(M.ledGold, -0.21, 0.16, 0.068))

  // THE TYPING DOTS — each a named group whose emissive sphere sits
  // OFFSET from the pivot; the swing drive rotates the group around x,
  // so the dot bobs up and down on the scroll's own oscillation —
  // three different frequencies = the organic rhythm of typing.
  const dotXs = [-0.14, 0, 0.14]
  const dotNames = ['dot_a', 'dot_b', 'dot_c']
  for (let i = 0; i < 3; i++) {
    const d = node(dotNames[i] as string, dotXs[i], 0.01, 0.075)
    d.add(mesh(new THREE.SphereGeometry(0.032, 14, 12), M.signal, 0, 0.05, 0))
    bubbleG.add(d)
  }
  g.add(bubbleG)
  return g
}

/* ------------------------------------------------------------------ *
 * KIT 8 · dataStack — about story (kept from MODEL-3)
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

/* ------------------------------------------------------------------ *
 * Registry + cache (module-lifetime; the scene clones per mount)
 * ------------------------------------------------------------------ */

const KIT_BUILDERS: Record<string, () => THREE.Group> = {
  siteFlow: buildSiteFlow,
  journeyRail: buildJourneyRail,
  laptopStudio: buildLaptopStudio,
  nodeFlow: buildNodeFlow,
  workDeck: buildWorkDeck,
  obsessionLens: buildObsessionLens,
  chatSignal: buildChatSignal,
  dataStack: buildDataStack,
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
