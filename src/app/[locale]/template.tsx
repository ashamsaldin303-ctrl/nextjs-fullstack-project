/**
 * W2-04 (plan §2, decision D14) — CSS-only page-enter. A Next.js
 * `template.tsx` re-renders its subtree on every navigation (unlike a
 * layout, which persists), so wrapping the segment's children here gives
 * every route a 0.45s translateY(10px) entrance on the site curve with
 * ZERO client JS — this is a pure server component, nothing ships.
 *
 * LCP-safe by decision D14: opacity stays CONSTANT 1 in the keyframes
 * (the template also runs on the very first load — a fade-from-0 would
 * hold content invisible and delay LCP; content is painted, then slides).
 * The global prefers-reduced-motion kill-switch in globals.css collapses
 * the animation automatically (transform-only, zero layout work — RTL
 * direction-neutral).
 *
 * First-visit interplay with the intro curtain: the slide plays UNDER the
 * fully-opaque overlay and is finished before the curtain lifts — no
 * conflict with the hero choreography (G4 eye-check owns the final call;
 * the one-line `html[data-intro]` fallback lives next to the CSS rule).
 */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
