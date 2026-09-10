/**
 * Model Registry (MODEL-4) — the SECTION-VOICE slot table.
 *
 * OWNER'S FOURTH VERDICT (verbatim intent): the technical set «تتحدث
 * عن التكنولوجيا ولكنها لا تعبر عن الموضوع الموجودة فيه» — the
 * bodies must speak the TOPIC of the section they live in, not
 * "technology" in general: «السيرفرات لا تدل على ماذا نبني»،
 * «الأوتوميشن لا تدل أبداً على الأتمتة من خلال النودز». Every body
 * below is now the LITERAL subject of its section — the mapping IS
 * the message:
 *
 *   · HOME HERO — SITE FLOW: «نصنع مواقع فائقة الجمال… وأنظمة أتمتة
 *     ذكية بـ n8n» as ONE body — a browser (the sites) flowing down a
 *     gold pipeline into three automation nodes (envelope → invoice →
 *     report). The pulses ride the links on your scroll: the agency's
 *     whole offer, running.
 *   · HOME METHOD — JOURNEY RAIL: «رحلة واضحة، من الفكرة إلى
 *     الإطلاق» — a four-station ascending rail (discover · design ·
 *     build · launch); the glowing traveler rides the rail, station
 *     rings spin as odometers of D.
 *   · WEBSITES HERO — STUDIO LAPTOP v2: «مواقع تُبنى لتبهر» — the
 *     canvas websites are born on, now ASSEMBLING: nav, hero and CTA
 *     blocks settle onto the live wireframe as the section travels.
 *   · AUTOMATION HERO — NODE FLOW: THE n8n canvas made physical —
 *     dot-grid editor panel, four node cards (trigger bolt → invoice
 *     → sheet → chat: «فواتير تُصدر نفسها، تنبيهات تصل لحظيًا»)
 *     wired by gold links; three pulses run the workflow on your
 *     scroll and freeze when you stop.
 *   · WORK HERO — WORK DECK: «نتائج تتحدث بالأرقام» — three shipped
 *     projects as browser cards at staggered depths, each wearing its
 *     metric (+140% · 3.2x · +92%); the deck fans open across the
 *     travel.
 *   · ABOUT HERO — OBSESSION LENS: «صغيرة الحجم، كبيرة الهوس
 *     بالتفاصيل» — a large gold magnifier sweeping a tiny fine-traced
 *     circuit tile, its focal glow riding the lens.
 *   · ABOUT STORY — DATA STACK (kept): «الأرشيف» — four storage
 *     sleds, one sliding out of the array as the story travels.
 *   · CONTACT HERO — CHAT SIGNAL: «لنبدأ الحديث — نرد عادة خلال
 *     ساعتين» — a speech bubble with three typing dots bobbing on
 *     the scroll's own oscillation: a conversation already alive.
 *   · 404 — the RUBBER DUCK (kept, downloaded): rubber-duck debugging
 *     — programmer culture, the survivor.
 *
 * This file is PURE TS (no three.js import — it must stay inside the
 * FIRST bundle chunk, the rune-landmarks contract): everything the
 * driver (rune-scene.tsx) needs to place, size and pace each body
 * lives here — the model's source (a downloaded GLTF path OR an
 * authored kit name), its normalization fit, its rest pose, its part
 * drives, and per-route SLOTS (section anchor id, logical side,
 * vertical anchor fraction, viewport-size fraction, depth plane,
 * scrub rotation, light/dark wash palette).
 *
 * Motion contract (unchanged, now on section-voice bodies):
 * · «التمرير هو الزمن» — every transform is a pure function of
 *   (section rect, D, S). Whole-body rotation SCRUBS with the section's
 *   travel p (reversible, frame-identical up and down); parts are
 *   odometers of D (the station rings), slides of p (the pulses, the
 *   assembling blocks, the traveling lens, the pulled sled), sweeps of
 *   p (the fanning deck) or swings (the breathing lid, the typing
 *   dots). Zero wall-clock, zero randomness.
 * · «التوقف = تجمّد مطلق» — stop scrolling and the GPU renders zero
 *   frames (frameloop="demand" + the invalidate bus).
 * · Placement — STABLE SLOTS: a model keeps its size and its composed
 *   position for the whole time its section is on stage; it
 *   MATERIALIZES (fade + rise + settle) as the section arrives and
 *   dissolves as it leaves, always grounded by a contact shadow.
 */

export type RunePresetKey =
  | 'home'
  | 'websites'
  | 'automation'
  | 'work'
  | 'about'
  | 'contact'
  | 'default'

/* ------------------------------------------------------------------ *
 * Part drives — named nodes of the real models, animated BY SCROLL.
 * Node names are suffix-matched against the asset's own node names
 * (see public/models/manifest.json + tech-kits.ts node names).
 * ------------------------------------------------------------------ */

/** One controllable part of a real model. */
export interface PartDrive {
  /** Node-name substring to find (e.g. 'pulse_a'). */
  node: string
  /** Local rotation axis the part turns around (also the slide axis
   *  for slide drives). */
  axis: 'x' | 'y' | 'z'
  /** ODOMETER: rotation = base + D · rate (radians per pixel of
   *  signed scroll). With `swing`, rate instead becomes the swing
   *  FREQUENCY (no accumulation). */
  rate?: number
  /** SWEEP (absolute radians [from, to] over the section's travel p,
   *  eased) — the deck's cards straightening, the lens turning. */
  sweep?: [number, number]
  /** SWING: rotation = base + sin(D · rate) · swing — the laptop's
   *  lid breathing, the typing dots bobbing. */
  swing?: number
  /** SNAP STEPS: rotation = base + floor(p · steps) · (2π / steps). */
  steps?: number
  /** SLIDE (position offset [from, to] over the section's travel p,
   *  eased, model-local units along `axis`) — the pulses traveling
   *  their links, the blocks assembling onto the page, the lens
   *  sweeping the tile, the pulled storage sled. */
  slide?: [number, number]
}

/* ------------------------------------------------------------------ *
 * The section-voice library — one entry per body (kit or download).
 * ------------------------------------------------------------------ */

export interface ModelDef {
  /** Registry key (kits) or Poly Haven slug (downloads) — also the
   *  debug/verification identity of the body. */
  slug: string
  /** Authored kit name (tech-kits.ts) — mutually exclusive with src. */
  kit?: string
  /** Load path under /public for downloaded GLTF assets. */
  src?: string
  /** Which bounding-box dimension the viewport fraction fits. */
  fit: 'height' | 'max' | 'width'
  /** Resting yaw — each model's best face leads. */
  yaw: number
  /** Resting pitch tilt (radians, X axis). */
  tilt?: number
  /** PBR environment intensity multiplier (brass vs matte balance). */
  envIntensity?: number
  /** Uniform warm EMISSIVE intensity (kept for downloaded GLTFs). */
  glow?: number
  /** Scroll-driven named parts. */
  drives?: readonly PartDrive[]
}

export const MODEL_LIBRARY: Record<string, ModelDef> = {
  siteFlow: {
    slug: 'siteFlow',
    kit: 'siteFlow',
    fit: 'max',
    yaw: -0.25,
    tilt: 0.12, // the browser face reads while the pipeline still turns
    envIntensity: 1.0,
    // THE OFFER, RUNNING: three pulses ride the gold links — the
    // browser's work flowing into the automation nodes. Lengths are
    // the exact link lengths tech-kits authors (0.098 / 0.132 / 0.132).
    drives: [
      { node: 'pulse_a', axis: 'x', slide: [0, 0.098] },
      { node: 'pulse_b', axis: 'x', slide: [0, 0.132] },
      { node: 'pulse_c', axis: 'x', slide: [0, 0.132] },
    ],
  },
  journeyRail: {
    slug: 'journeyRail',
    kit: 'journeyRail',
    fit: 'max',
    yaw: 0.35,
    tilt: 0.45, // the ascent reads: idea low-right, launch high-left
    envIntensity: 1.1,
    // THE JOURNEY: the traveler rides the rail across the section's
    // travel (rail length 1.031 — it boards at 0.05 and lands 0.92);
    // station rings spin as odometers of D (rates mirror tech-kits).
    drives: [
      { node: 'traveler', axis: 'x', slide: [0, 0.92] },
      { node: 'ring_1', axis: 'z', rate: 0.02 },
      { node: 'ring_2', axis: 'z', rate: 0.028 },
      { node: 'ring_3', axis: 'z', rate: 0.024 },
      { node: 'ring_4', axis: 'z', rate: 0.032 },
    ],
  },
  laptopStudio: {
    slug: 'laptopStudio',
    kit: 'laptopStudio',
    fit: 'max',
    yaw: -0.45,
    tilt: 0.3, // VLM r1: gentler pitch — the born-on screen faces the
    // visitor head-on while the deck still reads in 3/4
    envIntensity: 1.1,
    // THE PAGE ASSEMBLES: the lid breathes gently around its open pose
    // (rate = swing frequency, never accumulates) while nav / hero /
    // CTA blocks settle onto the wireframe — lid-local y runs from
    // −0.11/−0.14/−0.12 down to just off the screen plane.
    drives: [
      { node: 'lid', axis: 'x', swing: 0.03, rate: 0.004 },
      { node: 'block_nav', axis: 'y', slide: [0, 0.088] },
      { node: 'block_hero', axis: 'y', slide: [0, 0.122] },
      { node: 'block_cta', axis: 'y', slide: [0, 0.103] },
    ],
  },
  nodeFlow: {
    slug: 'nodeFlow',
    kit: 'nodeFlow',
    fit: 'max',
    yaw: -0.18,
    tilt: 0.1, // the editor canvas faces the visitor — it IS a screen
    envIntensity: 1.0,
    // THE WORKFLOW RUNS: three pulses travel the three links
    // (0.184 each — the exact link lengths tech-kits authors);
    // stop scrolling and the workflow freezes mid-wire.
    drives: [
      { node: 'pulse_a', axis: 'x', slide: [0, 0.184] },
      { node: 'pulse_b', axis: 'x', slide: [0, 0.184] },
      { node: 'pulse_c', axis: 'x', slide: [0, 0.184] },
    ],
  },
  workDeck: {
    slug: 'workDeck',
    kit: 'workDeck',
    fit: 'max',
    yaw: 0.2,
    tilt: 0.12,
    envIntensity: 1.05,
    // THE DECK PRESENTS: the outer cards straighten from their fanned
    // rest tilt and slide outward a touch — the portfolio opening to
    // the reader. (Sweeps are absolute: card_a 0.09 → −0.02,
    // card_c −0.09 → 0.02 — the authored fan IS the sweep's start.)
    drives: [
      { node: 'card_a', axis: 'z', sweep: [0.09, -0.02] },
      { node: 'card_a', axis: 'x', slide: [0, 0.09] },
      { node: 'card_c', axis: 'z', sweep: [-0.09, 0.02] },
      { node: 'card_c', axis: 'x', slide: [0, -0.09] },
    ],
  },
  obsessionLens: {
    slug: 'obsessionLens',
    kit: 'obsessionLens',
    fit: 'max',
    yaw: 0.3,
    tilt: 0.5, // looking DOWN onto the tile — the examiner's posture
    envIntensity: 1.15,
    // THE EXAMINATION: the lens sweeps across the tile's face — the
    // ring's CENTER (and its focal glow) must stay OVER the tile (span
    // x −0.25…+0.15 in kit units; VLM r2 caught ±0.13 parking the ring
    // half-off the tile). Narrowed to ±0.08 with a gentler ±0.15 turn.
    drives: [
      { node: 'lensG', axis: 'x', slide: [-0.08, 0.08] },
      { node: 'lensG', axis: 'y', sweep: [0.15, -0.15] },
    ],
  },
  chatSignal: {
    slug: 'chatSignal',
    kit: 'chatSignal',
    fit: 'max',
    yaw: -0.18,
    tilt: 0.08,
    envIntensity: 1.0,
    // THE CONVERSATION IS ALIVE: the bubble breathes gently (swing z)
    // while the three typing dots bob at different frequencies —
    // sin(D·rate)·swing, pure functions of the scroll, frozen on stop.
    drives: [
      { node: 'bubbleG', axis: 'z', swing: 0.03, rate: 0.0035 },
      { node: 'dot_a', axis: 'x', swing: 0.5, rate: 0.012 },
      { node: 'dot_b', axis: 'x', swing: 0.6, rate: 0.016 },
      { node: 'dot_c', axis: 'x', swing: 0.5, rate: 0.021 },
    ],
  },
  dataStack: {
    slug: 'dataStack',
    kit: 'dataStack',
    fit: 'max',
    yaw: 0.35,
    tilt: 0.1,
    envIntensity: 0.9,
    // The archive's volume is PULLED from the stack across the story's
    // travel — a storage sled sliding out of the array.
    drives: [{ node: 'sled_c', axis: 'x', slide: [0, 0.33] }],
  },
  duck: {
    slug: 'rubber_duck_toy',
    src: '/models/rubber_duck_toy/rubber_duck_toy_1k.gltf',
    fit: 'max',
    yaw: -0.4,
    tilt: 0.05,
    envIntensity: 1.0,
    // The 404 SURVIVOR — rubber-duck debugging: programmer culture,
    // the one body from the previous set that was already technical.
    // A gentle waddle AROUND the rest pose — the duck rocks in place
    // (rate = swing frequency, never accumulates).
    drives: [{ node: 'rubber_duck_toy', axis: 'z', swing: 0.06, rate: 0.004 }],
  },
}

/* ------------------------------------------------------------------ *
 * Slots — a route's section-voice bodies, glued to real sections.
 * ------------------------------------------------------------------ */

export type SlotSide = 'start' | 'end' | 'center'

export interface ModelSlot {
  /** MODEL_LIBRARY key. */
  model: string
  /** Section heading id (aria-labelledby target → closest('section')). */
  id: string
  /** Free-margin side (logical — mirrored by writing direction). */
  side: SlotSide
  /** Vertical anchor inside the section, 0..1. */
  yFrac: number
  /** Model's fitted dimension as a fraction of viewport height — a
   *  STABLE size held for the section's whole stay (no ballooning). */
  viewFrac: number
  /** Depth plane (world z; the perspective camera adds real parallax
   *  between planes when the pointer moves). */
  z: number
  /** Whole-body scrub rotation (radians) across the section's travel —
   *  always reversed by scrolling back up. */
  scrub: number
  /** Wash palette matching the section's background band. */
  palette: 'light' | 'dark'
  /** Lateral nudge on the anchor fraction (negative = toward edge). */
  xPad?: number
  /** Extra world-Y offset (fraction of the model's height). */
  yOff?: number
}

export interface ModelRoute {
  slots: readonly ModelSlot[]
  /** Ambient dust density multiplier. */
  dust: number
}

/** «تموضع صحيح»: every body holds a stable, composed slot in the free
 *  margin of its section — hero models sit at the page-hero's empty
 *  side, mid-page witnesses are smaller and deeper. One or two per
 *  route: authority, not decoration soup. */
export const MODEL_ROUTES: Record<RunePresetKey, ModelRoute> = {
  // '/' — the offer, running. SITE FLOW stands in the HOME HERO's
  // margin: the browser (the sites Elyra builds) flowing into three
  // automation nodes, pulses riding the links on your scroll. The
  // manifesto band is deliberately model-free (its statement spans
  // the full width). JOURNEY RAIL witnesses the method section —
  // «رحلة واضحة، من الفكرة إلى الإطلاق»: four stations, the traveler
  // riding the rail.
  home: {
    slots: [
      {
        model: 'siteFlow', id: 'hero-title', side: 'end',
        yFrac: 0.56, viewFrac: 0.46, z: -0.5, scrub: 0.4, palette: 'dark',
        xPad: -0.12, // monolith lineage: tucked deep into the free
        // margin, clear of the h1's tail (MODEL-2 VLM r1/r2 geometry).
      },
      {
        model: 'journeyRail', id: 'method-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.26, z: -0.35, scrub: 0.5, palette: 'light',
        xPad: -0.14, // VLM r1: was 0.26/top-left — read "decoupled
        // from the step cards"; now anchored mid-section BESIDE the
        // four-step grid, the rail guiding the reading downward.
      },
    ],
    dust: 1,
  },

  // '/services/websites' — «اللوحة»: the STUDIO LAPTOP commands the
  // hero — the canvas every website is born on, its screen alive with
  // a homepage wireframe while nav / hero / CTA blocks ASSEMBLE onto
  // the page as you scroll. The ThreeDSection band keeps its own
  // icosahedron canvas mid-page, so one authority model is the design.
  websites: {
    slots: [
      {
        model: 'laptopStudio', id: 'page-hero-title', side: 'end',
        yFrac: 0.48, viewFrac: 0.34, z: -0.35, scrub: 0.6, palette: 'dark',
        xPad: -0.09, // screen lineage: the page-hero text is max-w-4xl
        // CENTERED — ~272px margins at 1440w; the open deck fits the
        // margin whole.
      },
    ],
    dust: 0.85,
  },

  // '/services/automation' — «النظام»: NODE FLOW leads the hero — THE
  // n8n canvas: a dot-grid editor panel carrying the invoice workflow
  // (trigger → invoice → sheet → chat), three pulses running the gold
  // links as you scroll — stop and the workflow freezes mid-wire:
  // automation, made literal in its own vocabulary. The n8n dark band
  // carries the live simulator (its own canvas).
  automation: {
    slots: [
      {
        model: 'nodeFlow', id: 'page-hero-title', side: 'end',
        yFrac: 0.52, viewFrac: 0.5, z: -0.3, scrub: 0.35, palette: 'dark',
        xPad: -0.07, // press lineage: a clean gap between the canvas
        // and the centered max-w-4xl column (VLM r2 lesson).
      },
    ],
    dust: 1.15,
  },

  // '/work' — «المعرض»: the WORK DECK at the hero — «نتائج تتحدث
  // بالأرقام»: three shipped projects as browser cards at staggered
  // depths, each wearing its metric (+140% · 3.2x · +92%), the deck
  // fanning open across the section's travel.
  work: {
    slots: [
      {
        model: 'workDeck', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.36, z: -0.45, scrub: 0.4, palette: 'dark',
        xPad: -0.07, // camera lineage: deep (atmospheric blend),
        // tucked clear of the centered max-w-4xl column. VLM r1:
        // +0.02 — the metric digits inside the cards read small.
      },
    ],
    dust: 1,
  },

  // '/about' — «الرحلة»: the OBSESSION LENS opens the journey —
  // «صغيرة الحجم، كبيرة الهوس بالتفاصيل»: a large gold magnifier
  // sweeping a tiny fine-traced circuit tile, focal glow riding the
  // lens. The DATA STACK anchors the story — four storage sleds in a
  // gold-railed frame, one sliding out of the array as the story
  // travels (a volume pulled from the shelf).
  about: {
    slots: [
      {
        model: 'obsessionLens', id: 'page-hero-title', side: 'end',
        yFrac: 0.52, viewFrac: 0.33, z: -0.35, scrub: 0.5, palette: 'dark',
        xPad: -0.06, // plane lineage: tucked clear of the centered hero
        // column; the tile's face reads while the ring still turns.
      },
      {
        model: 'dataStack', id: 'story-title', side: 'end',
        yFrac: 0.66, viewFrac: 0.24, z: -0.25, scrub: 0.3, palette: 'light',
        xPad: -0.09, // VLM r3: smaller + deeper + tucked — fully clear of
        // the story's reading column (was grazing its opening line).
      },
    ],
    dust: 1.05,
  },

  // '/contact' — «المحادثة»: the CHAT SIGNAL stands in the hero —
  // «لنبدأ الحديث»: a speech bubble with three typing dots bobbing on
  // the scroll's own oscillation, the conversation already alive —
  // «نرد عادة خلال ساعتين». The channels band stays model-free: the
  // channel cards and the form ARE the content.
  contact: {
    slots: [
      {
        model: 'chatSignal', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.36, z: -0.4, scrub: 0.3, palette: 'dark',
        xPad: -0.12, // bulb lineage: pinned deep into the margin —
        // part of the layout grid, not floating.
      },
    ],
    dust: 1.3,
  },

  // 404 / catch-all — the RUBBER DUCK (survivor): rubber-duck
  // debugging, the programmer's companion, rocking gently beside the
  // recovery heading. A wink every developer reads instantly.
  default: {
    slots: [
      {
        model: 'duck', id: 'nf-recovery-heading', side: 'end',
        yFrac: 0.5, viewFrac: 0.3, z: -0.3, scrub: 0.6, palette: 'light',
        xPad: -0.04, // the 404 message stays the hero.
      },
    ],
    dust: 0.7,
  },
}

/* ------------------------------------------------------------------ *
 * Wash palettes (the atmosphere layer follows the active body).
 * ------------------------------------------------------------------ */

export const SLOT_PALETTES: Record<'light' | 'dark', { edge: string; edge2: string }> = {
  light: { edge: '#60A5FA', edge2: '#34A853' }, // gBlueLight + gGreen
  dark: { edge: '#4285F4', edge2: '#34A853' }, // gBlue + gGreen
}

/* ------------------------------------------------------------------ *
 * Route resolution (locale-stripped, trailing-slash-tolerant) —
 * the rune-landmarks contract, moved verbatim.
 * ------------------------------------------------------------------ */

const ROUTE_MAP: { match: (p: string) => boolean; key: RunePresetKey }[] = [
  { match: (p) => p === '/', key: 'home' },
  { match: (p) => p === '/services/websites', key: 'websites' },
  { match: (p) => p === '/services/automation', key: 'automation' },
  { match: (p) => p === '/work', key: 'work' },
  { match: (p) => p === '/about', key: 'about' },
  { match: (p) => p === '/contact', key: 'contact' },
]

const LOCALE_PREFIXES = ['/ar', '/en']

/** Strip a leading locale segment from a pathname. */
export function stripLocalePath(pathname: string): string {
  for (const p of LOCALE_PREFIXES) {
    if (pathname === p) return '/'
    if (pathname.startsWith(p + '/')) return pathname.slice(p.length) || '/'
  }
  return pathname
}

/** Preset key for a (possibly locale-prefixed) pathname. */
export function runePresetKeyForPath(pathname: string): RunePresetKey {
  const p = stripLocalePath(pathname)
  for (const r of ROUTE_MAP) {
    if (r.match(p)) return r.key
  }
  return 'default'
}

/** Writing direction for a (possibly locale-prefixed) pathname. */
export function runeDirForPath(pathname: string): 'rtl' | 'ltr' {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'ltr' : 'rtl'
}
