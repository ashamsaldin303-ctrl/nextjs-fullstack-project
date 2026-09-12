/**
 * GrainOverlay — R7-b "Sensory Polish Layer". Supersedes the Phase 2
 * FilmGrain: the same CSP-safe inline-SVG feTurbulence noise, now
 * ANIMATED — an 8-step background-position flicker (see .grain-overlay +
 * @keyframes grain-flicker in globals.css) that reads as celluloid grain
 * rather than a static texture.
 *
 * F-S9-03 (gold-standard audit) — BACKGROUND DECISION RECORD: no video
 * backgrounds anywhere on the site, by design. Rationale: (a) the visual
 * identity is built from LIVE layers instead — this animated grain + the
 * WebGL rune field + aurora/hero gradients, all GPU-cheap and
 * LCP-neutral; (b) video backgrounds cost megabytes of first-paint
 * bandwidth and fight the audio design (SOUND-2) for the visitor's
 * attention; (c) reduced-motion users get the frozen grain for free —
 * a video poster would need its own gating. Revisit only if a specific
 * section ever needs cinematic footage, with a poster-first fallback.
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
