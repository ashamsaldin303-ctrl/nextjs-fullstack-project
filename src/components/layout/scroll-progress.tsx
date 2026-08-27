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
 *   - RTL-aware origin (grows from the right edge in Arabic, left in
 *     English — reads as "distance covered from the start");
 *   - reduced-motion → not rendered (continuous feedback is motion);
 *   - aria-hidden — purely decorative.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null)
  const rtl = useIsRtl()
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    let rafId = 0
    const apply = () => {
      rafId = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      el.style.transform = `scaleX(${p.toFixed(4)})`
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
