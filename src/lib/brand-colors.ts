/**
 * Brand hex registry — the single owner of Elyra's brand color VALUES
 * (plan §2 W3-03 / decision D21).
 *
 * One literal source for everything TS-side that cannot read a CSS
 * variable: WebGL uniforms (hero-canvas, capability-scene), Satori
 * ImageResponse surfaces (icon / apple-icon / opengraph-image) and the
 * self-contained error/404 shells (global-error, root not-found — they
 * render outside globals.css by design). It is NOT a runtime
 * getComputedStyle bridge: globals.css :root keeps its own declarations
 * (and a pointing comment above it) — when a value changes here, change
 * it there in the same commit.
 *
 * ZERO-CHANGE GUARANTEE (wave rule): every entry below is the exact
 * literal that previously lived inline at each consumer — values are
 * re-sourced, never redesigned.
 */
export const BRAND = {
  /** Brand primary — Apple blue (globals `--primary`). */
  primary: '#0071E3',
  /** Accessible deep shade of the primary (globals `--primary-strong`). */
  primaryStrong: '#0066CC',
  /** Google-family blue accent (globals `--g-blue`). */
  gBlue: '#4285F4',
  /** Google-family green (globals `--g-green`). */
  gGreen: '#34A853',
  /** Google-family red (globals `--g-red`). */
  gRed: '#EA4335',
  /** Google-family yellow/gold (globals `--g-yellow`). */
  gYellow: '#FBBC05',
  /** Dark surface (globals `--elyra-dark`). */
  dark: '#0F172A',
  /** Immersive deep dark (globals `--background-deep`). */
  deep: '#08080A',
  /** Light page background (globals `--background`). */
  paper: '#F5F5F7',
  /** Pale blue brand wash (globals `--accent`). */
  wash: '#E8F2FF',
  /** Silk undertone — hero-canvas uColorC (brand-owned scene grade). */
  silkDeep: '#0A2A5E',
} as const

/** The brand palette object type (keys = token names, values = hexes). */
export type BrandPalette = typeof BRAND
