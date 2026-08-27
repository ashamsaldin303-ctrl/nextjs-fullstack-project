/**
 * GrainOverlay — R7-b "Sensory Polish Layer". Supersedes the Phase 2
 * FilmGrain: the same CSP-safe inline-SVG feTurbulence noise, now
 * ANIMATED — an 8-step background-position flicker (see .grain-overlay +
 * @keyframes grain-flicker in globals.css) that reads as celluloid grain
 * rather than a static texture.
 *
 * Zero JS, zero external assets: this is a plain server component
 * rendering ONE inert fixed div (pointer-events: none + aria-hidden) at
 * z-index 90 — above the intro overlay (80), below the custom cursor
 * (200). The global prefers-reduced-motion override in globals.css
 * collapses the flicker to quiet static grain (the 100% keyframe returns
 * to the base background-position, so the collapsed end state equals the
 * un-animated state).
 */
export function GrainOverlay() {
  return <div className="grain-overlay" aria-hidden="true" />
}
