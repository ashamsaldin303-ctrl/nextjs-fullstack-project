/**
 * Tech kits (MODEL-4) — the SEMANTIC-MATCH bodies.
 *
 * OWNER'S FOURTH VERDICT (verbatim intent): the technical theme was right,
 * but «لا يوجد أي شيء يدل على أن هذا المجسم ينتمي أو يتحدث عن الفكرة
 * الموضوعة له» — a body sitting in a section must BE the thing that
 * section's own words describe (the server rack in the home hero was tech,
 * yes, but the home hero talks about crafting DIGITAL EXPERIENCES, not
 * machine rooms). And the bodies must «تعيش وتتفاعل مع السكرول ومع
 * المستخدم في كل تحرك» — live and react to scroll AND to the user on
 * every move (see the interactivity layer below).
 *
 * THE MODEL-4 SET — each body is the section's literal subject, built from
 * that section's own copy (messages/ar.json):
 *
 *   · experienceStack — HOME HERO. The copy: «نصنعُ تجاربَ رقميةً تُشبهُ
 *     المستقبل… بناء مواقع فائقة الجمال وتجارب ثلاثية الأبعاد، وأنظمة
 *     أتمتة ذكية بـ n8n». The body IS a digital experience, exploded into
 *     its three offering layers: the browser window (the website), the
 *     gyroscope with an emerald core (the 3D experience), the node ribbon
 *     (the n8n automation) — arriving EXPLODED and assembling into one
 *     stack as the section travels. The site being built, literally.
 *   · pipelineJourney — HOME METHOD. The copy: «رحلة واضحة، من الفكرة إلى
 *     الإطلاق» + four steps (الاكتشاف/التصميم/البناء/الإطلاق). The body
 *     IS the journey: a rail with four gates and a glowing workpiece that
 *     rides the rail as you scroll; each gate's LED ignites exactly as the
 *     workpiece passes it, and the launch beacon lights at the far end.
 *   · siteCanvas — WEBSITES HERO. The copy: «مواقع تُبنى لتبهر». The body
 *     IS a website being BUILT: a floating browser window whose wireframe
 *     blocks (nav, hero, cards, CTA, footer) rise into place in sequence
 *     with the section's travel, the URL bar loading, and a gold on-screen
 *     cursor that FOLLOWS the visitor's real pointer (drive flag
 *     `follow`) — the site assembles under your hand.
 *   · flowGraph — AUTOMATION HERO. The copy: «أنظمة تعمل، وأنت نائم» —
 *     n8n flows that connect tools and do the routine. The body IS the
 *     workflow: five node cards wired in a zigzag, and glowing packets
 *     that hop node-to-node as you scroll (each arrival lighting its
 *     node). Not a machine that automates — the automation itself,
 *     running on your scroll. Nodes also feel the pointer (glow `boost`).
 *   · resultsDeck — WORK HERO. The copy: «نتائج تتحدث بالأرقام» — real
 *     numbers from selected projects. The body IS the results: a
 *     carousel of three project screens around a gold hub that turns
 *     with the section's travel; the front screen is an analytics card
 *     whose bar chart GROWS as you scroll — the numbers, rising.
 *   · explodedDetail — ABOUT HERO. The copy: «وكالة رقمية صغيرة الحجم،
 *     كبيرة الهوس بالتفاصيل». The body IS that sentence: a small compact
 *     module that opens into a vertical exploded view — PCB, vents,
 *     silver plate, gold frame, emerald glass — the obsession revealed
 *     by opening a small thing. Hovering pulls it apart further
 *     (`peek`).
 *   · braidMerge — ABOUT STORY. The copy: «لماذا يضطر الناس للاختيار بين
 *     موقع جميل يعمل ببطء، وموقع سريع يبدو مملًا؟… قررنا ألا نختار» —
 *     the Elyra contract. The body IS the decision: a gold wire (الجمال)
 *     and an emerald wire (الدقة) converging into a collar from which a
 *     two-tone BRAID rises as the story travels — beauty and engineering
 *     woven into one cable, growing with your scroll.
 *   · messageComposer — CONTACT HERO. The copy: «لنبدأ الحديث» — tell us
 *     about your project. The body IS the conversation starting: a
 *     message card whose lines TYPE themselves in (scale-x drives), a
 *     blinking caret (scroll-clocked `blink`), and a send button that
 *     lights and FIRES a glowing packet as the section settles — the
 *     message, composing and sending itself. Header dots = the three
 *     channels below (email/whatsapp/telegram).
 *   · brokenLink — 404. The copy: «وصلت إلى رابط قديم أو غير صحيح — لا
 *     بأس، الطريق للرئيسية قريب». The body IS the broken route: a
 *     browser window showing the 404 page, in front of it a severed
 *     chain link with a hot red spark in the gap — and as you scroll
 *     toward the recovery links, the halves reach for each other, align,
 *     and the spark settles emerald: the road home, repairing itself.
 *
 * INTERACTIVITY LAYER (the owner's second demand, implemented jointly
 * with rune-scene.tsx): every motion stays a PURE function of user input
 * — (section rect, D, S, pointer) — zero wall-clock, zero randomness:
 *   · SCROLL drives each body's signature (assemblies, packets, typing,
 *     growth) — reversible, frame-identical up and down.
 *   · POINTER moves drive: the camera micro-parallax (existing), plus
 *     NEW per-slot springs — each body leans toward the pointer and
 *     lifts/hovers when the pointer is near it (proximity), exploded
 *     bodies open further (`peek` drives), graph nodes glow brighter
 *     (`boost`), and the siteCanvas cursor mirrors the visitor's hand
 *     (`follow`). Every pointer move pokes the invalidate bus, so the
 *     bodies answer EVERY move — and when all input stops, the demand
 *     frame loop parks at zero frames (the standing owner contract).
 *
 * Build contract (unchanged from MODEL-3): kits are authored procedural
 * geometry with named part nodes, module-cached (buildTechKit), rendered
 * with the studio PBR environment; materials are MeshStandardMaterial so
 * presence fades / env composition apply identically. Brand-critical
 * emissives are EXACT registry tokens (gGreen / gYellow / gBlue /
 * gBlueLight); structural shades are documented derivations.
 */

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BRAND_COLORS } from '@/lib/brand-colors'
import type { RawInstrument } from './model-loader'

/* ------------------------------------------------------------------ *
 * Palette — structural shades derived from the brand registry.
 * ------------------------------------------------------------------ */

/** gunmetal slate — BRAND_COLORS.dark #0F172A lifted one step. */
const ENCLOSURE = '#242e40'
/** faceplate — dark lifted two steps (front panels, cards). */
const PANEL = '#37415a'
/** near-black insets — between dark #0F172A and deep #08080A. */
const INK = '#10151f'
/** brushed aluminum. */
const SILVER = '#c3cbd6'
/** message text lines — slate lifted (reads as UI text on dark cards). */
const LINE = '#8fa1c0'
/** metal gold — gYellow #FBBC05 muted toward metal for rails/frames. */
const GOLD = '#c9a227'
/** substrate green — gGreen #34A853 darkened (PCB plates). */
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
  /** message/UI text lines — light slate, slightly self-lit so they read
   *  on the dark card at any wash. */
  line: std(LINE, 0.25, 0.5, { emissive: LINE, emissiveIntensity: 0.35 }),
  /** activity LED — exact gGreen token. */
  ledGreen: std('#062e19', 0.1, 0.4, {
    emissive: BRAND_COLORS.gGreen, emissiveIntensity: 2.4,
  }),
  /** status LED — exact gYellow token. */
  ledGold: std('#2d2405', 0.1, 0.4, {
    emissive: BRAND_COLORS.gYellow, emissiveIntensity: 1.9,
  }),
  /** channel LED — exact gBlue token (telegram dot, graph glyphs). */
  ledBlue: std('#0a1a33', 0.1, 0.4, {
    emissive: BRAND_COLORS.gBlue, emissiveIntensity: 1.8,
  }),
  /** traffic-red — browser window controls (universal UI signifier). */
  ledRed: std('#330d0d', 0.1, 0.4, {
    emissive: '#ea4335', emissiveIntensity: 1.6,
  }),
  /** the signal / workpiece / packet glow — exact gGreen, hotter. */
  signal: std('#062e19', 0.1, 0.4, {
    emissive: BRAND_COLORS.gGreen, emissiveIntensity: 4.6,
  }),
  /** emerald core glass — the 3D-experience heart (translucent). */
  coreGlass: std('#0f3d2c', 0.2, 0.25, {
    emissive: BRAND_COLORS.gGreen, emissiveIntensity: 1.1,
    transparent: true, opacity: 0.85,
  }),
  /** braid strand — gold (الجمال), self-lit to read on light bands. */
  strandGold: std(GOLD, 0.9, 0.3, { emissive: '#8a6d15', emissiveIntensity: 0.55 }),
  /** braid strand — emerald (الدقة), self-lit likewise. */
  strandGreen: std('#2f8f57', 0.65, 0.35, { emissive: '#1d5c39', emissiveIntensity: 0.55 }),
}

/* ------------------------------------------------------------------ *
 * Screen wireframes — deterministic CanvasTexture drawings (identical
 * pixels every build; zero randomness).
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

/** The BROWSER screen (experienceStack's top layer — the website layer
 *  of the digital experience): a homepage wireframe. */
function drawBrowserWireframe(): THREE.CanvasTexture {
  const W = 1024
  const H = 640
  const { c, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#0a1120'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#182238'
  ctx.fillRect(0, 0, W, 64)
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#ea4335', '#fbbc05', '#34a853'][i] as string
    ctx.beginPath()
    ctx.arc(34 + i * 26, 32, 7, 0, Math.PI * 2)
    ctx.fill()
  }
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
  ctx.fillStyle = 'rgba(96,165,250,0.10)'
  for (let y = 96; y < H; y += 44) {
    for (let x = 40; x < W - 30; x += 44) ctx.fillRect(x, y, 2, 2)
  }
  ctx.fillStyle = 'rgba(52,168,83,0.14)'
  rr(ctx, 48, 104, 600, 180, 14)
  ctx.fill()
  ctx.strokeStyle = '#34a853'
  ctx.lineWidth = 3
  rr(ctx, 48, 104, 600, 180, 14)
  ctx.stroke()
  ctx.fillStyle = '#34a853'
  ctx.fillRect(84, 150, 320, 18)
  ctx.fillRect(84, 182, 210, 12)
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(84, 222, 130, 7)
  ctx.strokeStyle = '#60a5fa'
  ctx.lineWidth = 2.5
  rr(ctx, 84, 246, 132, 26, 13)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(96,165,250,0.55)'
  rr(ctx, 676, 104, 300, 180, 10)
  ctx.stroke()
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(96,165,250,0.5)'
    ctx.fillRect(700, 130 + i * 36, 250 - i * 34, 10)
  }
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
  ctx.fillStyle = 'rgba(96,165,250,0.25)'
  ctx.fillRect(48, 508, 928, 8)
  ctx.fillRect(48, 530, 560, 6)
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(636, 346, 3, 18)
  ctx.fillRect(636, 364, 12, 3)
  return toTexture(c)
}

/** The 404 screen (brokenLink): the not-found page — big gold 404, the
 *  dashed ROUTE with the gap where the link broke, and the home dot the
 *  route continues toward. */
function drawNotFoundScreen(): THREE.CanvasTexture {
  const W = 512
  const H = 360
  const { c, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#0a1120'
  ctx.fillRect(0, 0, W, H)
  // chrome strip
  ctx.fillStyle = '#182238'
  ctx.fillRect(0, 0, W, 34)
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#ea4335', '#fbbc05', '#34a853'][i] as string
    ctx.beginPath()
    ctx.arc(20 + i * 18, 17, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  // the 404 itself
  ctx.fillStyle = '#fbbc05'
  ctx.font = '900 128px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('404', W / 2, 158)
  // subline bars
  ctx.fillStyle = '#31405f'
  ctx.fillRect(116, 186, 280, 9)
  ctx.fillRect(156, 206, 200, 7)
  // the ROUTE: dashed line, breaking apart mid-way
  ctx.strokeStyle = '#60a5fa'
  ctx.lineWidth = 4
  ctx.setLineDash([16, 12])
  ctx.beginPath()
  ctx.moveTo(40, 280)
  ctx.lineTo(196, 280)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(316, 280)
  ctx.lineTo(452, 280)
  ctx.stroke()
  ctx.setLineDash([])
  // the break spark marks
  ctx.strokeStyle = '#ea4335'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(208, 268)
  ctx.lineTo(224, 292)
  ctx.moveTo(288, 268)
  ctx.lineTo(304, 292)
  ctx.stroke()
  // the HOME dot the route leads to
  ctx.fillStyle = '#34a853'
  ctx.beginPath()
  ctx.arc(452, 280, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(52,168,83,0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(452, 280, 15, 0, Math.PI * 2)
  ctx.stroke()
  return toTexture(c)
}

/** Mini card screens for resultsDeck's side screens (the portfolio
 *  pieces): a store wireframe and an app wireframe. */
function drawStoreMini(): THREE.CanvasTexture {
  const W = 256
  const H = 176
  const { c, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#0a1120'
  ctx.fillRect(0, 0, W, H)
  // store hero
  ctx.fillStyle = 'rgba(52,168,83,0.2)'
  rr(ctx, 12, 12, 232, 56, 8)
  ctx.fill()
  ctx.strokeStyle = '#34a853'
  ctx.lineWidth = 2
  rr(ctx, 12, 12, 232, 56, 8)
  ctx.stroke()
  ctx.fillStyle = '#34a853'
  ctx.fillRect(28, 30, 96, 10)
  ctx.fillStyle = '#fbbc05'
  ctx.fillRect(28, 48, 56, 5)
  // product grid 3×2
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 12 + col * 80
      const y = 80 + row * 46
      ctx.fillStyle = 'rgba(96,165,250,0.25)'
      rr(ctx, x, y, 68, 38, 6)
      ctx.fill()
      ctx.strokeStyle = 'rgba(96,165,250,0.6)'
      rr(ctx, x, y, 68, 38, 6)
      ctx.stroke()
    }
  }
  return toTexture(c)
}

function drawAppMini(): THREE.CanvasTexture {
  const W = 256
  const H = 176
  const { c, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#0a1120'
  ctx.fillRect(0, 0, W, H)
  // stats header
  ctx.fillStyle = '#34a853'
  ctx.fillRect(12, 12, 84, 10)
  ctx.fillStyle = 'rgba(234,179,8,0.9)'
  ctx.fillRect(12, 30, 48, 5)
  // chart area: rising bars
  const bars = [18, 30, 24, 44, 38, 56, 62]
  for (let i = 0; i < bars.length; i++) {
    const h = bars[i] as number
    ctx.fillStyle = i === bars.length - 1 ? '#34a853' : 'rgba(96,165,250,0.55)'
    ctx.fillRect(14 + i * 33, 148 - h, 22, h)
  }
  // baseline
  ctx.fillStyle = '#31405f'
  ctx.fillRect(12, 150, 232, 3)
  // tab bar
  ctx.fillStyle = '#0d1628'
  rr(ctx, 12, 158, 232, 14, 7)
  ctx.fill()
  return toTexture(c)
}

/* Screen materials (cache-owned; emissive-map driven so they read as
 * LIT displays). */
const screenTex = {
  browser: null as THREE.CanvasTexture | null,
  notfound: null as THREE.CanvasTexture | null,
  storeMini: null as THREE.CanvasTexture | null,
  appMini: null as THREE.CanvasTexture | null,
}

type ScreenKind = keyof typeof screenTex

function screenMaterial(kind: ScreenKind): THREE.MeshStandardMaterial {
  // Textures are created lazily: canvas needs a DOM. First kit build
  // happens in the browser (client-only scene), never at SSR.
  if (!screenTex[kind]) {
    screenTex[kind] =
      kind === 'browser' ? drawBrowserWireframe()
        : kind === 'notfound' ? drawNotFoundScreen()
          : kind === 'storeMini' ? drawStoreMini()
            : drawAppMini()
  }
  const t = screenTex[kind] as THREE.CanvasTexture
  return std('#0a1120', 0.05, 0.32, { map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 1.35 })
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

/** An LED dot — small emissive cylinder facing +z (r = radius). */
function led(mat: THREE.Material, r: number, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r, 0.012, 10), mat, x, y, z)
  m.rotation.x = Math.PI / 2
  return m
}

/** A thin wire between two points (silver cylinder, Y-axis oriented). */
function wire(a: THREE.Vector3, b: THREE.Vector3, r = 0.004): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const geo = new THREE.CylinderGeometry(r, r, len, 6)
  const m = new THREE.Mesh(geo, M.silver)
  m.position.copy(a).addScaledVector(dir, 0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  return m
}

/* ------------------------------------------------------------------ *
 * KIT 1 · experienceStack — HOME HERO
 * «نصنعُ تجاربَ رقميةً» — the digital experience, exploded into its
 * three offering layers (website / 3D / automation), assembling.
 * ------------------------------------------------------------------ */

function buildExperienceStack(): THREE.Group {
  const g = node('experienceStack')

  // LAYER 1 — the WEBSITE: a floating browser window (slab + screen).
  const layerTop = node('layer_site', 0, 0.36, 0)
  layerTop.add(mesh(new RoundedBoxGeometry(0.92, 0.58, 0.035, 3, 0.016), M.ink))
  const screen1 = mesh(new THREE.PlaneGeometry(0.86, 0.52), screenMaterial('browser'), 0, 0, 0.019)
  layerTop.add(screen1)
  g.add(layerTop)

  // LAYER 2 — the 3D EXPERIENCE: a gyroscope — two orbiting rings and a
  // glowing emerald core (the rings are D-odometers: the 3D engine runs
  // exactly as far as you scroll).
  const layerMid = node('layer_3d', 0, 0, 0)
  const ringA = node('gyro_ring_a')
  const torusA = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.009, 10, 40), M.gold)
  torusA.rotation.x = Math.PI / 2
  ringA.add(torusA)
  layerMid.add(ringA)
  const ringB = node('gyro_ring_b')
  const torusB = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 10, 36), M.silver)
  torusB.rotation.y = Math.PI / 2
  ringB.add(torusB)
  layerMid.add(ringB)
  const core = node('gyro_core')
  core.add(mesh(new THREE.IcosahedronGeometry(0.085, 0), M.coreGlass))
  layerMid.add(core)
  g.add(layerMid)

  // LAYER 3 — the AUTOMATION: a node ribbon — three pills wired in a
  // chain, one packet glowing on the wire (n8n in miniature).
  const layerBot = node('layer_flow', 0, -0.34, 0)
  const pillGeo = new RoundedBoxGeometry(0.1, 0.05, 0.03, 2, 0.012)
  for (const px of [-0.15, 0, 0.15]) {
    layerBot.add(mesh(pillGeo, px === 0 ? M.panel : M.silver, px, 0, 0))
  }
  layerBot.add(wire(new THREE.Vector3(-0.1, 0, 0), new THREE.Vector3(-0.05, 0, 0), 0.005))
  layerBot.add(wire(new THREE.Vector3(0.05, 0, 0), new THREE.Vector3(0.1, 0, 0), 0.005))
  const packet = mesh(new THREE.SphereGeometry(0.016, 10, 8), M.signal, 0.075, 0, 0.006)
  packet.name = 'flow_packet'
  layerBot.add(packet)
  layerBot.add(led(M.ledGreen, 0.008, -0.15, 0.028, 0.016))
  g.add(layerBot)

  // The vertical guide pins that visually thread the three layers
  // together (read as the stack's axis — the assembled experience).
  for (const px of [-0.34, 0.34]) {
    g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.86, 6), M.silver, px, 0, 0))
  }

  return g
}

/* ------------------------------------------------------------------ *
 * KIT 2 · pipelineJourney — HOME METHOD
 * «رحلة واضحة، من الفكرة إلى الإطلاق» — the four-gate rail the glowing
 * workpiece rides; gates ignite as it passes; launch beacon at the end.
 * ------------------------------------------------------------------ */

function buildPipelineJourney(): THREE.Group {
  const g = node('pipelineJourney')
  const X0 = -0.72
  const X1 = 0.72
  const RAIL_Y = -0.06

  // the rail — a precision track with end caps
  g.add(mesh(new RoundedBoxGeometry(1.62, 0.028, 0.09, 2, 0.01), M.silver, 0, RAIL_Y, 0))
  g.add(mesh(new RoundedBoxGeometry(0.06, 0.1, 0.11, 2, 0.012), M.ink, X0 - 0.03, RAIL_Y, 0))
  g.add(mesh(new RoundedBoxGeometry(0.06, 0.1, 0.11, 2, 0.012), M.ink, X1 + 0.03, RAIL_Y, 0))

  // FOUR GATES (الاكتشاف / التصميم / البناء / الإطلاق) — posts + beam + LED
  const gateXs = [-0.55, -0.18, 0.19, 0.56]
  const postGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.24, 8)
  for (let i = 0; i < 4; i++) {
    const gx = gateXs[i] as number
    const gate = node(`gate_${i}`, gx, RAIL_Y + 0.02, 0)
    gate.add(mesh(postGeo, M.panel, -0.085, 0.12, 0))
    gate.add(mesh(postGeo, M.panel, 0.085, 0.12, 0))
    gate.add(mesh(new RoundedBoxGeometry(0.23, 0.035, 0.05, 2, 0.01), M.panel, 0, 0.24, 0))
    const lamp = led(M.ledGreen, 0.011, 0, 0.28, 0.02)
    lamp.name = `gate_led_${i}`
    gate.add(lamp)
    g.add(gate)
  }

  // the WORKPIECE — the project itself, riding the rail
  const work = node('workpiece', X0, RAIL_Y + 0.055, 0.02)
  work.add(mesh(new THREE.SphereGeometry(0.045, 14, 12), M.signal))
  work.add(mesh(new THREE.TorusGeometry(0.062, 0.006, 8, 24), M.gold))
  g.add(work)

  // the LAUNCH beacon at the far end — the goal
  const beacon = node('beacon', X1 + 0.03, RAIL_Y + 0.14, 0)
  beacon.add(mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.16, 8), M.gold))
  const tip = led(M.ledGold, 0.016, 0, 0.1, 0)
  tip.name = 'beacon_tip'
  beacon.add(tip)
  g.add(beacon)

  return g
}

/* ------------------------------------------------------------------ *
 * KIT 3 · siteCanvas — WEBSITES HERO
 * «مواقع تُبنى لتبهر» — the browser window whose wireframe blocks rise
 * into place as the section travels; the on-screen cursor FOLLOWS the
 * visitor's real pointer (follow drive); the URL bar loads.
 * ------------------------------------------------------------------ */

function buildSiteCanvas(): THREE.Group {
  const g = node('siteCanvas')
  const W = 1.02
  const H = 0.66

  // window slab + plain dark canvas backdrop (the CONTENT is 3D
  // geometry — blocks rising into place — so the backdrop stays a lit
  // dark pane, not a second wireframe texture)
  g.add(mesh(new RoundedBoxGeometry(W, H, 0.035, 3, 0.016), M.ink))
  const backdrop = std('#0c1426', 0.2, 0.4, { emissive: '#0e1830', emissiveIntensity: 0.5 })
  g.add(mesh(new THREE.PlaneGeometry(W - 0.06, H - 0.1), backdrop, 0, -0.02, 0.019))

  // chrome: traffic lights + URL pill with a loading bar
  const dots: Array<THREE.Material> = [M.ledRed, M.ledGold, M.ledGreen]
  for (let i = 0; i < 3; i++) {
    g.add(led(dots[i] as THREE.Material, 0.011, -W / 2 + 0.09 + i * 0.034, H / 2 - 0.05, 0.021))
  }
  g.add(mesh(new RoundedBoxGeometry(0.34, 0.045, 0.012, 2, 0.02), M.panel, 0.13, H / 2 - 0.05, 0.024))
  const load = node('url_load', -0.02, H / 2 - 0.05, 0.026)
  load.add(mesh(new RoundedBoxGeometry(0.1, 0.016, 0.006, 1, 0.003), M.gold, 0.05, 0, 0))
  g.add(load)

  // the content blocks — each its own node, rising into place
  const mkBlock = (name: string, w: number, h: number, mat: THREE.Material, x: number, y: number) => {
    const b = node(name, x, y, 0.032)
    b.add(mesh(new RoundedBoxGeometry(w, h, 0.014, 2, 0.008), mat))
    g.add(b)
    return b
  }
  mkBlock('blk_nav', 0.86, 0.05, M.panel, 0, H / 2 - 0.13)
  mkBlock('blk_hero', 0.55, 0.2, M.coreGlass, -0.12, 0.06)
  mkBlock('blk_aside', 0.22, 0.2, M.panel, 0.32, 0.06)
  for (let i = 0; i < 3; i++) {
    mkBlock(`blk_card_${i}`, 0.24, 0.13, M.panel, -0.26 + i * 0.27, -0.19)
  }
  mkBlock('blk_cta', 0.14, 0.05, M.gold, 0.0, 0.0)
  g.add(mesh(new RoundedBoxGeometry(0.86, 0.035, 0.01, 2, 0.005), M.panel, 0, -H / 2 + 0.09, 0.024))

  // the CURSOR — follows the visitor's real pointer (follow drive in
  // the registry: slide [xRange, yRange]).
  const cursor = node('ui_cursor', 0.1, -0.05, 0.045)
  const curBar = mesh(new THREE.BoxGeometry(0.012, 0.05, 0.006), M.ledGold, 0, 0.025, 0)
  curBar.name = 'ui_cursor_stem'
  cursor.add(curBar)
  const curTip = mesh(new THREE.BoxGeometry(0.026, 0.008, 0.006), M.ledGold, 0.008, 0.004, 0)
  curTip.name = 'ui_cursor_tip'
  cursor.add(curTip)
  g.add(cursor)

  return g
}

/* ------------------------------------------------------------------ *
 * KIT 4 · flowGraph — AUTOMATION HERO
 * «أنظمة تعمل، وأنت نائم» — the n8n workflow itself: five wired node
 * cards; packets hop node-to-node with the scroll, lighting each node
 * as they arrive; nodes also glow brighter when the pointer nears.
 * ------------------------------------------------------------------ */

function buildFlowGraph(): THREE.Group {
  const g = node('flowGraph')

  // node positions (zigzag) + card + glyph + LED each
  const N: Array<[number, number]> = [
    [-0.44, -0.1],
    [-0.21, 0.11],
    [0.01, -0.13],
    [0.23, 0.09],
    [0.46, -0.08],
  ]
  const cardGeo = new RoundedBoxGeometry(0.17, 0.115, 0.028, 2, 0.01)
  const glyphGeos: THREE.BufferGeometry[] = [
    new THREE.TorusGeometry(0.02, 0.007, 8, 18),
    new RoundedBoxGeometry(0.032, 0.032, 0.012, 1, 0.005),
    new THREE.ConeGeometry(0.02, 0.036, 4),
    new THREE.SphereGeometry(0.02, 10, 8),
    new THREE.TorusGeometry(0.02, 0.007, 8, 18),
  ]
  const glyphMats: Array<THREE.Material> = [M.ledGreen, M.ledBlue, M.ledGold, M.ledGreen, M.ledGreen]
  for (let i = 0; i < N.length; i++) {
    const [nx, ny] = N[i] as [number, number]
    const card = node(`node_${i}`, nx, ny, 0)
    card.add(mesh(cardGeo, i === 0 ? M.silver : M.panel))
    card.add(mesh(glyphGeos[i] as THREE.BufferGeometry, glyphMats[i] as THREE.Material, 0, 0.018, 0.018))
    card.add(led(i === N.length - 1 ? M.ledGold : M.ledGreen, 0.008, 0.06, -0.032, 0.017))
    g.add(card)
  }

  // wires between consecutive nodes
  for (let i = 0; i < N.length - 1; i++) {
    const a = N[i] as [number, number]
    const b = N[i + 1] as [number, number]
    g.add(wire(new THREE.Vector3(a[0], a[1], 0), new THREE.Vector3(b[0], b[1], 0), 0.0045))
  }

  // PACKETS — glowing spheres that hop along the wires (slide drives
  // in the registry, staggered windows; hop vectors live there —
  // here only each packet's BASE node: node_0, node_2, node_3)
  const hopBases = [0, 2, 3]
  for (let i = 0; i < hopBases.length; i++) {
    const base = hopBases[i] as number
    const p = node(`packet_${i}`, N[base]?.[0] ?? 0, N[base]?.[1] ?? 0, 0.024)
    p.add(mesh(new THREE.SphereGeometry(0.02, 10, 8), M.signal))
    const halo = mesh(
      new THREE.SphereGeometry(0.038, 10, 8),
      new THREE.MeshBasicMaterial({
        color: BRAND_COLORS.gGreen, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    )
    p.add(halo)
    g.add(p)
  }

  return g
}

/* ------------------------------------------------------------------ *
 * KIT 5 · resultsDeck — WORK HERO
 * «نتائج تتحدث بالأرقام» — the carousel of results: three project
 * screens around a gold hub, turning with the section's travel; the
 * front screen's bar chart GROWS as you scroll.
 * ------------------------------------------------------------------ */

function buildResultsDeck(): THREE.Group {
  const g = node('resultsDeck')

  // the hub — a gold-capped spindle
  g.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.56, 10), M.silver, 0, 0, 0))
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.035, 12), M.gold, 0, 0.3, 0))
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.035, 12), M.gold, 0, -0.3, 0))
  const hubLed = led(M.ledGreen, 0.012, 0, 0.335, 0)
  hubLed.name = 'hub_led'
  g.add(hubLed)

  // three screens at 120° — the front one (θ=0) is the analytics card
  const R = 0.29
  for (let i = 0; i < 3; i++) {
    const theta = (i / 3) * Math.PI * 2
    const arm = node(`screen_${i}`, Math.sin(theta) * R, 0, Math.cos(theta) * R)
    arm.rotation.y = theta
    const card = node(`card_${i}`, 0, 0, 0.05)
    if (i === 0) {
      // THE ANALYTICS SCREEN — «بالأرقام»: backdrop + growing bars
      card.add(mesh(new RoundedBoxGeometry(0.44, 0.3, 0.02, 2, 0.012), M.ink))
      card.add(led(M.ledGreen, 0.007, -0.17, 0.115, 0.014))
      const barHs = [0.07, 0.11, 0.09, 0.16]
      for (let b = 0; b < 4; b++) {
        const h = barHs[b] as number
        const geo = new RoundedBoxGeometry(0.055, h, 0.016, 1, 0.005)
        geo.translate(0, h / 2, 0) // origin at the bar's base — grows UP
        const bar = mesh(geo, b === 3 ? M.signal : M.panel, -0.135 + b * 0.09, -0.06, 0.018)
        bar.name = `chart_bar_${b}`
        card.add(bar)
      }
      // a thin baseline under the bars
      card.add(mesh(new RoundedBoxGeometry(0.38, 0.008, 0.008, 1, 0.003), M.silver, 0, -0.062, 0.018))
    } else {
      // the portfolio pieces: store + app mini screens
      card.add(mesh(new RoundedBoxGeometry(0.44, 0.3, 0.02, 2, 0.012), M.ink))
      card.add(mesh(
        new THREE.PlaneGeometry(0.4, 0.26),
        screenMaterial(i === 1 ? 'storeMini' : 'appMini'),
        0, 0, 0.012,
      ))
    }
    arm.add(card)
    g.add(arm)
  }

  return g
}

/* ------------------------------------------------------------------ *
 * KIT 6 · explodedDetail — ABOUT HERO
 * «صغيرة الحجم، كبيرة الهوس بالتفاصيل» — the compact module that opens
 * into its exploded stack (PCB, vents, silver, gold frame, glass);
 * hovering pulls it apart further (peek drives).
 * ------------------------------------------------------------------ */

function buildExplodedDetail(): THREE.Group {
  const g = node('explodedDetail')
  const S = 0.34

  // plate materials/layouts, authored at EXPLODED positions (drives
  // compact them at section entry — see the registry)
  const ys = [-0.34, -0.17, 0, 0.17, 0.34]
  for (let i = 0; i < 5; i++) {
    const plate = node(`plate_${i}`, 0, ys[i] ?? 0, 0)
    if (i === 0) {
      // PCB — the etched foundation
      plate.add(mesh(new RoundedBoxGeometry(S, 0.045, S, 2, 0.01), M.pcb))
      for (let t = 0; t < 3; t++) {
        plate.add(mesh(new THREE.BoxGeometry(0.16, 0.006, 0.012), M.gold, 0, 0.024, -0.1 + t * 0.1))
      }
    } else if (i === 1) {
      // vented panel with the activity LED
      plate.add(mesh(new RoundedBoxGeometry(S, 0.04, S, 2, 0.01), M.panel))
      for (let v = 0; v < 4; v++) {
        plate.add(mesh(new THREE.BoxGeometry(0.2, 0.008, 0.02), M.ink, 0, 0, -0.09 + v * 0.06))
      }
      const lamp = led(M.ledGreen, 0.01, 0.1, 0.022, 0.024)
      lamp.name = 'detail_led'
      plate.add(lamp)
    } else if (i === 2) {
      // brushed silver deck
      plate.add(mesh(new RoundedBoxGeometry(S, 0.035, S, 2, 0.01), M.silver))
    } else if (i === 3) {
      // gold frame — four bars forming the square outline
      const barL = new THREE.BoxGeometry(S, 0.024, 0.03)
      plate.add(mesh(barL, M.gold, 0, 0, S / 2 - 0.015))
      plate.add(mesh(barL, M.gold, 0, 0, -S / 2 + 0.015))
      const barS = new THREE.BoxGeometry(0.03, 0.024, S)
      plate.add(mesh(barS, M.gold, S / 2 - 0.015, 0, 0))
      plate.add(mesh(barS, M.gold, -S / 2 + 0.015, 0, 0))
    } else {
      // emerald glass top
      plate.add(mesh(new RoundedBoxGeometry(S, 0.028, S, 2, 0.01), M.coreGlass))
    }
    // corner standoffs riding each plate (the assembly's screws)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        plate.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6), M.gold, sx * (S / 2 - 0.03), 0, sz * (S / 2 - 0.03)))
      }
    }
    g.add(plate)
  }

  return g
}

/* ------------------------------------------------------------------ *
 * KIT 7 · braidMerge — ABOUT STORY
 * «قررنا ألا نختار» — the gold wire (الجمال) and the emerald wire
 * (الدقة) converging into the collar; the two-tone braid RISES from it
 * as the story travels — beauty and engineering woven into one.
 * ------------------------------------------------------------------ */

function buildBraidMerge(): THREE.Group {
  const g = node('braidMerge')

  // the two strands, converging into the collar from below
  const strand = (sign: number, mat: THREE.Material): THREE.Mesh => {
    const pts = [
      new THREE.Vector3(sign * 0.17, -0.52, 0),
      new THREE.Vector3(sign * 0.13, -0.28, 0),
      new THREE.Vector3(sign * 0.06, -0.06, 0),
      new THREE.Vector3(sign * 0.02, 0.06, 0),
    ]
    const curve = new THREE.CatmullRomCurve3(pts)
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.018, 8), mat)
  }
  g.add(strand(-1, M.strandGold))
  g.add(strand(1, M.strandGreen))

  // the COLLAR — the decision point («قررنا ألا نختار»)
  g.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.11, 14), M.gold, 0, 0.15, 0))
  g.add(mesh(new THREE.TorusGeometry(0.056, 0.008, 8, 22), M.gold, 0, 0.205, 0).rotateX(Math.PI / 2))
  g.add(mesh(new THREE.TorusGeometry(0.056, 0.008, 8, 22), M.gold, 0, 0.095, 0).rotateX(Math.PI / 2))

  // the BRAID — two helices woven around one axis, rising from the
  // collar (scale drive: grows from the collar with the story's travel)
  const braid = node('braid', 0, 0.2, 0)
  const helix = (phase: number, mat: THREE.Material): THREE.Mesh => {
    const pts: THREE.Vector3[] = []
    const LEN = 0.4
    const TURNS = 2.6
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const a = t * TURNS * Math.PI * 2 + phase
      pts.push(new THREE.Vector3(Math.cos(a) * 0.034, t * LEN, Math.sin(a) * 0.034))
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.014, 8), mat)
  }
  braid.add(helix(0, M.strandGold))
  braid.add(helix(Math.PI, M.strandGreen))
  g.add(braid)

  // the merged RESULT — the tip that lights once the braid is woven
  const tip = mesh(new THREE.SphereGeometry(0.03, 12, 10), M.signal, 0, 0.62, 0)
  tip.name = 'braid_tip'
  g.add(tip)

  return g
}

/* ------------------------------------------------------------------ *
 * KIT 8 · messageComposer — CONTACT HERO
 * «لنبدأ الحديث» — the message composing itself: lines typing in
 * (scale-x), the blinking caret, the send button lighting and firing
 * its packet as the section settles. Header dots = the channels.
 * ------------------------------------------------------------------ */

function buildMessageComposer(): THREE.Group {
  const g = node('messageComposer')
  const W = 0.66
  const H = 0.5

  // card + header + channel dots (email/whatsapp/telegram)
  g.add(mesh(new RoundedBoxGeometry(W, H, 0.03, 3, 0.016), M.ink))
  g.add(mesh(new RoundedBoxGeometry(W - 0.06, 0.06, 0.014, 2, 0.024), M.panel, 0, H / 2 - 0.07, 0.018))
  const chans: Array<THREE.Material> = [M.ledGold, M.ledGreen, M.ledBlue]
  for (let i = 0; i < 3; i++) {
    g.add(led(chans[i] as THREE.Material, 0.01, -W / 2 + 0.11 + i * 0.035, H / 2 - 0.07, 0.026))
  }

  // the LINES — typing in from the RIGHT edge (RTL-first geometry:
  // origin at the line's right end, growth leftward)
  const lineSpecs: Array<[number, number]> = [
    [0.44, 0.05],
    [0.36, -0.03],
    [0.3, -0.11],
  ]
  for (let i = 0; i < lineSpecs.length; i++) {
    const [len, y] = lineSpecs[i] as [number, number]
    const geo = new RoundedBoxGeometry(len, 0.03, 0.012, 1, 0.005)
    geo.translate(-len / 2, 0, 0) // origin at the RIGHT end
    const line = mesh(geo, M.line, 0.26, y, 0.02)
    line.name = `line_${i}`
    g.add(line)
  }

  // the CARET — blinking at the end of the last line (scroll-clocked)
  const caret = mesh(new THREE.BoxGeometry(0.014, 0.036, 0.01), M.ledGold, 0.26 - 0.31 - 0.02, -0.11, 0.02)
  caret.name = 'caret'
  g.add(caret)

  // the SEND button — lights and pops as the message completes
  const send = node('send_btn', -0.22, -H / 2 + 0.08, 0.02)
  send.add(mesh(new RoundedBoxGeometry(0.16, 0.06, 0.018, 2, 0.024), M.gold))
  const arrow = mesh(new THREE.ConeGeometry(0.014, 0.026, 4), M.ink, 0, 0, 0.012)
  arrow.rotation.z = -Math.PI / 2
  send.add(arrow)
  g.add(send)

  // the PACKET — the message, fired toward the reading column as the
  // section settles (mirror drive: flips with the writing direction)
  const packet = node('fly_packet', -0.13, -H / 2 + 0.08, 0.02)
  packet.add(mesh(new THREE.SphereGeometry(0.018, 10, 8), M.signal))
  packet.add(mesh(
    new THREE.SphereGeometry(0.034, 10, 8),
    new THREE.MeshBasicMaterial({
      color: BRAND_COLORS.gGreen, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  ))
  g.add(packet)

  return g
}

/* ------------------------------------------------------------------ *
 * KIT 9 · brokenLink — 404
 * «الصفحة غير موجودة… الطريق للرئيسية قريب» — the browser window with
 * the 404 page + the severed chain link; the halves reach for each
 * other as you scroll toward recovery, the red spark settling emerald.
 * ------------------------------------------------------------------ */

function buildBrokenLink(): THREE.Group {
  const g = node('brokenLink')
  const W = 0.72
  const H = 0.5

  // the window + 404 screen
  g.add(mesh(new RoundedBoxGeometry(W, H, 0.035, 3, 0.016), M.ink))
  g.add(mesh(new THREE.PlaneGeometry(W - 0.06, H - 0.06), screenMaterial('notfound'), 0, 0, 0.019))

  // the SEVERED LINK — two torus halves in front of the window (the
  // half MESHES hold the static orientation: upper / lower semicircle;
  // the ±0.35 "severed" tilt lives in the SWEEP drives' from-poses)
  const halfGeo = new THREE.TorusGeometry(0.075, 0.016, 10, 22, Math.PI)
  const linkL = node('link_left', -0.085, 0.02, 0.055)
  linkL.add(new THREE.Mesh(halfGeo, M.gold))
  g.add(linkL)
  const linkR = node('link_right', 0.085, 0.02, 0.055)
  const halfR = new THREE.Mesh(halfGeo, M.gold)
  halfR.rotation.z = Math.PI
  linkR.add(halfR)
  g.add(linkR)

  // the SPARKS — hot red in the gap while broken; emerald once healed
  const sparkRed = mesh(new THREE.SphereGeometry(0.013, 10, 8), M.ledRed, 0, 0.02, 0.055)
  sparkRed.name = 'spark_red'
  g.add(sparkRed)
  const sparkGreen = mesh(new THREE.SphereGeometry(0.013, 10, 8), M.signal, 0, 0.02, 0.055)
  sparkGreen.name = 'spark_green'
  g.add(sparkGreen)

  return g
}

/* ------------------------------------------------------------------ *
 * Registry + cache (module-lifetime; the scene clones per mount)
 * ------------------------------------------------------------------ */

const KIT_BUILDERS: Record<string, () => THREE.Group> = {
  experienceStack: buildExperienceStack,
  pipelineJourney: buildPipelineJourney,
  siteCanvas: buildSiteCanvas,
  flowGraph: buildFlowGraph,
  resultsDeck: buildResultsDeck,
  explodedDetail: buildExplodedDetail,
  braidMerge: buildBraidMerge,
  messageComposer: buildMessageComposer,
  brokenLink: buildBrokenLink,
}

const kitCache = new Map<string, RawInstrument>()

/** Build (or fetch from cache) an authored tech kit as a RawInstrument —
 *  the same contract loadInstrument gives GLTF assets: bbox-centered
 *  clone source with size/center in the kit's own units. */
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
