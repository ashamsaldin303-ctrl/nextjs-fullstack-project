'use client'

import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { cn } from '@/lib/utils'

/**
 * N8 (REF-3 T3) — proximity dot-grid, the no-WebGL compensation layer.
 *
 * When WebGL is unavailable the hero's Three.js canvas is replaced by
 * this Canvas-2D field (Crafted §3.5 mechanics): a 36px dot lattice where
 * dots within 140px of the pointer are gently repelled and tinted
 * emerald, each frame easing toward its target with LERP 0.15.
 *
 * FREEZE CONTRACT (machine-provable): the rAF loop exists ONLY while
 * dots are unsettled — pointer movement wakes it, and it parks itself
 * (raf=0) the frame every offset is within EPS of its target. An idle
 * pointer with pushed dots = settled = ZERO frames. pointerleave
 * targets 0 → one wake → settle → park. No timers, no observers beyond
 * ResizeObserver (rebuild only on real size change).
 *
 * Reduced motion: the grid renders STATIC (drawn once per resize, no
 * pointer listeners) — the tier's resting state, honoring the
 * "reduced = static final state" house rule.
 *
 * Pointer source: the closest <section> (the canvas layer itself is
 * pointer-transparent so it never steals events from real content).
 */

const SPACING = 36 // px — lattice pitch (report §3.5)
const RADIUS = 140 // px — emerald proximity horizon
const LERP = 0.15 // per-frame easing factor
const MAX_PUSH = 11 // px displacement magnitude at the pointer center
const EPS = 0.06 // "settled" threshold per axis

// Palette — base dots read as faint starlight on the #08080A deep hero;
// the proximity tint is the brand emerald (#34A853).
const BASE_RGB = [241, 245, 249] as const
const BASE_ALPHA = 0.13
const EMERALD_RGB = [52, 168, 83] as const
const BASE_R = 1.1 // dot radius, px
const MAX_R = 2.5 // dot radius at full proximity

interface Dot {
  x: number
  y: number
  ox: number // current offset x
  oy: number // current offset y
  tx: number // target offset x
  ty: number // target offset y
}

export function DotGridField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dots: Dot[] = []
    let w = 0
    let h = 0
    let raf = 0
    let pointerInside = false
    let px = -1
    let py = -1

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      if (pointerInside) {
        // One soft emerald aura under the pointer (single radial
        // gradient, painted before the dots).
        const g = ctx.createRadialGradient(px, py, 0, px, py, RADIUS)
        g.addColorStop(0, 'rgba(52,168,83,0.10)')
        g.addColorStop(1, 'rgba(52,168,83,0)')
        ctx.fillStyle = g
        ctx.fillRect(px - RADIUS, py - RADIUS, RADIUS * 2, RADIUS * 2)
      }
      for (const d of dots) {
        const dx = d.x + d.ox - px
        const dy = d.y + d.oy - py
        const dist = pointerInside ? Math.hypot(dx, dy) : Infinity
        const t = dist < RADIUS ? 1 - dist / RADIUS : 0
        const r = BASE_R + (MAX_R - BASE_R) * t
        if (t > 0.02) {
          const k = t * t // Schlick-ish ease for the color ramp
          const cr = BASE_RGB[0] + (EMERALD_RGB[0] - BASE_RGB[0]) * k
          const cg = BASE_RGB[1] + (EMERALD_RGB[1] - BASE_RGB[1]) * k
          const cb = BASE_RGB[2] + (EMERALD_RGB[2] - BASE_RGB[2]) * k
          ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${(BASE_ALPHA + 0.5 * k).toFixed(3)})`
        } else {
          ctx.fillStyle = `rgba(${BASE_RGB[0]},${BASE_RGB[1]},${BASE_RGB[2]},${BASE_ALPHA})`
        }
        ctx.beginPath()
        ctx.arc(d.x + d.ox, d.y + d.oy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const rebuild = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dots = []
      for (let y = SPACING / 2; y < h; y += SPACING) {
        for (let x = SPACING / 2; x < w; x += SPACING) {
          dots.push({ x, y, ox: 0, oy: 0, tx: 0, ty: 0 })
        }
      }
      draw()
    }

    const recomputeTargets = () => {
      for (const d of dots) {
        if (!pointerInside) {
          d.tx = 0
          d.ty = 0
          continue
        }
        const dx = d.x - px
        const dy = d.y - py
        const dist = Math.hypot(dx, dy)
        if (dist < RADIUS && dist > 0.001) {
          const strength = MAX_PUSH * Math.pow(1 - dist / RADIUS, 2)
          d.tx = (dx / dist) * strength
          d.ty = (dy / dist) * strength
        } else {
          d.tx = 0
          d.ty = 0
        }
      }
    }

    const tick = () => {
      let settled = true
      for (const d of dots) {
        d.ox += (d.tx - d.ox) * LERP
        d.oy += (d.ty - d.oy) * LERP
        if (
          Math.abs(d.tx - d.ox) > EPS ||
          Math.abs(d.ty - d.oy) > EPS
        ) {
          settled = false
        }
      }
      draw()
      if (settled) {
        raf = 0 // parked: zero frames until the next wake event
        return
      }
      raf = requestAnimationFrame(tick)
    }
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const ro = new ResizeObserver(() => {
      rebuild()
      if (reduced) return
      recomputeTargets()
      wake()
    })
    ro.observe(canvas)

    rebuild()

    if (reduced) {
      // Static tier: the lattice is painted (rebuild/draw above); no
      // pointer physics, no loop, no listeners.
      return () => ro.disconnect()
    }

    // Pointer source: the section that owns this layer (the canvas is
    // pointer-transparent; events land on the section's real content).
    const zone = canvas.closest('section') ?? canvas.parentElement
    let moveRaf = 0
    let mx = 0
    let my = 0
    const applyMove = () => {
      moveRaf = 0
      const rect = canvas.getBoundingClientRect()
      mx = mx - rect.left
      my = my - rect.top
      px = mx
      py = my
      recomputeTargets()
      wake()
    }
    const onMove = (e: PointerEvent) => {
      mx = e.clientX
      my = e.clientY
      if (!moveRaf) moveRaf = requestAnimationFrame(applyMove)
    }
    const onEnter = () => {
      pointerInside = true
    }
    const onLeave = () => {
      pointerInside = false
      recomputeTargets()
      wake()
    }

    zone?.addEventListener('pointermove', onMove, { passive: true })
    zone?.addEventListener('pointerenter', onEnter, { passive: true })
    zone?.addEventListener('pointerleave', onLeave, { passive: true })

    return () => {
      zone?.removeEventListener('pointermove', onMove)
      zone?.removeEventListener('pointerenter', onEnter)
      zone?.removeEventListener('pointerleave', onLeave)
      if (moveRaf) cancelAnimationFrame(moveRaf)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  )
}
