import { BRAND_COLORS } from '@/lib/brand-colors'

/**
 * Edge Rune preset registry (R2) — one morph "goal set" per route.
 *
 * The morph is UNIFORM interpolation, not geometry swaps (spec §4.4): the
 * same icosphere morphs its noise amplitude/frequency, twist, octave blend,
 * colors and halo between route presets — 2 draw calls total, and route
 * changes read as one continuous organic transformation (~0.8s).
 *
 * Route keys are LOCALE-STRIPPED paths — usePathname() returns the
 * locale-prefixed path ('/en/work'), so stripLocalePath() removes the
 * leading '/ar' | '/en' segment before the lookup (spec drift fix: without
 * it every English route would fall through to the 404 preset).
 */

export type RunePresetKey =
  | 'home'
  | 'websites'
  | 'automation'
  | 'work'
  | 'about'
  | 'contact'
  | 'default'

export interface RunePreset {
  /** Noise displacement amplitude — 0.02 (pure sphere) … 0.30 (shards). */
  amp: number
  /** Noise frequency — low (smooth monolith) … high (nervous network). */
  freq: number
  /** Y-axis twist across the sphere (radians at |y|=1). */
  twist: number
  /** Blend between the two noise octaves (0 = primary, 1 = secondary). */
  morph: number
  /** uTime advance multiplier (per-preset "energy"). */
  speed: number
  /** Mesh scale (relative units; the box is 220 CSS px). */
  scale: number
  /** Body gradient — valleys → mid → crests (+ green grazing hint). */
  colorA: string
  colorB: string
  colorC: string
  colorG: string
  /** Halo particle colors (mixed per-particle by aMix). */
  haloA: string
  haloB: string
}

const g = BRAND_COLORS

export const RUNE_PRESETS: Record<RunePresetKey, RunePreset> = {
  // '/' — "living matter": the agency's identity. Calm noisy blob + halo.
  home: {
    amp: 0.12, freq: 1.2, twist: 0, morph: 0.35, speed: 1, scale: 0.72,
    colorA: g.gBlue, colorB: g.primary, colorC: g.gBlueLight, colorG: g.gGreen,
    haloA: g.gBlue, haloB: g.gBlueLight,
  },
  // '/services/websites' — "structure & build": near-solid, low frequency.
  websites: {
    amp: 0.05, freq: 0.5, twist: 0.6, morph: 0.2, speed: 0.7, scale: 0.78,
    colorA: g.primary, colorB: g.gBlue, colorC: g.gBlueLight, colorG: g.wash,
    haloA: g.primary, haloB: g.gBlueLight,
  },
  // '/services/automation' — "n8n network": high-frequency node mesh.
  automation: {
    amp: 0.22, freq: 3.5, twist: 0.25, morph: 0.55, speed: 1.4, scale: 0.7,
    colorA: g.gGreen, colorB: g.primary, colorC: g.gBlue, colorG: g.gGreen,
    haloA: g.gGreen, haloB: g.gBlue,
  },
  // '/work' — "deconstruct / reassemble": active shards, fast morph.
  work: {
    amp: 0.3, freq: 5, twist: 0.5, morph: 0.75, speed: 1.2, scale: 0.68,
    colorA: g.primary, colorB: g.gBlue, colorC: g.wash, colorG: g.gGreen,
    haloA: g.gBlue, haloB: g.wash,
  },
  // '/about' — "continuity": a smooth twisted band.
  about: {
    amp: 0.03, freq: 1, twist: 2.4, morph: 0.3, speed: 0.8, scale: 0.74,
    colorA: g.gBlue, colorB: g.primary, colorC: g.wash, colorG: g.gGreen,
    haloA: g.gBlue, haloB: g.wash,
  },
  // '/contact' — "arrival / reception": a pure sphere with a close halo.
  contact: {
    amp: 0.02, freq: 1.4, twist: 0, morph: 0.25, speed: 0.6, scale: 0.7,
    colorA: g.primary, colorB: g.primary, colorC: g.gGreen, colorG: g.gGreen,
    haloA: g.primary, haloB: g.gGreen,
  },
  // 404 / catch-all / anything else — quiet tetra-ish default.
  default: {
    amp: 0.1, freq: 2, twist: 0.3, morph: 0.4, speed: 0.9, scale: 0.66,
    colorA: g.gBlue, colorB: g.primary, colorC: g.gBlueLight, colorG: g.gGreen,
    haloA: g.gBlue, haloB: g.primary,
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
