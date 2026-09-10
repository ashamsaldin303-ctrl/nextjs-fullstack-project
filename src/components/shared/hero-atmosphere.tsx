'use client'

import { Parallax } from '@/components/scroll/parallax'

/* «نَسيم الواجهات» — Hero Atmosphere (IA)
 *
 * The living background layer for every INNER page hero. The homepage
 * hero is the composed stage (spotlight grid, Assembly blueprint,
 * marquee, WebGL canvas…); the inner pages open on nothing but the
 * static .hero-fallback gradient — on the mobile tier (where the Rune
 * field never mounts) that reads as a dead "wall of blue". This layer
 * ports the homepage's design language to those heroes:
 *
 *   stratum 1  AURORA — two huge brand-tinted radial blobs (blue /
 *              emerald) breathing on 34s/42s compositor drifts.
 *   stratum 2  STARFIELD — a deterministic lattice of drifting
 *              starlight (two speeds + twinkle accents) that tiles
 *              vertically and loops seamlessly.
 *   stratum 3  BLUEPRINT — the technical-essence drawing: hairline
 *              guides, corner brackets, crosshairs and mono spec
 *              labels (FIG. 0N — <PAGE> DOSSIER), drawn once on entry
 *              with the homepage's own hb-* keyframes.
 *   stratum 4  WATERMARK — the page's own name in giant stroke-only
 *              Latin glyphs bleeding off the corner, drifting slowly
 *              and lagging the scroll (Parallax far-layer).
 *
 * Contracts honored:
 *  - purely decorative: one aria-hidden + data-bg-layer root,
 *    pointer-events-none, ZERO text for assistive tech (the spec labels
 *    are Latin chrome under aria-hidden, like the homepage's).
 *  - compositor-only motion: every infinite animation animates
 *    transform/opacity exclusively (no layout/paint work per frame);
 *    the star fields are painted once and translated.
 *  - deterministic stars: module-scope mulberry32 PRNG with fixed
 *    seeds → identical strings on server and client (no hydration
 *    mismatch), zero per-mount cost.
 *  - reduced motion: the global kill-switch collapses every drift to
 *    its resting frame (aurora parks mid-breath as a static gradient,
 *    stars freeze, blueprint rests fully drawn, watermark static).
 *  - attention gate: the whole layer pauses under html[data-page-wait]
 *    (globals.css) so the choreography never plays out unseen.
 *  - desktop co-existence: the layer sits BELOW in-flow hero content
 *    (-z-10) and its ink is aria-hidden — the Rune field's glyph-ink
 *    coverage contracts are untouched; the models glide above this
 *    texture exactly as they glide above every section's content.
 */

/* ------------------------------------------------------------------ */
/* Deterministic starfield generation                                   */
/* ------------------------------------------------------------------ */

/** mulberry32 — tiny seeded PRNG, same sequence on server & client. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * One star layer's box-shadow list. Stars live in a virtual horizontal
 * band of height TILE (px) and are emitted THREE times each — at y,
 * y−TILE and y+TILE — so the layer can translate from 0 to −TILE and
 * loop seamlessly (whatever leaves the top is re-entering from the
 * bottom). X spans up to 1920 so wide desktops stay starlit to their
 * edges; the hero section's overflow-hidden crops the rest.
 */
function starShadows(seed: number, count: number, tile: number, color: string): string {
  const rand = mulberry32(seed)
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.round(4 + rand() * 1892) // 4 … 1896
    const y = Math.round(rand() * tile) // 0 … TILE
    for (const dy of [0, -tile, tile]) {
      parts.push(`${x}px ${y + dy}px 0 0 ${color}`)
    }
  }
  return parts.join(',')
}

const STAR_TILE = 720 // px — one vertical lap; coverage 2×TILE = 1440px

/* Far layer: dense, dim, slow (68s per lap). */
const STARS_FAR = starShadows(0x5eed1a, 84, STAR_TILE, 'rgba(190, 208, 255, 0.30)')
/* Near layer: sparser, brighter, quicker (46s per lap). */
const STARS_NEAR = starShadows(0xc0ffee, 40, STAR_TILE, 'rgba(232, 242, 255, 0.55)')

/* Twinkle accents — a handful of individually-pulsing bright points.
 * Deterministic positions; two carry the brand emerald / gold. */
const TWINKLES: {
  left: string
  top: string
  size: number
  color: string
  glow: string
  duration: number
  delay: number
}[] = [
  { left: '12%', top: '22%', size: 3, color: 'rgba(191, 219, 254, 0.9)', glow: 'rgba(96, 165, 250, 0.55)', duration: 4.2, delay: 0 },
  { left: '84%', top: '30%', size: 2, color: 'rgba(232, 242, 255, 0.85)', glow: 'rgba(148, 178, 255, 0.4)', duration: 5.4, delay: 1.1 },
  { left: '26%', top: '58%', size: 2, color: 'rgba(232, 242, 255, 0.8)', glow: 'rgba(148, 178, 255, 0.35)', duration: 3.8, delay: 2.3 },
  { left: '70%', top: '16%', size: 3, color: 'rgba(52, 168, 83, 0.85)', glow: 'rgba(52, 168, 83, 0.5)', duration: 4.8, delay: 0.6 },
  { left: '57%', top: '72%', size: 2, color: 'rgba(251, 188, 5, 0.8)', glow: 'rgba(251, 188, 5, 0.45)', duration: 5.1, delay: 1.8 },
  { left: '38%', top: '38%', size: 2, color: 'rgba(232, 242, 255, 0.75)', glow: 'rgba(148, 178, 255, 0.35)', duration: 4.5, delay: 3.1 },
  { left: '90%', top: '62%', size: 2, color: 'rgba(232, 242, 255, 0.8)', glow: 'rgba(148, 178, 255, 0.35)', duration: 5.8, delay: 2.7 },
]

/* ------------------------------------------------------------------ */
/* The layer                                                            */
/* ------------------------------------------------------------------ */

interface HeroAtmosphereProps {
  /** FIG line — e.g. "FIG. 02 — WEBSITES DOSSIER" (Latin chrome). */
  fig: string
  /** Grid/spec line — e.g. "GRID 12 × 8 · SPEC v2.5". */
  spec: string
  /** The watermark word — the page's own name (Latin, stroke-only). */
  word: string
}

export function HeroAtmosphere({ fig, spec, word }: HeroAtmosphereProps) {
  /* Watermark size: long words must still fit the hero's width as an
   * editorial bleed. Inter 900 uppercase advances average ≈0.68em (the
   * -0.03em tracking claws a little back) → cap the fluid size so the
   * word spans ≤ ~92vw. NO rem minimum: on a 390px viewport the min
   * (4.5rem = 72px) used to override the cap and blow AUTOMATION out
   * to ~126vw (VLM read the crop as a layout error). The 15rem ceiling
   * still guards ultrawide desktops. Computed from props → identical
   * on server & client. */
  const fluidCap = Math.min(19, 92 / (word.length * 0.68))

  return (
    <div
      className="hero-atmosphere pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      data-bg-layer=""
      aria-hidden="true"
    >
      {/* stratum 1 — aurora (two breathing blobs) */}
      <div className="ia-aurora">
        <span className="ia-blob ia-blob-a" />
        <span className="ia-blob ia-blob-b" />
      </div>

      {/* stratum 2 — starfield (drifting lattice + twinkles) */}
      <div className="ia-stars">
        <span className="ia-star-layer ia-stars-far" style={{ boxShadow: STARS_FAR }} />
        <span className="ia-star-layer ia-stars-near" style={{ boxShadow: STARS_NEAR }} />
        {TWINKLES.map((tw, i) => (
          <span
            key={i}
            className="ia-twinkle"
            style={{
              left: tw.left,
              top: tw.top,
              width: tw.size,
              height: tw.size,
              background: tw.color,
              boxShadow: `0 0 8px 1px ${tw.glow}`,
              animationDuration: `${tw.duration}s`,
              animationDelay: `${tw.delay}s`,
            }}
          />
        ))}
      </div>

      {/* stratum 3 — blueprint (the technical drawing; hb-* keyframes
          are shared with the homepage hero, ia-* classes own the
          positions tuned for the centered inner-hero composition) */}
      <div className="ia-blueprint" lang="en" dir="ltr">
        {/* hairline guides — verticals at the 7% rails + one horizontal */}
        <span className="hb-line hb-v hb-v1" />
        <span className="hb-line hb-v hb-v2" />
        <span className="hb-line ia-hline" />
        {/* corner brackets */}
        <span className="hb-bracket ia-b-tl" />
        <span className="hb-bracket ia-b-tr" />
        <span className="hb-bracket ia-b-bl" />
        <span className="hb-bracket ia-b-br" />
        {/* crosshairs at the guide intersections */}
        <span className="hb-cross ia-x1" />
        <span className="hb-cross ia-x2" />
        <span className="hb-cross ia-x3" />
        {/* mono spec labels */}
        <span className="hb-label ia-l1">{fig}</span>
        <span className="hb-label ia-l2">33.51°N · 36.29°E — DAMASCUS</span>
        <span className="hb-label ia-l3">{spec}</span>
      </div>

      {/* stratum 4 — the outlined watermark, lagging the scroll. Parallax
          speed is SCALED TO THE WORD (see .ia-watermark's CSS note): the
          homepage's speed-48 works on a ~345px word; an inner word is
          ~51-66px tall, where ±48px would swing most of the glyph height
          and half-cut the word at the section edge at scroll-0. */}
      <div
        className="ia-watermark"
        style={{ fontSize: `min(${fluidCap.toFixed(2)}vw, 15rem)` }}
      >
        <Parallax speed={16} className="block">
          {word}
        </Parallax>
      </div>
    </div>
  )
}
