import { BRAND_COLORS } from '@/lib/brand-colors'

/**
 * Rune Field preset registry (RUNE-2) — the per-route CHOREOGRAPHY.
 *
 * The owner's 2025 feedback replaced the RUNE-1 corner sigil with a
 * full-screen field of volumetric runes whose every motion is a pure
 * function of the scroll clocks (scroll-store):
 * · POSITION — each rune wanders a Lissajous path over the WHOLE viewport
 *   (anchor + large roam amplitudes), driven by the signed clock D:
 *   scrolling down carries it along the path, scrolling up retraces it.
 * · SCALE — «كبيرة ثم تصغر وتكبر»: a breathing cycle driven by the
 *   unsigned clock S (one big→small→big per ~2 screens), phase-staggered
 *   per rune so the field ripples instead of pulsing in unison.
 * · FREEZE — no wall-clock term exists anywhere; stop scrolling and every
 *   clock stops with you.
 *
 * PLACEMENT («أماكن مدروسة»): anchors are deliberate viewport fractions
 * biased to golden-ratio zones and the page's open thirds — clear of the
 * headline band, biased away from the RTL reading start edge, and each
 * route's FORMATION carries that page's meaning («تعبّر عن الصفحة»):
 *   home      «المنظومة الحيّة»  — the agency's three crafts as three
 *                                 roaming bodies (identity / build / automate)
 *   websites  «البنية»           — two counter-spiraled monolith columns
 *                                 + a keystone node (architecture)
 *   automation«الشبكة»           — three pulsing data nodes (n8n mesh)
 *   work      «المعرض»           — four quadrant runes, one per case
 *                                 domain, breathing in a staggered wave
 *   about     «الرحلة»           — one great continuity ribbon + satellite
 *   contact   «الإشارة»          — a quiet beacon + faint echo in dust
 *
 * All position/scale numbers are viewport fractions under the scene's
 * orthographic rig (y ∈ [-1, 1] = viewport height, x scaled by aspect):
 * `ax/ay` anchor fractions (0..1), `rax/ray` roam amplitudes as fractions
 * of the viewport HEIGHT applied to both axes (aspect-stable), `base` is
 * the rune diameter as a fraction of viewport height, `fx/fy/sk/spin` are
 * radians per pixel of scroll, `depth` is the parallax multiplier.
 *
 * Route keys are LOCALE-STRIPPED paths (stripLocalePath removes the
 * leading '/ar' | '/en' before lookup — without it every English route
 * would fall through to the default preset).
 */

export type RunePresetKey =
  | 'home'
  | 'websites'
  | 'automation'
  | 'work'
  | 'about'
  | 'contact'
  | 'default'

/** One volumetric rune's full choreography + character. */
export interface RuneSpec {
  /** Anchor X as a fraction of viewport width (0..1; 0.5 = center). */
  ax: number
  /** Anchor Y as a fraction of viewport height (0..1; 0.5 = center). */
  ay: number
  /** Horizontal roam amplitude, fraction of viewport height. */
  rax: number
  /** Vertical roam amplitude, fraction of viewport height. */
  ray: number
  /** Path frequency along X (radians per px of depth-scaled D). */
  fx: number
  /** Path frequency along Y (radians per px of depth-scaled D). */
  fy: number
  /** Path phase X / Y (radians). */
  px: number
  py: number
  /** Parallax depth — multiplies D for path + spin (near runes roam more). */
  depth: number
  /** Base scale — rune diameter as a fraction of viewport height. */
  base: number
  /** Breathing frequency (radians per px of S). */
  sk: number
  /** Breathing phase offset (radians). */
  sp: number
  /** Breathing depth 0..1 (scale swings ±50%·breathe). */
  breathe: number
  /** Spin (radians per px of depth-scaled D) — sign = handedness. */
  spin: number
  /** Noise displacement amplitude — 0.02 (pure sphere) … 0.30 (shards). */
  amp: number
  /** Noise frequency — low (smooth monolith) … high (nervous network). */
  freq: number
  /** Y-axis twist across the sphere (radians at |y| = 1). */
  twist: number
  /** Blend between the two noise octaves (0 = primary, 1 = secondary). */
  morph: number
  /** Body gradient — valleys → mid → crests (+ grazing hint). */
  colorA: string
  colorB: string
  colorC: string
  colorG: string
  /** Halo particle colors. */
  haloA: string
  haloB: string
  /** Halo intensity 0..1 (0 = no halo — pure volume). */
  halo: number
  /** Overall opacity multiplier (0 = slot parked). */
  opacity: number
}

/** One ambient background wash — a huge soft radial field that roams with
 *  the same clocks («الخلفية تتماشى معها»): the field's atmosphere layer,
 *  under the dust and the runes. */
export interface WashSpec {
  ax: number
  ay: number
  rax: number
  ray: number
  fx: number
  fy: number
  px: number
  py: number
  /** Diameter as a fraction of viewport height. */
  scale: number
  color: string
  alpha: number
}

export interface RuneFieldPreset {
  /** Fixed 4-slot pool — pages with fewer runes park the unused slots at
   *  base 0 / opacity 0, so route morphs never pop objects in/out, they
   *  swell/shrink continuously. */
  runes: readonly [RuneSpec, RuneSpec, RuneSpec, RuneSpec]
  washes: readonly [WashSpec, WashSpec]
  /** Ambient dust density multiplier 0..~1.4 (alpha, not count). */
  dust: number
}

const g = BRAND_COLORS

/** Parked slot — morph target for "no rune here" (kept as a value so
 *  interpolation into/out of visibility is continuous). */
const PARKED: RuneSpec = {
  ax: 0.5, ay: 0.5, rax: 0.1, ray: 0.1, fx: 0.0008, fy: 0.0008,
  px: 0, py: 0, depth: 0.7, base: 0, sk: 0.003, sp: 0, breathe: 0.4,
  spin: 0.0006, amp: 0.1, freq: 2, twist: 0, morph: 0.4,
  colorA: g.gBlue, colorB: g.primary, colorC: g.gBlueLight, colorG: g.gGreen,
  haloA: g.gBlue, haloB: g.gBlueLight, halo: 0, opacity: 0,
}

export const RUNE_FIELD_PRESETS: Record<RunePresetKey, RuneFieldPreset> = {
  // '/' — «المنظومة الحيّة»: the agency as a living system. Three crafts
  // roam as three bodies of very different character; the identity rune is
  // the field's flagship (large, calm, organic). Anchors hold the open
  // thirds so the hero stage (center-right in RTL) stays readable.
  home: {
    runes: [
      { // «الهوية» identity — the flagship: big calm living matter
        ax: 0.28, ay: 0.40, rax: 0.30, ray: 0.34,
        fx: 0.0011, fy: 0.00083, px: 0.4, py: 1.2, depth: 1.0,
        base: 0.34, sk: 0.0028, sp: 0.0, breathe: 0.55, spin: 0.0009,
        amp: 0.13, freq: 1.3, twist: 0, morph: 0.35,
        colorA: g.gBlue, colorB: g.primary, colorC: g.gBlueLight, colorG: g.gGreen,
        haloA: g.gBlue, haloB: g.gBlueLight, halo: 0.9, opacity: 1,
      },
      { // «البناء» build — structured lattice body, right-lower
        ax: 0.74, ay: 0.62, rax: 0.26, ray: 0.30,
        fx: 0.0013, fy: 0.001, px: 2.6, py: 4.4, depth: 0.85,
        base: 0.22, sk: 0.0034, sp: 1.6, breathe: 0.5, spin: 0.0007,
        amp: 0.06, freq: 2.6, twist: 0.8, morph: 0.3,
        colorA: g.primary, colorB: g.gBlue, colorC: g.gBlueLight, colorG: g.wash,
        haloA: g.primary, haloB: g.gBlueLight, halo: 0.7, opacity: 0.92,
      },
      { // «الأتمتة» automate — nervous green node mesh, bottom band
        ax: 0.36, ay: 0.82, rax: 0.28, ray: 0.26,
        fx: 0.0015, fy: 0.0012, px: 5.1, py: 0.7, depth: 1.2,
        base: 0.17, sk: 0.0042, sp: 3.2, breathe: 0.65, spin: 0.0011,
        amp: 0.2, freq: 3.6, twist: 0.3, morph: 0.6,
        colorA: g.gGreen, colorB: g.primary, colorC: g.gBlue, colorG: g.gGreen,
        haloA: g.gGreen, haloB: g.gBlue, halo: 0.8, opacity: 0.88,
      },
      PARKED,
    ],
    washes: [
      { ax: 0.30, ay: 0.35, rax: 0.18, ray: 0.16, fx: 0.0005, fy: 0.0004,
        px: 0, py: 2, scale: 1.9, color: g.gBlue, alpha: 0.075 },
      { ax: 0.70, ay: 0.75, rax: 0.16, ray: 0.18, fx: 0.0004, fy: 0.0005,
        px: 3, py: 0, scale: 1.6, color: g.gGreen, alpha: 0.06 },
    ],
    dust: 1,
  },

  // '/services/websites' — «البنية»: architecture. Two tall monolith
  // columns spiral in OPPOSITE handedness (structural counter-rotation)
  // flanking the page, with a small keystone node above the fold's center.
  // Columns roam mostly vertically — pillars rise and sink as you scroll.
  websites: {
    runes: [
      { // left monolith — tall counter-clockwise spiral
        ax: 0.16, ay: 0.52, rax: 0.10, ray: 0.30,
        fx: 0.0007, fy: 0.0013, px: 1.1, py: 0.3, depth: 0.8,
        base: 0.38, sk: 0.0024, sp: 0.0, breathe: 0.4, spin: 0.0006,
        amp: 0.045, freq: 0.7, twist: 1.9, morph: 0.25,
        colorA: g.primary, colorB: g.gBlue, colorC: g.wash, colorG: g.gGreen,
        haloA: g.primary, haloB: g.gBlueLight, halo: 0.5, opacity: 0.95,
      },
      { // right monolith — mirrored handedness
        ax: 0.84, ay: 0.58, rax: 0.10, ray: 0.28,
        fx: 0.0007, fy: 0.0012, px: 4.2, py: 3.6, depth: 0.75,
        base: 0.30, sk: 0.0027, sp: 2.1, breathe: 0.4, spin: -0.0006,
        amp: 0.05, freq: 0.8, twist: -1.4, morph: 0.25,
        colorA: g.gBlue, colorB: g.primary, colorC: g.gBlueLight, colorG: g.wash,
        haloA: g.gBlue, haloB: g.primary, halo: 0.5, opacity: 0.9,
      },
      { // keystone node — the joint the two columns meet at
        ax: 0.55, ay: 0.18, rax: 0.22, ray: 0.18,
        fx: 0.0012, fy: 0.0009, px: 2.2, py: 5.0, depth: 1.1,
        base: 0.13, sk: 0.0038, sp: 4.0, breathe: 0.55, spin: 0.0009,
        amp: 0.16, freq: 3.0, twist: 0.2, morph: 0.5,
        colorA: g.gBlueLight, colorB: g.gBlue, colorC: g.wash, colorG: g.gGreen,
        haloA: g.gBlueLight, haloB: g.gBlue, halo: 0.8, opacity: 0.9,
      },
      PARKED,
    ],
    washes: [
      { ax: 0.22, ay: 0.55, rax: 0.14, ray: 0.2, fx: 0.0004, fy: 0.0005,
        px: 0, py: 1, scale: 1.8, color: g.primary, alpha: 0.07 },
      { ax: 0.80, ay: 0.60, rax: 0.14, ray: 0.18, fx: 0.0005, fy: 0.0004,
        px: 2.5, py: 4, scale: 1.5, color: g.gBlue, alpha: 0.065 },
    ],
    dust: 0.85,
  },

  // '/services/automation' — «الشبكة»: three pulsing data nodes. The
  // character is high-frequency, green-biased (n8n), breathing fast —
  // packets moving through a mesh.
  automation: {
    runes: [
      {
        ax: 0.18, ay: 0.32, rax: 0.28, ray: 0.30,
        fx: 0.0014, fy: 0.0011, px: 0.6, py: 2.9, depth: 1.15,
        base: 0.24, sk: 0.0044, sp: 0.0, breathe: 0.65, spin: 0.001,
        amp: 0.2, freq: 3.4, twist: 0.2, morph: 0.62,
        colorA: g.gGreen, colorB: g.primary, colorC: g.gBlue, colorG: g.gGreen,
        haloA: g.gGreen, haloB: g.gBlue, halo: 0.85, opacity: 0.95,
      },
      {
        ax: 0.82, ay: 0.46, rax: 0.26, ray: 0.28,
        fx: 0.0016, fy: 0.0013, px: 3.3, py: 1.4, depth: 0.95,
        base: 0.20, sk: 0.005, sp: 2.2, breathe: 0.7, spin: -0.0009,
        amp: 0.22, freq: 4.0, twist: 0.35, morph: 0.55,
        colorA: g.primary, colorB: g.gGreen, colorC: g.gBlueLight, colorG: g.gBlue,
        haloA: g.primary, haloB: g.gGreen, halo: 0.8, opacity: 0.9,
      },
      { // the hub — lower center, largest of the three
        ax: 0.50, ay: 0.74, rax: 0.30, ray: 0.26,
        fx: 0.0011, fy: 0.0009, px: 5.2, py: 4.1, depth: 1.3,
        base: 0.26, sk: 0.004, sp: 4.4, breathe: 0.6, spin: 0.0008,
        amp: 0.18, freq: 3.0, twist: 0.15, morph: 0.58,
        colorA: g.gBlue, colorB: g.gGreen, colorC: g.gBlueLight, colorG: g.gGreen,
        haloA: g.gBlue, haloB: g.gGreen, halo: 0.9, opacity: 0.95,
      },
      PARKED,
    ],
    washes: [
      { ax: 0.35, ay: 0.70, rax: 0.2, ray: 0.16, fx: 0.0005, fy: 0.0004,
        px: 1, py: 3, scale: 1.7, color: g.gGreen, alpha: 0.07 },
      { ax: 0.70, ay: 0.35, rax: 0.18, ray: 0.2, fx: 0.0004, fy: 0.0005,
        px: 4, py: 0, scale: 1.4, color: g.gBlue, alpha: 0.06 },
    ],
    dust: 1.15,
  },

  // '/work' — «المعرض»: four quadrant runes, one per showcased case
  // domain, each with the domain's character. They share one breathing
  // frequency with quarter-cycle phase offsets — the gallery breathes in
  // a staggered WAVE (the ripple reads as browsing a sequence).
  work: {
    runes: [
      { // site — lattice body
        ax: 0.24, ay: 0.26, rax: 0.26, ray: 0.28,
        fx: 0.0012, fy: 0.001, px: 0.2, py: 3.1, depth: 1.0,
        base: 0.22, sk: 0.0036, sp: 0.0, breathe: 0.6, spin: 0.0008,
        amp: 0.08, freq: 2.4, twist: 0.7, morph: 0.35,
        colorA: g.primary, colorB: g.gBlue, colorC: g.gBlueLight, colorG: g.wash,
        haloA: g.primary, haloB: g.gBlueLight, halo: 0.7, opacity: 0.95,
      },
      { // academy — smooth band
        ax: 0.76, ay: 0.34, rax: 0.24, ray: 0.26,
        fx: 0.001, fy: 0.0012, px: 2.7, py: 0.9, depth: 0.85,
        base: 0.2, sk: 0.0036, sp: 1.57, breathe: 0.6, spin: -0.0007,
        amp: 0.05, freq: 1.0, twist: 1.6, morph: 0.3,
        colorA: g.gBlue, colorB: g.primary, colorC: g.wash, colorG: g.gGreen,
        haloA: g.gBlue, haloB: g.wash, halo: 0.6, opacity: 0.9,
      },
      { // dining — organic living blob
        ax: 0.30, ay: 0.76, rax: 0.28, ray: 0.24,
        fx: 0.0013, fy: 0.0011, px: 4.9, py: 2.3, depth: 1.1,
        base: 0.23, sk: 0.0036, sp: 3.14, breathe: 0.6, spin: 0.0009,
        amp: 0.14, freq: 1.4, twist: 0, morph: 0.4,
        colorA: g.gGreen, colorB: g.gBlue, colorC: g.gBlueLight, colorG: g.gGreen,
        haloA: g.gGreen, haloB: g.gBlue, halo: 0.75, opacity: 0.92,
      },
      { // property — sharp shard
        ax: 0.74, ay: 0.80, rax: 0.26, ray: 0.26,
        fx: 0.0014, fy: 0.001, px: 1.8, py: 5.5, depth: 0.95,
        base: 0.2, sk: 0.0036, sp: 4.71, breathe: 0.6, spin: -0.0008,
        amp: 0.26, freq: 4.6, twist: 0.45, morph: 0.72,
        colorA: g.gBlue, colorB: g.primary, colorC: g.wash, colorG: g.gGreen,
        haloA: g.gBlue, haloB: g.primary, halo: 0.65, opacity: 0.9,
      },
    ],
    washes: [
      { ax: 0.28, ay: 0.30, rax: 0.18, ray: 0.16, fx: 0.0004, fy: 0.0005,
        px: 0, py: 2, scale: 1.6, color: g.gBlue, alpha: 0.065 },
      { ax: 0.75, ay: 0.75, rax: 0.18, ray: 0.16, fx: 0.0005, fy: 0.0004,
        px: 3, py: 1, scale: 1.4, color: g.wash, alpha: 0.08 },
    ],
    dust: 1,
  },

  // '/about' — «الرحلة»: ONE great continuity ribbon crossing the whole
  // page (the studio's story as a single smooth twisted band — the
  // largest volume in the system) plus a small companion satellite.
  about: {
    runes: [
      { // the ribbon of the journey — very large, smooth, wide-roaming
        ax: 0.50, ay: 0.50, rax: 0.34, ray: 0.36,
        fx: 0.0009, fy: 0.0007, px: 0.0, py: 1.57, depth: 1.0,
        base: 0.44, sk: 0.0022, sp: 0.0, breathe: 0.45, spin: 0.0005,
        amp: 0.03, freq: 0.9, twist: 2.6, morph: 0.3,
        colorA: g.gBlue, colorB: g.primary, colorC: g.gBlueLight, colorG: g.gGreen,
        haloA: g.gBlue, haloB: g.wash, halo: 0.45, opacity: 0.96,
      },
      { // the satellite — a small restless companion
        ax: 0.80, ay: 0.22, rax: 0.22, ray: 0.2,
        fx: 0.0015, fy: 0.0013, px: 3.9, py: 1.1, depth: 1.25,
        base: 0.12, sk: 0.0046, sp: 2.6, breathe: 0.6, spin: 0.0012,
        amp: 0.18, freq: 3.2, twist: 0.2, morph: 0.5,
        colorA: g.gBlueLight, colorB: g.gBlue, colorC: g.wash, colorG: g.gGreen,
        haloA: g.gBlueLight, haloB: g.gBlue, halo: 0.7, opacity: 0.85,
      },
      PARKED,
      PARKED,
    ],
    washes: [
      { ax: 0.40, ay: 0.55, rax: 0.22, ray: 0.2, fx: 0.0004, fy: 0.0005,
        px: 0, py: 1, scale: 2.1, color: g.primary, alpha: 0.07 },
      { ax: 0.65, ay: 0.40, rax: 0.2, ray: 0.2, fx: 0.0005, fy: 0.0004,
        px: 2.5, py: 4, scale: 1.5, color: g.gBlue, alpha: 0.06 },
    ],
    dust: 1.05,
  },

  // '/contact' — «الإشارة»: a quiet beacon near the form's side, a faint
  // echo in the opposite corner, and a denser dust (reception atmosphere).
  contact: {
    runes: [
      { // the beacon — calm, near-pure sphere, slow breathing
        ax: 0.32, ay: 0.44, rax: 0.22, ray: 0.24,
        fx: 0.0009, fy: 0.0008, px: 0.8, py: 4.0, depth: 1.0,
        base: 0.2, sk: 0.0026, sp: 0.0, breathe: 0.35, spin: 0.0006,
        amp: 0.04, freq: 1.2, twist: 0, morph: 0.25,
        colorA: g.primary, colorB: g.primary, colorC: g.gGreen, colorG: g.gGreen,
        haloA: g.primary, haloB: g.gGreen, halo: 0.65, opacity: 0.95,
      },
      { // the echo — small, distant, faint
        ax: 0.68, ay: 0.72, rax: 0.18, ray: 0.16,
        fx: 0.0011, fy: 0.001, px: 4.4, py: 2.2, depth: 0.75,
        base: 0.1, sk: 0.0034, sp: 2.8, breathe: 0.5, spin: -0.0007,
        amp: 0.12, freq: 2.2, twist: 0.5, morph: 0.45,
        colorA: g.gBlueLight, colorB: g.gBlue, colorC: g.wash, colorG: g.gGreen,
        haloA: g.gBlueLight, haloB: g.gBlue, halo: 0.5, opacity: 0.55,
      },
      PARKED,
      PARKED,
    ],
    washes: [
      { ax: 0.35, ay: 0.45, rax: 0.16, ray: 0.18, fx: 0.0004, fy: 0.0005,
        px: 0, py: 2, scale: 1.6, color: g.primary, alpha: 0.07 },
      { ax: 0.70, ay: 0.70, rax: 0.14, ray: 0.14, fx: 0.0005, fy: 0.0004,
        px: 3, py: 0, scale: 1.2, color: g.gGreen, alpha: 0.05 },
    ],
    dust: 1.35,
  },

  // 404 / catch-all — two faint distant wanderers.
  default: {
    runes: [
      {
        ax: 0.30, ay: 0.40, rax: 0.26, ray: 0.28,
        fx: 0.001, fy: 0.0009, px: 1.5, py: 0.5, depth: 0.8,
        base: 0.16, sk: 0.003, sp: 0.0, breathe: 0.45, spin: 0.0007,
        amp: 0.1, freq: 2, twist: 0.3, morph: 0.4,
        colorA: g.gBlue, colorB: g.primary, colorC: g.gBlueLight, colorG: g.gGreen,
        haloA: g.gBlue, haloB: g.primary, halo: 0.5, opacity: 0.5,
      },
      {
        ax: 0.72, ay: 0.66, rax: 0.24, ray: 0.22,
        fx: 0.0012, fy: 0.001, px: 4.6, py: 3.4, depth: 0.7,
        base: 0.12, sk: 0.0034, sp: 2.4, breathe: 0.45, spin: -0.0006,
        amp: 0.08, freq: 2.6, twist: 0.6, morph: 0.4,
        colorA: g.gBlueLight, colorB: g.gBlue, colorC: g.wash, colorG: g.gGreen,
        haloA: g.gBlueLight, haloB: g.gBlue, halo: 0.4, opacity: 0.45,
      },
      PARKED,
      PARKED,
    ],
    washes: [
      { ax: 0.40, ay: 0.5, rax: 0.18, ray: 0.18, fx: 0.0004, fy: 0.0004,
        px: 0, py: 1, scale: 1.5, color: g.gBlue, alpha: 0.05 },
      { ax: 0.65, ay: 0.55, rax: 0.16, ray: 0.16, fx: 0.0005, fy: 0.0005,
        px: 2, py: 3, scale: 1.3, color: g.gBlue, alpha: 0.045 },
    ],
    dust: 0.7,
  },
}

/** Route patterns → preset keys. Locale-stripped, trailing-slash-tolerant. */
const ROUTE_MAP: { match: (p: string) => boolean; key: RunePresetKey }[] = [
  { match: (p) => p === '/', key: 'home' },
  { match: (p) => p === '/services/websites', key: 'websites' },
  { match: (p) => p === '/services/automation', key: 'automation' },
  { match: (p) => p === '/work', key: 'work' },
  { match: (p) => p === '/about', key: 'about' },
  { match: (p) => p === '/contact', key: 'contact' },
]

const LOCALE_PREFIXES = ['/ar', '/en']

/**
 * Strip a leading locale segment from a pathname.
 * '/en/work' → '/work', '/ar/work' → '/work', '/en' → '/', '/work' → '/work'.
 */
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
