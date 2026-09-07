/**
 * Brand color registry — the single source of truth for Elyra's brand hex
 * values in TypeScript.
 *
 * MERGE NOTE (PACK W3-03/D21 ↔ RUNE R1): both lines independently created
 * this single-owner module — R1 under the name `BRAND_COLORS` (Edge Rune +
 * rune scenes) and PACK W3 under `BRAND` (hero-canvas, Satori ImageResponse
 * surfaces, error/404 shells). The unified registry below is the UNION of
 * both key sets (every overlapping value was byte-identical) and exports
 * BOTH names pointing at the same object, so every consumer on either line
 * keeps compiling with zero call-site changes. `BrandColorName` (R1) and
 * `BrandPalette` (W3) are likewise both exported.
 *
 * One literal source for everything TS-side that cannot read a CSS
 * variable: WebGL uniforms (hero-canvas, capability-scene, rune presets),
 * Satori ImageResponse surfaces (icon / apple-icon / opengraph-image) and
 * the self-contained error/404 shells (global-error, root not-found — they
 * render outside globals.css by design). It is NOT a runtime
 * getComputedStyle bridge: globals.css :root keeps its own declarations
 * (and a pointing comment above it) — when a value changes here, change
 * it there in the same commit.
 *
 * ZERO-CHANGE GUARANTEE (wave rule): every entry below is the exact
 * literal that previously lived inline at each consumer — values are
 * re-sourced, never redesigned.
 */

const REGISTRY = {
  /** Brand primary — Apple blue (globals `--primary`). */
  primary: '#0071E3',
  /** Accessible deep shade of the primary (globals `--primary-strong`). */
  primaryStrong: '#0066CC',
  /** Google-family blue accent (globals `--g-blue`). */
  gBlue: '#4285F4',
  /** Light brand blue (#60A5FA) — R1 token; W3 kept it as a scene literal. */
  gBlueLight: '#60A5FA',
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

/** R1 name (Edge Rune / rune scenes / capability-scene). */
export const BRAND_COLORS = REGISTRY
/** W3-03/D21 name (hero-canvas, Satori surfaces, error shells). */
export const BRAND = REGISTRY

/** The brand palette object type (keys = token names, values = hexes). */
export type BrandPalette = typeof REGISTRY
/** R1 token-name type. */
export type BrandColorName = keyof typeof REGISTRY
