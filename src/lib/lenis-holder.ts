'use client'

/**
 * Lenis singleton holder (REF-2 Phase A).
 *
 * The SmoothScroll provider (sensory/smooth-scroll.tsx) creates the one
 * app-wide Lenis instance and registers it here. Everything else — route
 * transitions that need to scroll top, navbar anchor jumps, "back to
 * results" scrolls — reads it through `getLenis()` / `lenisScrollTo()`
 * WITHOUT importing the lenis module directly (keeps the tiny importers
 * out of the lenis chunk boundary; the holder itself is dependency-free).
 *
 * Freeze-contract note: Lenis momentum emits continuous native scroll
 * events while easing; once the tail drains, events STOP — the rune
 * field's frameloop="demand" then renders zero frames (owner's «التوقف
 * الفوري» contract intact). No wall-clock enters any animation.
 */

import type Lenis from 'lenis'

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
 */
export function lenisScrollTo(
  target: string | number | HTMLElement,
  options: { offset?: number; immediate?: boolean } = {},
): void {
  const lenis = getLenis()
  if (lenis) {
    lenis.scrollTo(target, { offset: options.offset ?? 0, immediate: options.immediate ?? false })
  } else if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: options.immediate ? 'auto' : 'auto' })
  } else if (typeof target === 'string' && target.startsWith('#')) {
    document.querySelector(target)?.scrollIntoView()
  } else if (target instanceof HTMLElement) {
    target.scrollIntoView()
  }
}
