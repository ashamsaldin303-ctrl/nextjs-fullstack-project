/**
 * Brand color registry — the single source of truth for Elyra's brand hex
 * values in TypeScript (Edge Rune, R1).
 *
 * Before this module every Three.js scene hard-coded its hex literals
 * (capability-scene: 4 uniform colors + LIGHTS + HALO_COLORS + 3 satellite
 * colors; hero-canvas: its own silk palette). The CSS side already has its
 * tokens in globals.css (--g-blue, --primary, --g-green, --wash…); this file
 * mirrors those exact values for JS consumers so the WebGL layer can never
 * drift from the design tokens again.
 *
 * Values are byte-identical to the literals they replace (globals.css
 * §"brand" block) — wiring capability-scene to them is a pure refactor.
 */

export const BRAND_COLORS = {
  /** Google-blue accent for dark surfaces (#4285F4, --g-blue). */
  gBlue: '#4285F4',
  /** Brand primary — Apple blue (#0071E3, --primary). */
  primary: '#0071E3',
  /** Light brand blue (#60A5FA). */
  gBlueLight: '#60A5FA',
  /** Brand green (#34A853, --g-green). */
  gGreen: '#34A853',
  /** Pale blue tint / brand wash (#E8F2FF). */
  wash: '#E8F2FF',
  /** Dark section surface (#0F172A, --elyra-dark). */
  dark: '#0F172A',
} as const

export type BrandColorName = keyof typeof BRAND_COLORS
