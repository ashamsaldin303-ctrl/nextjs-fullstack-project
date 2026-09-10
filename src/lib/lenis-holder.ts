'use client'

/**
 * Lenis singleton holder (REF-2 Phase A).
 *
 * The SmoothScroll provider (sensory/smooth-scroll.tsx) creates the one
 * app-wide Lenis instance and registers it here. Everything else — route
 * transitions that need to scroll top, navbar anchor jumps, "back to
 * results" scrolls — reads it through `getLenis()` / `lenisScrollTo()`
 * WITHOUT importing the lenis module directly (keeps the tiny importers
 * out of the lenis chunk boundary; the holder itself imports only the
 * zero-dependency scroll-store — no chunk impact).
 *
 * Freeze-contract note: Lenis momentum emits continuous native scroll
 * events while easing; once the tail drains, events STOP — the rune
 * field's frameloop="demand" then renders zero frames (owner's «التوقف
 * الفوري» contract intact). No wall-clock enters any animation.
 */

import type Lenis from 'lenis'

import { expectTeleport } from './scroll-store'

let instance: Lenis | null = null

/** Register/unregister the app instance (SmoothScroll provider only). */
export function setLenis(next: Lenis | null): void {
  instance = next
}

/** The live instance (null before mount / reduced-motion / after unmount). */
export function getLenis(): Lenis | null {
  return instance
}

/**
 * Smooth-scroll helper for imperative calls. Falls back to the native
 * window scroll API when Lenis is absent (reduced motion, SSR, mobile
 * tier before hydration) so callers stay declarative.
 *
 * AUDIT-A3 (FIX 1): `immediate: true` writes are teleport-class jumps —
 * the scroll clocks are neutralized first (expectTeleport) so the rune
 * field never reads a route/locale reset as a gesture. Smooth writes
 * stay gesture-class on purpose: the visible glide is real motion and
 * SHOULD feed the clocks.
 */
export function lenisScrollTo(
  target: string | number | HTMLElement,
  options: { offset?: number; immediate?: boolean } = {},
): void {
  const { offset = 0, immediate = false } = options
  if (immediate) expectTeleport()
  const lenis = getLenis()
  if (lenis) {
    lenis.scrollTo(target, { offset, immediate })
  } else if (typeof target === 'number') {
    // AUDIT-A3 (FIX 2): behavior is pinned to one explicit 'auto' — Lenis
    // is the site's ONE scroll-writer and native smooth scrolling is
    // forbidden (MODEL-5 single-writer discipline); this branch runs only
    // when Lenis is absent (reduced motion / pre-hydration), where motion
    // must be instant anyway.
    window.scrollTo({ top: target + offset, behavior: 'auto' })
  } else {
    const el =
      typeof target === 'string' && target.startsWith('#')
        ? document.querySelector(target)
        : target
    if (el instanceof HTMLElement) {
      // AUDIT-A3 (FIX 2): honor `offset` here too (was silently dropped);
      // mirrors Lenis's own element math minus scroll-margin (the
      // calculator's scroll-mt-20 is being removed to unify anchor
      // landings; no other target sets scroll-margin).
      const top = el.getBoundingClientRect().top + window.scrollY + offset
      window.scrollTo({ top, behavior: 'auto' })
    }
  }
}
