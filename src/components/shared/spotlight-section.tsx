'use client'

import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Spotlight section wrapper (Phase 4 WS-3, prompt §6).
 *
 * Applies the `.elyra-spotlight` class and tracks pointer movement to set
 * `--mx/--my` CSS variables — revealing a faint Blueprint grid (10%
 * opacity after Phase 5 P0-2 fix) beneath the section via a
 * mouse-following radial mask.
 *
 * Touch / reduced-motion: the CSS falls back to a static faint grid
 * (no cursor tracking) — see globals.css media guards.
 *
 * Phase 5 P0-2 fix: add `spotlight-active` class on first pointer move
 * so the grid transitions from its dim default (0.6 opacity) to full
 * reveal (1.0). Without this, the grid was invisible until mousemove,
 * and even then it was too faint (4% alpha) for VLM detection.
 */
export function SpotlightSection({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const activatedRef = useRef(false)

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
    if (!activatedRef.current) {
      activatedRef.current = true
      el.classList.add('spotlight-active')
    }
  }, [])

  return (
    <section
      ref={ref}
      onPointerMove={onPointerMove}
      className={cn('elyra-spotlight', className)}
    >
      {children}
    </section>
  )
}
