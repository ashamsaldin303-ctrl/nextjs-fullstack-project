/**
 * W2-04 (plan §2, decision D14) → T3-11 (REF-3) — CSS-only page-enter.
 * A Next.js `template.tsx` re-renders its subtree on every navigation
 * (unlike a layout, which persists), so wrapping the segment's children
 * here gives every route a zero-client-JS entrance — originally a
 * 0.45s translateY slide (W2-04), upgraded by REF-3 T3 item 11 to an
 * 850ms organic circular reveal (see .page-enter in globals.css).
 * This is a pure server component, nothing ships.
 *
 * LCP-safe by decision D14: opacity stays CONSTANT 1 in the keyframes
 * (the template also runs on the very first load — a fade-from-0 would
 * hold content invisible and delay LCP; content is painted, then the
 * circle sweeps). The fill mode is `backwards` so the clip-path reverts
 * to `none` when the reveal ends — no permanent clip on the page (see
 * the globals.css rule for the full rationale).
 *
 * The global prefers-reduced-motion kill-switch in globals.css collapses
 * the animation automatically (transform/clip-only, zero layout work —
 * RTL direction-neutral via the mirrored origin).
 *
 * First-visit interplay with the intro curtain: the reveal plays UNDER
 * the fully-opaque overlay and is finished before the curtain lifts — no
 * conflict with the hero choreography (G4 eye-check owns the final call;
 * the one-line `html[data-intro]` fallback lives next to the CSS rule).
 */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
