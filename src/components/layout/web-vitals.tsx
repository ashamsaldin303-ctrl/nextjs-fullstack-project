'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'

/** Inferred from the hook's own callback signature (avoids deep imports). */
type Metric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0]

/**
 * WebVitalsReporter — client RUM beacon (F-S3-06 / F-S4-02 — gold-standard
 * audit: "no production CWV measurements — only dev Lighthouse").
 *
 * Renders NOTHING. Mounted once in the root layout; Next's
 * useReportWebVitals hook reports LCP / INP / CLS / TTFB / FCP whenever a
 * metric finalizes. Delivery design:
 *
 *   - One beacon per metric NAME per page load (a Map keyed by name —
 *     web-vitals fires some metrics more than once as they settle; the
 *     FINAL report is what the collector wants, and the last write before
 *     unload wins in the map).
 *   - sendBeacon (fire-and-forget, survives tab close) with a fetch
 *     fallback for browsers without it; body ≈ 300 bytes, zero PII
 *     (name/value/rating/random id/navigationType/path-only route).
 *   - Also flushes on visibilitychange→hidden (the standard RUM unload
 *     beat) so late-settling LCP/INP values are not lost.
 *   - Silent failure by contract — a RUM outage must never touch UX.
 */

interface BeaconMetric {
  name: string
  value: number
  rating: string
  id: string
  navigationType: string
}

/** The collector's contract is the 5 core CWV (api/vitals METRIC_NAMES).
 * Next's useReportWebVitals ALSO reports custom metrics —
 * Next.js-hydration / -render / -route-change-to-render — which the strict
 * server schema rejects. Unfiltered, one custom metric riding the
 * visibilitychange batch poisons the WHOLE beacon (live 400s in dev.log:
 * every late-settling LCP/INP/CLS sample dropped with it). */
const CORE_VITALS = new Set(['LCP', 'INP', 'CLS', 'TTFB', 'FCP'])

export function WebVitalsReporter() {
  const pathname = usePathname() || '/'
  /** Final metric per name for THIS page load (route-scoped via key). */
  const pending = useRef(new Map<string, BeaconMetric>())
  /** Guards the visibilitychange flush against duplicate sends per route. */
  const flushed = useRef(false)

  const send = useCallback(
    (metrics: BeaconMetric[]) => {
      if (metrics.length === 0) return
      try {
        const body = JSON.stringify({
          route: pathname,
          metrics: metrics.map(({ name, value, rating, id, navigationType }) => ({
            name,
            value: Math.round(value * 1000) / 1000,
            rating,
            id: id.slice(0, 64),
            navigationType: navigationType.slice(0, 24),
          })),
        })
        if (typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon('/api/vitals', new Blob([body], { type: 'application/json' }))
        } else {
          void fetch('/api/vitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
          }).catch(() => {})
        }
      } catch {
        /* silent by contract */
      }
    },
    [pathname],
  )

  const onReport = useCallback(
    (metric: Metric) => {
      // Core CWV only — see CORE_VITALS note above.
      if (!CORE_VITALS.has(metric.name)) return

      // LCP/CLS settle progressively — keep the LATEST value; the flush
      // sends whatever the map holds at that moment.
      pending.current.set(metric.name, {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        navigationType: metric.navigationType ?? '',
      })

      // Terminal metrics flush immediately (TTFB/FCP finalize early and
      // would otherwise wait for the unload beat).
      if (metric.name === 'TTFB' || metric.name === 'FCP') {
        const early = pending.current.get(metric.name)
        if (early) {
          pending.current.delete(metric.name)
          send([early])
        }
      }
    },
    [send],
  )

  useReportWebVitals(onReport)

  // Route changed (client navigation) — a new page load means a fresh
  // metric set; drop the previous pending map and re-arm the flush.
  useEffect(() => {
    pending.current.clear()
    flushed.current = false
  }, [pathname])

  // The standard RUM unload beat: late-settling LCP/INP ride the
  // visibilitychange→hidden transition instead of being lost.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== 'hidden' || flushed.current) return
      flushed.current = true
      const batch = [...pending.current.values()]
      pending.current.clear()
      send(batch)
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [send])

  return null
}
