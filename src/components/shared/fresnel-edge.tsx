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

    const apply = () => {
      raf = 0
      el.style.setProperty('--fx', `${px.toFixed(1)}%`)
      el.style.setProperty('--fy', `${py.toFixed(1)}%`)
    }

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      px = ((e.clientX - rect.left) / rect.width) * 100
      py = ((e.clientY - rect.top) / rect.height) * 100
      if (raf) return
      raf = requestAnimationFrame(apply)
    }
    const onEnter = () => {
      el.style.setProperty('--fi', '1')
    }
    const onLeave = () => {
      el.style.setProperty('--fi', '0')
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerenter', onEnter, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={ref} className={cn('fresnel-edge', className)}>
      {children}
    </div>
  )
}
