'use client'

import { useEffect, useRef } from 'react'
import { useIsRtl } from '@/lib/use-rtl'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { cn } from '@/lib/utils'

/**
 * ScrollProgress — a 3px brand-gradient progress bar pinned to the very top
 * of the viewport (R2: "scroll animations across the whole site"). Every
 * pixel of scroll is answered with instant, continuous visual feedback —
 * the same scroll-linked language as the deconstructed work card.
 *
 * Discipline:
 *   - transform-only (scaleX) on a compositor layer, zero layout work;
 *   - rAF-coalesced scroll listener (one listener per page, one read);
 *   - W2-01 (scrub:1 translation): the written value is lerp-smoothed
 *     toward the raw scrollbar position (the same premium "scrub"
 *     translation as methodology's shared spring) with a flush-jump
 *     guard so anchor jumps land immediately instead of swimming; the
 *     loop self-schedules only while unsettled (never free-running);
 *   - RTL-aware origin (grows from the right edge in Arabic, left in
 *     English — reads as "distance covered from the start");
 *   - reduced-motion → not rendered (continuous feedback is motion);
 *   - aria-hidden — purely decorative.
 */

/** W2-01 — per-frame easing factor toward the target progress. */
const LERP = 0.12
/** W2-01 — flush-jump threshold: gaps beyond this snap to target. */
const FLUSH_JUMP = 0.5
/** W2-01 — settled when |target − current| is under this (stop the loop). */
const SETTLE_EPSILON = 0.0005

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null)
  const rtl = useIsRtl()
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    let rafId = 0
    // W2-01: `cur` is the DISPLAYED progress (lerped); `p` below is the raw
    // scrollbar position. `null` until the first read so the first frame
    // snaps to the restored scroll position instead of swimming in from 0.
    let cur: number | null = null
    const apply = () => {
      rafId = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      // Flush-jump guard: a huge gap (anchor jumps > 50% of the page) snaps
      // `cur` to the target first, so the bar arrives within ≤2 frames of an
      // anchor click instead of easing across half the document.
      if (cur === null || Math.abs(p - cur) > FLUSH_JUMP) cur = p
      cur += (p - cur) * LERP
      el.style.transform = `scaleX(${cur.toFixed(4)})`
      // Keep easing toward the target while unsettled; a fresh scroll event
      // re-arms via requestUpdate anyway (loop stops once settled).
      if (Math.abs(p - cur) > SETTLE_EPSILON) requestUpdate()
    }
    const requestUpdate = () => {
      if (!rafId) rafId = requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [reduced])

  if (reduced) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]"
    >
      <div
        ref={ref}
        className={cn(
          'h-full w-full bg-gradient-to-r from-primary via-g-blue to-g-green',
          rtl ? 'origin-right' : 'origin-left'
        )}
        style={{ transform: 'scaleX(0)', willChange: 'transform' }}
      />
    </div>
  )
}
