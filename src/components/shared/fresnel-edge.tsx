'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * N9 (REF-3 T2) — Fresnel gold edge, pointer half.
 *
 * Server components (services/websites types, services/automation
 * integrations) wrap their luxury spec cards in this client shell; it
 * writes three CSS custom properties consumed by the `.fresnel-edge`
 * paint layer in globals.css:
 *   · --fx / --fy — pointer position as % of the card box (drives the
 *     spotlight's center → "the angle computed by hover", Schlick
 *     R₀=0.82-flavored falloff lives in the gradient stops)
 *   · --fi        — 1 on pointerenter, 0 on pointerleave (the ring's
 *     opacity; the CSS eases it 0.45s so leaving is soft)
 *
 * Freeze-contract notes: event-driven only (no loops, no timers beyond
 * one rAF coalescer); the sleep state is --fi:0 which paints NOTHING
 * (opacity 0 → no repaints while idle). Fine-pointer only — a touch
 * tap would pin a misleading glow spot. Reduced-motion: positional
 * pointer-follow, not an animation — safe to keep (same class as the
 * magnet hooks); the CSS kill-switch collapses the opacity transition.
 *
 * AUDIT-A5 NIT (fix 10, MODEL-5 discipline): the pointer→% math reads
 * layout, so the card rect is CACHED — captured on arm and refreshed
 * on pointerenter / window resize — instead of re-reading
 * getBoundingClientRect on every pointermove (a forced layout per
 * move; previously only the style WRITE was rAF-coalesced). The move
 * handler now derives live values purely from the cached box.
 */
export function FresnelEdge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Touch devices never arm the effect (the ring stays invisible).
    if (!window.matchMedia('(pointer: fine)').matches) return

    let raf = 0
    let px = 0
    let py = 0
    // The cached card box (fix 10 — see header note).
    let rect = el.getBoundingClientRect()

    const apply = () => {
      raf = 0
      el.style.setProperty('--fx', `${px.toFixed(1)}%`)
      el.style.setProperty('--fy', `${py.toFixed(1)}%`)
    }

    const onMove = (e: PointerEvent) => {
      px = ((e.clientX - rect.left) / rect.width) * 100
      py = ((e.clientY - rect.top) / rect.height) * 100
      if (raf) return
      raf = requestAnimationFrame(apply)
    }
    const onEnter = () => {
      // Refresh the cache as the pointer arrives — the exact sync point
      // (scroll/resize may have moved the card since the last capture).
      rect = el.getBoundingClientRect()
      el.style.setProperty('--fi', '1')
    }
    const onLeave = () => {
      el.style.setProperty('--fi', '0')
    }
    const onResize = () => {
      rect = el.getBoundingClientRect()
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerenter', onEnter, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={ref} className={cn('fresnel-edge', className)}>
      {children}
    </div>
  )
}
