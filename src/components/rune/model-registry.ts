/**
 * Model Registry (HEAVY-1) — the REAL-INSTRUMENT slot table.
 *
 * OWNER'S 2025 VERDICT (this task's brief, verbatim intent): the previous
 * procedural bodies — primitives assemblies and the hand-built astrolabe —
 * are «ليست النوع المقصود»: the owner wants HEAVY, REALISTIC, special
 * 3D objects of the kind made in Blender or equivalent, sourced from the
 * internet, and above all placed and animated CORRECTLY («تموضع الأجسام
 * والأنيميشن الخاص بها… خاطئة… حاول وحاول حتى تضبطها»).
 *
 * Answer: the Elyra OBSERVATORY — a coherent family of real, CC0,
 * Blender-authored Poly Haven instruments (a grandfather clock, a brass
 * compass, a field multimeter, a radio transceiver, binoculars, a
 * searchlight, a microscope, a lantern, a moon rock), one or two per
 * route, each GLUED to a real section's free margin at a STABLE,
 * museum-plinth composition slot, and each carrying PART-level scroll
 * drives (the clock's hands, the compass needle, the multimeter needle,
 * the radio's antenna/dial/morse arm) — the "scroll is time" contract
 * made literal: the hands advance exactly as far as you scroll and
 * freeze the instant you stop.
 *
 * This file is PURE TS (no three.js import — it must stay inside the
 * FIRST bundle chunk, the rune-landmarks contract): everything the
 * driver (rune-scene.tsx) needs to place, size and pace each instrument
 * lives here — the model's file path, its normalization fit, its rest
 * pose, its part drives, and per-route SLOTS (section anchor id, logical
 * side, vertical anchor fraction, viewport-size fraction, depth plane,
 * scrub rotation, light/dark wash palette).
 *
 * Motion contract (unchanged, now on real bodies):
 * · «التمرير هو الزمن» — every transform is a pure function of
 *   (section rect, D, S). Whole-body rotation SCRUBS with the section's
 *   travel p (reversible, frame-identical up and down); parts are
 *   odometers of D (hands advance with total scroll), sweeps of p, or
 *   discrete steps of p. Zero wall-clock, zero randomness.
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
 * (see public/models/manifest.json, Task 2-a).
 * ------------------------------------------------------------------ */

/** One controllable part of a real model. */
export interface PartDrive {
  /** Node-name substring to find (e.g. 'minute_hand'). */
  node: string
  /** Local rotation axis the part turns around. */
  axis: 'x' | 'y' | 'z'
  /** ODOMETER: rotation = base + D · rate (radians per pixel of signed
   * scroll). The clock hands are literal odometers of your scrolling. */
  rate?: number
  /** SWEEP (absolute radians [from, to] over the section's travel p,
   * eased) — e.g. the multimeter needle sweeping its scale. */
  sweep?: [number, number]
  /** SWING: rotation = base + sin(D · rate) · swing — e.g. the lantern
   * chain or the morse key tapping as you scroll. */
  swing?: number
  /** SNAP STEPS: rotation = base + floor(p · steps) · (2π / steps) —
   * e.g. the microscope turret clicking between objectives. */
  steps?: number
}

/* ------------------------------------------------------------------ *
 * The instrument library — one entry per downloaded real model.
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
  /** Scroll-driven named parts. */
  drives?: readonly PartDrive[]
}

export const MODEL_LIBRARY: Record<string, ModelDef> = {
  grandfatherClock: {
    slug: 'vintage_grandfather_clock_01',
    src: '/models/vintage_grandfather_clock_01/vintage_grandfather_clock_01.gltf',
    fit: 'height',
    yaw: -0.1,
    envIntensity: 1.25,
    // The clock's hands are odometers: the minute hand completes one
    // lap every ~5,700 px of scrolling; the hour hand runs 1/12th.
    // («houd» hour-hand typo is IN the asset's node name.)
    drives: [
      { node: 'minute_hand', axis: 'z', rate: 0.0011 },
      { node: 'houd_hand', axis: 'z', rate: 0.0011 / 12 },
    ],
  },
  mantelClock: {
    slug: 'mantel_clock_01',
    src: '/models/mantel_clock_01/mantel_clock_01.gltf',
    fit: 'height',
    yaw: -0.35,
    envIntensity: 0.85,
    drives: [{ node: 'minute_hand', axis: 'z', rate: 0.0022 }],
  },
  compass: {
    slug: 'seadogs_compass',
    src: '/models/seadogs_compass/seadogs_compass.gltf',
    fit: 'max',
    yaw: 0.15,
    tilt: 1.02, // looked down onto the face — held in the hand
    envIntensity: 1.0,
    // The needle spins with the signed scroll — one lap per ~2,900 px.
    drives: [{ node: 'needle', axis: 'y', rate: 0.0022 }],
  },
  binocular: {
    slug: 'vintage_binocular',
    src: '/models/vintage_binocular/vintage_binocular.gltf',
    fit: 'max',
    yaw: -0.55,
    tilt: 0.5, // angled up toward the viewer — "we see far"
    envIntensity: 0.9,
    // The focus wheel turns as you scroll.
    drives: [{ node: 'focus', axis: 'z', rate: 0.0035 }],
  },
  multimeter: {
    slug: 'retro_multimeter',
    src: '/models/retro_multimeter/retro_multimeter.gltf',
    fit: 'max',
    yaw: 0.55,
    tilt: 0.3,
    envIntensity: 0.95,
    drives: [
      // The needle sweeps its scale across the section's travel.
      { node: 'needle', axis: 'z', sweep: [-1.0, 0.85] },
      // The selector knob is an odometer of D.
      { node: 'knob', axis: 'z', rate: 0.0016 },
    ],
  },
  videoCamera: {
    slug: 'vintage_video_camera',
    src: '/models/vintage_video_camera/vintage_video_camera.gltf',
    fit: 'max',
    yaw: 0.5,
    tilt: 0.18,
    envIntensity: 0.9,
  },
  radio: {
    slug: 'vintage_radio_transceiver',
    src: '/models/vintage_radio_transceiver/vintage_radio_transceiver.gltf',
    fit: 'max',
    yaw: 0.35,
    envIntensity: 0.85,
    drives: [
      // The antenna rises as the section arrives (absolute sweep).
      { node: 'antenna', axis: 'x', sweep: [-1.2, 0.0] },
      // The tuning dial is an odometer.
      { node: 'dial', axis: 'z', rate: 0.002 },
      // The morse key taps while you scroll.
      { node: 'morse_key_arm', axis: 'x', swing: 0.14, rate: 0.03 },
    ],
  },
  searchlight: {
    slug: 'portable_searchlight',
    src: '/models/portable_searchlight/portable_searchlight.gltf',
    fit: 'max',
    yaw: -0.35,
    envIntensity: 1.0,
  },
  lantern: {
    slug: 'brass_diya_lantern',
    src: '/models/brass_diya_lantern/brass_diya_lantern.gltf',
    fit: 'height',
    yaw: 0.25,
    envIntensity: 1.05,
    // The lantern sways on its chain with the scroll.
    drives: [{ node: 'chain', axis: 'z', swing: 0.1, rate: 0.006 }],
  },
  microscope: {
    slug: 'vintage_microscope',
    src: '/models/vintage_microscope/vintage_microscope.gltf',
    fit: 'max',
    yaw: 0.4,
    tilt: 0.14,
    envIntensity: 0.95,
    // The turret clicks between objectives as the section travels.
    drives: [{ node: 'revolver', axis: 'z', steps: 3 }],
  },
  moonRock: {
    slug: 'moon_rock_02',
    src: '/models/moon_rock_02/moon_rock_02.gltf',
    fit: 'max',
    yaw: 0.3,
    envIntensity: 0.9,
  },
}

/* ------------------------------------------------------------------ *
 * Slots — a route's real instruments, glued to real sections.
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

/** «تموضع صحيح»: every instrument holds a stable, composed slot in the
 * free margin of its section — hero models sit at the page-hero's empty
 * side (~half the viewport tall), mid-page witnesses are smaller and
 * deeper. One or two per route: authority, not decoration soup. */
export const MODEL_ROUTES: Record<RunePresetKey, ModelRoute> = {
  // '/' — the living system. The GRANDFATHER CLOCK stands in the HOME
  // HERO's left margin (the silk canvas flows behind it, the outlined
  // watermark beneath) — time itself guards the studio's door, and its
  // hands advance exactly as far as you scroll. The manifesto band is
  // deliberately model-free (its statement spans the full width — an
  // opaque body would fight the reading). The MICROSCOPE witnesses the
  // method section — «بدقة العلماء», turret clicking between objectives.
  home: {
    slots: [
      {
        model: 'grandfatherClock', id: 'hero-title', side: 'end',
        yFrac: 0.52, viewFrac: 0.55, z: -0.5, scrub: 0.5, palette: 'dark',
      },
      {
        model: 'microscope', id: 'method-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.26, z: -0.2, scrub: 0.5, palette: 'light',
        xPad: -0.09,
      },
    ],
    dust: 1,
  },

  // '/services/websites' — «البنية»: the VIDEO CAMERA commands the hero
  // (we produce experiences); the ThreeDSection band keeps its own
  // icosahedron canvas mid-page, so one authority model is the design.
  websites: {
    slots: [
      {
        model: 'videoCamera', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.46, z: -0.35, scrub: 0.6, palette: 'dark',
        xPad: -0.06,
      },
    ],
    dust: 0.85,
  },

  // '/services/automation' — «الآلة»: the MULTIMETER leads the hero, its
  // needle sweeping the scale as the page travels; the n8n dark band
  // carries the live simulator (its own canvas), so the machine page
  // needs no second witness.
  automation: {
    slots: [
      {
        model: 'multimeter', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.5, z: -0.3, scrub: 0.5, palette: 'dark',
        xPad: -0.03,
      },
    ],
    dust: 1.15,
  },

  // '/work' — «المعرض»: the BINOCULARS at the hero — perspective, the
  // long view over the portfolio (focus wheel turning with the scroll).
  // VLM round 1: binoculars are WIDE — pulled further out (xPad) and
  // sized to clear the display heading entirely.
  work: {
    slots: [
      {
        model: 'binocular', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.44, z: -0.4, scrub: 0.7, palette: 'dark',
        xPad: -0.09,
      },
    ],
    dust: 1,
  },

  // '/about' — «الرحلة»: the BRASS COMPASS opens the journey — the
  // needle spinning with the signed scroll, the studio's heading; the
  // LANTERN HANGS into the story section — its chain runs up out of
  // frame (a lamp suspended over the journey, swaying with scroll).
  about: {
    slots: [
      {
        model: 'compass', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.5, z: -0.35, scrub: 0.5, palette: 'dark',
      },
      {
        model: 'lantern', id: 'story-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.5, z: -0.15, scrub: 0.35, palette: 'light',
        xPad: -0.02, yOff: 0.55,
      },
    ],
    dust: 1.05,
  },

  // '/contact' — «الإشارة»: the SEARCHLIGHT sweeps the hero (the beacon
  // itself); the RADIO TRANSCIEVER joins the channels — antenna rising,
  // dial turning, morse key tapping as you scroll toward the form.
  contact: {
    slots: [
      {
        model: 'searchlight', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.5, z: -0.4, scrub: 0.45, palette: 'dark',
      },
      {
        model: 'radio', id: 'channels-title', side: 'start',
        yFrac: 0.5, viewFrac: 0.34, z: -0.15, scrub: 0.4, palette: 'light',
        xPad: -0.02,
      },
    ],
    dust: 1.3,
  },

  // 404 / catch-all — one heavy moon rock: a waypoint, not a page.
  default: {
    slots: [
      {
        model: 'moonRock', id: 'nf-recovery-heading', side: 'end',
        yFrac: 0.5, viewFrac: 0.4, z: -0.3, scrub: 0.6, palette: 'light',
      },
    ],
    dust: 0.7,
  },
}

/* ------------------------------------------------------------------ *
 * Wash palettes (the atmosphere layer follows the active instrument).
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
