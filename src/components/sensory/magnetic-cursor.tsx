'use client'

import { useEffect, useRef } from 'react'

/**
 * Magnetic Cursor — Phase 2 "Sensory Polish Layer" (prompt §3).
 *
 * Two layers driven by ONE requestAnimationFrame loop with zero React
 * re-renders per frame — positions are written straight to the DOM via
 * refs (`transform: translate3d` + `will-change`):
 *
 *   · dot  — 6px, tracks the pointer exactly (precision);
 *   · ring — 32px, lerps at 0.2 toward the pointer (smoothness).
 *
 * When the pointer comes within MAGNET_RADIUS (~80px) of an element marked
 * `data-cursor="magnet"`, the ring scales up and snaps softly toward the
 * element's center (direction-agnostic — RTL/LTR neutral by design).
 *
 * Enabled ONLY when all of:
 *   · `matchMedia('(pointer: fine)')`  — never on touch devices;
 *   · NOT `prefers-reduced-motion`      — motion follows the pointer;
 *   · component mounted client-side     — nothing renders during SSR.
 * In every other case both layers stay invisible and the native cursor
 * remains fully intact.
 *
 * Layers carry `pointer-events: none` + `aria-hidden` and live ABOVE the
 * Radix Sheet/Dialog overlays (z-50): the native cursor is hidden while
 * active, so the custom cursor must remain visible over modals too.
 */

const DOT_SIZE = 6
const RING_SIZE = 32
const RING_LERP = 0.2
const SCALE_LERP = 0.18
const MAGNET_RADIUS = 80
const MAGNET_SCALE = 1.5
const PRESS_SCALE = 0.82

export function MagneticCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dot = dotRef.current
    const ring = ringRef.current
    const chip = chipRef.current
    if (!dot || !ring || !chip) return

    // --- Activation guards (prompt §3.1–§3.4) ---------------------------
    const finePointer = window.matchMedia('(pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!finePointer.matches || reducedMotion.matches) return

    let disposed = false
    let rafId = 0
    let magnetRefreshRaf = 0
    let mutationDebounce = 0

    // Show the layers + hide the native cursor (CSS guard inside
    // globals.css only applies within `pointer: fine` + `no-preference`).
    dot.classList.add('elyra-cursor--visible')
    ring.classList.add('elyra-cursor--visible')
    document.documentElement.classList.add('elyra-cursor-active')

    // --- State (plain values — no React state in the animation loop) ----
    const mouse = { x: -100, y: -100 }
    const ringPos = { x: -100, y: -100 }
    let ringScale = 1
    let targetScale = 1
    let pressed = false
    let visible = false

    type Magnet = { el: Element; x: number; y: number; label: string }
    let magnets: Magnet[] = []

    const refreshMagnets = () => {
      magnets = Array.from(document.querySelectorAll('[data-cursor]')).map((el) => {
        const r = el.getBoundingClientRect()
        return {
          el,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          label: el.getAttribute('data-cursor-label') || '',
        }
      })
    }

    const scheduleMagnetRefresh = () => {
      if (magnetRefreshRaf) return
      magnetRefreshRaf = requestAnimationFrame(() => {
        magnetRefreshRaf = 0
        refreshMagnets()
      })
    }

    refreshMagnets()

    // Keep the magnet list fresh across client-side navigations and
    // dialogs (debounced MutationObserver on body subtree).
    const observer = new MutationObserver(() => {
      window.clearTimeout(mutationDebounce)
      mutationDebounce = window.setTimeout(refreshMagnets, 150)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // --- Input handlers ---------------------------------------------------
    const onPointerMove = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      if (!visible) {
        visible = true
        // Snap the ring to the pointer on first appearance (no fly-in).
        ringPos.x = mouse.x
        ringPos.y = mouse.y
        dot.classList.add('elyra-cursor--visible')
        ring.classList.add('elyra-cursor--visible')
      }
    }

    const onLeave = () => {
      visible = false
      dot.classList.remove('elyra-cursor--visible')
      ring.classList.remove('elyra-cursor--visible')
    }

    const onEnter = () => {
      if (mouse.x >= 0) {
        visible = true
        dot.classList.add('elyra-cursor--visible')
        ring.classList.add('elyra-cursor--visible')
      }
    }

    const onDown = () => {
      pressed = true
    }
    const onUp = () => {
      pressed = false
    }

    // --- The single rAF loop (prompt §3.3) --------------------------------
    const tick = () => {
      if (disposed) return

      // Nearest magnet within radius (center distance — direction-neutral).
      let magnet: Magnet | null = null
      let bestDist = MAGNET_RADIUS
      for (const m of magnets) {
        const dx = m.x - mouse.x
        const dy = m.y - mouse.y
        const dist = Math.hypot(dx, dy)
        if (dist < bestDist) {
          bestDist = dist
          magnet = m
        }
      }

      const targetX = magnet ? magnet.x : mouse.x
      const targetY = magnet ? magnet.y : mouse.y
      targetScale = (magnet ? MAGNET_SCALE : 1) * (pressed ? PRESS_SCALE : 1)

      ringPos.x += (targetX - ringPos.x) * RING_LERP
      ringPos.y += (targetY - ringPos.y) * RING_LERP
      ringScale += (targetScale - ringScale) * SCALE_LERP

      dot.style.transform = `translate3d(${mouse.x - DOT_SIZE / 2}px, ${mouse.y - DOT_SIZE / 2}px, 0)`
      ring.style.transform = `translate3d(${ringPos.x - RING_SIZE / 2}px, ${ringPos.y - RING_SIZE / 2}px, 0) scale(${ringScale.toFixed(3)})`

      // WS-2: contextual text chip — follows the ring with an offset.
      if (magnet && magnet.label) {
        chip.textContent = magnet.label
        chip.style.transform = `translate3d(${ringPos.x + 20}px, ${ringPos.y + 8}px, 0)`
        chip.style.opacity = '1'
      } else {
        chip.style.opacity = '0'
      }

      rafId = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onUp, { passive: true })
    window.addEventListener('scroll', scheduleMagnetRefresh, { passive: true, capture: true })
    window.addEventListener('resize', scheduleMagnetRefresh, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    document.documentElement.addEventListener('mouseenter', onEnter)

    rafId = requestAnimationFrame(tick)

    // Also react to reduced-motion being toggled while the page is open.
    const onReducedChange = (e: MediaQueryListEvent) => {
      if (e.matches) onLeave()
    }
    reducedMotion.addEventListener('change', onReducedChange)

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      cancelAnimationFrame(magnetRefreshRaf)
      window.clearTimeout(mutationDebounce)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('scroll', scheduleMagnetRefresh, { capture: true })
      window.removeEventListener('resize', scheduleMagnetRefresh)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      document.documentElement.removeEventListener('mouseenter', onEnter)
      reducedMotion.removeEventListener('change', onReducedChange)
      dot.classList.remove('elyra-cursor--visible')
      ring.classList.remove('elyra-cursor--visible')
      document.documentElement.classList.remove('elyra-cursor-active')
    }
  }, [])

  return (
    <>
      {/* Precision dot */}
      <div
        ref={dotRef}
        aria-hidden="true"
        className="elyra-cursor elyra-cursor-dot"
      />
      {/* Smooth ring */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="elyra-cursor elyra-cursor-ring"
      />
      {/* WS-2: contextual text chip */}
      <div
        ref={chipRef}
        aria-hidden="true"
        className="elyra-cursor elyra-cursor-chip"
      />
    </>
  )
}
