'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

const subscribeNoop = () => () => {}
// Quick win (prompt §8.2): dynamic year — the client snapshot keeps the
// LIVE clock, so the footer rolls over at midnight on New Year's Eve
// with no redeploy.
const getYear = () => new Date().getFullYear()

// AUDIT-C3 (LOW, year-rollover): the SERVER snapshot must be a constant,
// not the live clock. Captured once at module-eval time — on the server
// that is prerender/build time for static pages (in dev: process start,
// since the dev server loads this module once per process), on the
// client it is page-load time. Returning this frozen stamp from
// getServerSnapshot keeps the server snapshot value-STABLE across the
// multiple calls React may make during one hydration pass (the
// useSyncExternalStore contract) — a live clock technically re-reads
// time on every call. Residual, documented: after a build→load year
// rollover the client evaluates its own BUILD_YEAR at page-load, so the
// hydration text comparison can still see build-year HTML vs live-year
// render — React's post-hydration store sync then lands on the live
// year (annual, self-healing, exactly the LOW C3 rated). Eliminating it
// entirely would require the year inlined into the client bundle at
// build time (env/config change — outside this component's scope).
const BUILD_YEAR = new Date().getFullYear()

/** Server snapshot — the frozen BUILD_YEAR stamp (see above). */
const getBuildYear = () => BUILD_YEAR

/**
 * Client island for the server-rendered footer (L6-R6 P3): the ~220
 * lines of footer markup are static and now render on the server —
 * only this one sentence needs the runtime clock. useSyncExternalStore
 * serves a constant module-eval-year stamp on the server side while the
 * client reads the real year — and avoids setState-in-effect cascading
 * renders. Everything else in the footer that needs interactivity
 * (LiveClock) is already its own client component.
 */
export function CopyrightYear() {
  const t = useTranslations('footer')
  const year = useSyncExternalStore(subscribeNoop, getYear, getBuildYear)
  // AUDIT-C4 (LOW sibling — B9's calculator pattern): pass the year as a
  // STRING param — next-intl inserts string params verbatim, so the
  // numeral presentation is pinned Latin (String() of a number) instead
  // of being re-formatted through the message locale, whose bare-'ar'
  // numeral resolution is engine-dependent (Safari/JSC CLDR risk).
  return <>{t('rights', { year: String(year) })}</>
}
