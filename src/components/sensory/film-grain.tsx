/**
 * Film Grain overlay — Phase 2 "Sensory Polish Layer" (prompt §4).
 *
 * A single static SVG feTurbulence noise layer (data-URI, zero external
 * assets, zero JS) mounted ONCE in the [locale] layout. It sits above all
 * content at 3.5% opacity for cinematic depth — low enough to preserve
 * WCAG 4.5:1 text contrast on both light and dark sections — and is
 * hidden entirely when printing. `pointer-events: none` + `aria-hidden`
 * keep it fully inert.
 */
export function FilmGrain() {
  return <div className="elyra-grain" aria-hidden="true" />
}
