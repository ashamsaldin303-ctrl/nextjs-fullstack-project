/**
 * Model Registry (MODEL-2) — the SEMANTIC slot table.
 *
 * OWNER'S 2025 VERDICT (verbatim intent): the previous instrument set —
 * a random observatory of Western vintage props (grandfather clock,
 * marine compass, multimeter, moon rock…) — was «غير مناسبة بتاتا لأي
 * شيء في الموقع». The owner demanded real research («ابحث بشكل أفضل»)
 * and models that actually BELONG to this site: every object now MEANS
 * the section it lives in, for a Damascus digital studio whose language
 * is silk, brass and precision.
 *
 * Answer: the Elyra WORKSHOP — nine real, CC0, Blender-authored Poly
 * Haven bodies, each chosen for what it SAYS about its section (the
 * mapping is the design):
 *
 *   · HOME HERO — the BRASS VESSEL: a Damascene fluted brass vase
 *     standing over the silk canvas. The studio's identity object:
 *     gold-metal craft from Damascus, made modern. (VLM jury: 10/10
 *     fit — "aligns exactly with the Damascus/modern craft brief".)
 *   · HOME METHOD — the MAGNIFYING GLASS: «بدقة العلماء» — the method
 *     section is literally about inspecting details; the glass has a
 *     real KHR transmission lens.
 *   · WEBSITES HERO — the PROJECTOR SCREEN: the blank canvas every
 *     website is born on — a white screen over the dark hero.
 *   · AUTOMATION HERO — the DRILL PRESS: THE MACHINE — and its gears,
 *     crank handle and drill bit are LIVE ODOMETERS: the machine
 *     literally runs on your scrolling. Automation, made literal.
 *   · WORK HERO — the CAMERA: the lens the portfolio looks through;
 *     worn black + brass patina (gold accents), leather strap.
 *   · ABOUT HERO — the HAND PLANE No4: «صنعة اليد» — the studio's
 *     craft, plane and brass wheel (VLM: 9/10 "modern craft").
 *   · ABOUT STORY — the ENCYCLOPEDIA SET: twenty gold-embossed
 *     volumes; three of them lean out of the row as you travel the
 *     story — volumes being pulled from the shelf.
 *   · CONTACT HERO — the LED LIGHTBULB: «الفكرة تبدأ بمحادثة» — the
 *     idea, waiting for one message to switch on.
 *   · 404 — the RUBBER DUCK: the programmer's debugging companion
 *     (a wink every developer reads instantly).
 *
 * This file is PURE TS (no three.js import — it must stay inside the
 * FIRST bundle chunk, the rune-landmarks contract): everything the
 * driver (rune-scene.tsx) needs to place, size and pace each body
 * lives here — the model's file path, its normalization fit, its rest
 * pose, its part drives, and per-route SLOTS (section anchor id,
 * logical side, vertical anchor fraction, viewport-size fraction,
 * depth plane, scrub rotation, light/dark wash palette).
 *
 * Motion contract (unchanged, now on semantic bodies):
 * · «التمرير هو الزمن» — every transform is a pure function of
 *   (section rect, D, S). Whole-body rotation SCRUBS with the section's
 *   travel p (reversible, frame-identical up and down); parts are
 *   odometers of D (the press's gears + bit advance with total
 *   scroll), sweeps of p (the pulled volumes lean out), or swings
 *   (the camera strap, the duck's waddle). Zero wall-clock, zero
 *   randomness.
 * · «التوقف = تجمّد مطلق» — stop scrolling and the GPU renders zero
 *   frames (frameloop="demand" + the invalidate bus + freeze-proof
 *   `frames` counter).
 * · Placement — STABLE SLOTS: a model keeps its size and its composed
 *   position for the whole time its section is on stage (no roaming, no
 *   ballooning); it MATERIALIZES (fade + rise + settle) as the section
 *   arrives and dissolves as it leaves, always grounded by a contact
 *   shadow. Scrolling up replays the same design in reverse.
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
 * (see public/models/manifest.json, fetch-models-m2.mjs).
 * ------------------------------------------------------------------ */

/** One controllable part of a real model. */
export interface PartDrive {
  /** Node-name substring to find (e.g. 'gear_a'). */
  node: string
  /** Local rotation axis the part turns around. */
  axis: 'x' | 'y' | 'z'
  /** ODOMETER: rotation = base + D · rate (radians per pixel of signed
   *  scroll). The press's gears and bit are literal odometers — the
   *  machine runs exactly as far as you scroll. */
  rate?: number
  /** SWEEP (absolute radians [from, to] over the section's travel p,
   * eased) — e.g. the pulled volumes leaning out of the row. */
  sweep?: [number, number]
  /** SWING: rotation = base + sin(D · rate) · swing — e.g. the camera
   * strap swaying with the scroll. */
  swing?: number
  /** SNAP STEPS: rotation = base + floor(p · steps) · (2π / steps). */
  steps?: number
}

/* ------------------------------------------------------------------ *
 * The workshop library — one entry per downloaded real model.
 * ------------------------------------------------------------------ */

export interface ModelDef {
  /** Poly Haven slug (also the public/models folder name). */
  slug: string
  /** Load path under /public (gltf + sidecars, relative URIs resolve). */
  src: string
  /** Which bounding-box dimension the viewport fraction fits. */
  fit: 'height' | 'max' | 'width'
  /** Resting yaw — each model's best face leads. */
  yaw: number
  /** Resting pitch tilt (radians, X axis). */
  tilt?: number
  /** PBR environment intensity multiplier (brass vs matte balance). */
  envIntensity?: number
  /** Uniform warm EMISSIVE intensity — the lightbulb's inner idea-glow. */
  glow?: number
  /** Scroll-driven named parts. */
  drives?: readonly PartDrive[]
}

export const MODEL_LIBRARY: Record<string, ModelDef> = {
  brassVase: {
    slug: 'brass_vase_01',
    src: '/models/brass_vase_01/brass_vase_01_2k.gltf',
    fit: 'height',
    yaw: 0.2,
    envIntensity: 1.35, // brass wants its reflections
    // A single sculpted body — the vase says everything by standing.
  },
  magnifier: {
    slug: 'magnifying_glass_01',
    src: '/models/magnifying_glass_01/magnifying_glass_01_1k.gltf',
    fit: 'max',
    yaw: -0.4,
    tilt: 0.45, // lens raised toward the reader
    envIntensity: 1.0,
  },
  projectorScreen: {
    slug: 'projector_screen',
    src: '/models/projector_screen/projector_screen_1k.gltf',
    fit: 'height',
    yaw: -0.55, // VLM r2: stronger angle — the white face reads as a
    // designed slab catching the rim light, not a blank rectangle.
    envIntensity: 0.75,
  },
  drillPress: {
    slug: 'drill_press_01',
    src: '/models/drill_press_01/drill_press_01_1k.gltf',
    fit: 'height',
    yaw: 0.25,
    envIntensity: 0.95,
    // THE MACHINE RUNS ON SCROLL: both gears mesh (opposite signs),
    // the crank handle rides the gear train, and the bit spins on the
    // total-scroll odometer. ODOMETERS of D — pure functions of your
    // scrolling distance, frozen when you stop.
    drives: [
      { node: 'gear_a', axis: 'y', rate: 0.0035 },
      { node: 'gear_b', axis: 'y', rate: -0.0035 },
      { node: 'handle', axis: 'y', rate: 0.0035 },
      { node: 'bit', axis: 'y', rate: 0.012 },
    ],
  },
  camera: {
    slug: 'Camera_01',
    src: '/models/Camera_01/Camera_01_2k.gltf',
    fit: 'max',
    yaw: 0.6,
    tilt: 0.25,
    envIntensity: 0.9, // VLM r1: dim the studio feel — blend into the dark
    // band instead of reading as a pasted studio photo.
    // The leather strap sways gently with the signed scroll.
    drives: [{ node: 'strap', axis: 'z', swing: 0.07, rate: 0.005 }],
  },
  handPlane: {
    slug: 'hand_plane_no4',
    src: '/models/hand_plane_no4/hand_plane_no4_1k.gltf',
    fit: 'max',
    yaw: -0.5,
    tilt: 0.4, // the profile and the sole both read
    envIntensity: 1.0,
  },
  books: {
    slug: 'book_encyclopedia_set_01',
    src: '/models/book_encyclopedia_set_01/book_encyclopedia_set_01_1k.gltf',
    fit: 'max',
    yaw: 0.35,
    tilt: 0.08,
    envIntensity: 0.9,
    // Three volumes lean out of the row across the story's travel —
    // books being pulled from the shelf as the story is told.
    drives: [
      { node: 'book06', axis: 'z', sweep: [0, 0.09] },
      { node: 'book11', axis: 'z', sweep: [0, 0.13] },
      { node: 'book16', axis: 'z', sweep: [0, 0.06] },
    ],
  },
  lightbulb: {
    slug: 'lightbulb_led',
    src: '/models/lightbulb_led/lightbulb_led_1k.gltf',
    fit: 'max',
    yaw: 0.3,
    envIntensity: 1.2,
    // VLM r3 8/10 + "warmth could be more pronounced" (final round):
    // a warm inner glow — «الفكرة تبدأ بمحادثة», the idea lit from inside.
    glow: 0.65,
  },
  duck: {
    slug: 'rubber_duck_toy',
    src: '/models/rubber_duck_toy/rubber_duck_toy_1k.gltf',
    fit: 'max',
    yaw: -0.4,
    tilt: 0.05,
    envIntensity: 1.0,
    // A gentle waddle with the scroll — the duck rocks in place.
    drives: [{ node: 'rubber_duck_toy', axis: 'z', swing: 0.05, rate: 0.004 }],
  },
}

/* ------------------------------------------------------------------ *
 * Slots — a route's semantic bodies, glued to real sections.
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
   * STABLE size held for the section's whole stay (no ballooning). */
  viewFrac: number
  /** Depth plane (world z; the perspective camera adds real parallax
   * between planes when the pointer moves). */
  z: number
  /** Whole-body scrub rotation (radians) across the section's travel —
   * always reversed by scrolling back up. */
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
 * margin of its section — hero models sit at the page-hero's empty
 * side (~half the viewport tall), mid-page witnesses are smaller and
 * deeper. One or two per route: authority, not decoration soup. */
export const MODEL_ROUTES: Record<RunePresetKey, ModelRoute> = {
  // '/' — the living system. The BRASS VESSEL stands in the HOME
  // HERO's left margin over the silk canvas — the studio's identity
  // object, gold-metal craft from Damascus. The manifesto band is
  // deliberately model-free (its statement spans the full width — an
  // opaque body would fight the reading). The MAGNIFYING GLASS
  // witnesses the method section — «بدقة العلماء», lens raised to
  // the reader, a real transmission lens catching the light.
  home: {
    slots: [
      {
        model: 'brassVase', id: 'hero-title', side: 'end',
        yFrac: 0.56, viewFrac: 0.46, z: -0.5, scrub: 0.5, palette: 'dark',
        xPad: -0.12, // VLM r1: clear the h1's left tail + sub — tucked
        // deep into the free margin, below the headline's line.
        // VLM r2 8/10: +15% scale, raised so the base clears the fold.
      },
      {
        model: 'magnifier', id: 'method-title', side: 'end',
        yFrac: 0.26, viewFrac: 0.16, z: -0.3, scrub: 0.5, palette: 'light',
        xPad: -0.16, // VLM r3 6/10: lowered clear of the navbar band —
        // fully on the section's own light ground, framing the heading.
      },
    ],
    dust: 1,
  },

  // '/services/websites' — «البنية»: the PROJECTOR SCREEN commands the
  // hero — the blank white canvas every website is born on, standing
  // tall in the dark hero's margin. The ThreeDSection band keeps its
  // own icosahedron canvas mid-page, so one authority model is the
  // design.
  websites: {
    slots: [
      {
        model: 'projectorScreen', id: 'page-hero-title', side: 'end',
        yFrac: 0.48, viewFrac: 0.34, z: -0.35, scrub: 0.6, palette: 'dark',
        xPad: -0.09, // VLM r1: the page-hero text is max-w-4xl CENTERED —
        // ~272px margins at 1440w; the screen now fits the margin whole.
        // VLM r2 7/10: frame angled further (yaw) so the white face reads
        // as a designed slab, not a blank rectangle.
      },
    ],
    dust: 0.85,
  },

  // '/services/automation' — «الآلة»: the DRILL PRESS leads the hero —
  // the machine itself, and it RUNS on your scrolling: the gears mesh,
  // the crank turns and the bit spins as D advances (stop scrolling
  // and the machine freezes — automation, made literal). The n8n dark
  // band carries the live simulator (its own canvas).
  automation: {
    slots: [
      {
        model: 'drillPress', id: 'page-hero-title', side: 'end',
        yFrac: 0.52, viewFrac: 0.46, z: -0.3, scrub: 0.5, palette: 'dark',
        xPad: -0.07, // VLM r2 5/10: the 0.55 bump pushed the motor into
        // the headline — back to 0.46 and tucked deeper left, a clean
        // gap between machine and the max-w-4xl column.
      },
    ],
    dust: 1.15,
  },

  // '/work' — «المعرض»: the CAMERA at the hero — the lens the
  // portfolio looks through; worn black + brass patina (the gold
  // accents), its leather strap swaying gently with the scroll.
  work: {
    slots: [
      {
        model: 'camera', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.36, z: -0.5, scrub: 0.7, palette: 'dark',
        xPad: -0.07, // VLM r1: smaller + deeper (atmospheric blend) +
        // tucked clear of the centered max-w-4xl column.
      },
    ],
    dust: 1,
  },

  // '/about' — «الرحلة»: the HAND PLANE No4 opens the journey —
  // «صنعة اليد», the workshop's craft, its brass wheel and steel
  // blade catching the light. The ENCYCLOPEDIA SET anchors the story —
  // twenty gold-embossed volumes, three of them leaning out of the
  // row as the story travels (books pulled from the shelf).
  about: {
    slots: [
      {
        model: 'handPlane', id: 'page-hero-title', side: 'end',
        yFrac: 0.52, viewFrac: 0.34, z: -0.35, scrub: 0.5, palette: 'dark',
        xPad: -0.06, // VLM r1: tucked clear of the centered hero column.
      },
      {
        model: 'books', id: 'story-title', side: 'end',
        yFrac: 0.62, viewFrac: 0.4, z: -0.15, scrub: 0.3, palette: 'light',
        xPad: -0.06, // VLM r3 7/10: row centered in the margin — clear of
        // BOTH edges (was flush-left at -0.12), no clipped volumes.
      },
    ],
    dust: 1.05,
  },

  // '/contact' — «الإشارة»: the LED LIGHTBULB hangs in the hero —
  // «الفكرة تبدأ بمحادثة», the idea waiting for one message to
  // switch on. The channels band stays model-free: the channel cards
  // and the form ARE the content (authority, not decoration soup).
  contact: {
    slots: [
      {
        model: 'lightbulb', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.3, z: -0.4, scrub: 0.45, palette: 'dark',
        xPad: -0.12, // VLM r2 6/10: pinned deep into the margin (aligned
        // with the vase's line) — part of the layout grid, not floating.
      },
    ],
    dust: 1.3,
  },

  // 404 / catch-all — the RUBBER DUCK: the programmer's debugging
  // companion, rocking gently beside the recovery heading. A wink
  // every developer reads instantly.
  default: {
    slots: [
      {
        model: 'duck', id: 'nf-recovery-heading', side: 'end',
        yFrac: 0.5, viewFrac: 0.3, z: -0.3, scrub: 0.6, palette: 'light',
        xPad: -0.04, // VLM r1: smaller — the 404 message stays the hero.
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
