'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

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
 * Phase 5 WS-7: extended context chip. Elements with `data-cursor="zoom"`
 * (or `inspect` / `external`) get a translated chip with the context's
 * label unless they override via `data-cursor-label`. The default labels
 * come from the common.cursor.* i18n catalog (AR/EN).
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

// Phase 5 WS-7: the four pre-existing contexts + three new ones. Each
// resolves to a translated chip label from common.cursor.*.
type CursorContext = 'magnet' | 'rotate' | 'preview' | 'drag' | 'zoom' | 'inspect' | 'external'
const ALL_CONTEXTS: ReadonlyArray<CursorContext> = ['magnet', 'rotate', 'preview', 'drag', 'zoom', 'inspect', 'external']

export function MagneticCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('common.cursor')
  // FIX(2-c/6): reduced-motion as React state — the engine effect depends
  // on it, so toggling the preference mid-session fully tears down the
  // rAF loop, listeners and MutationObserver (and re-initializes if the
  // user turns motion back on).
  const reduced = usePrefersReducedMotion()

  // Resolve context labels ONCE per render — they don't change at runtime.
  // Empty string for `magnet` keeps the chip hidden (no label for plain
  // magnets — the ring scale-up is the only feedback). Wrapped in useMemo
  // so the object identity is stable across renders (the useEffect deps
  // array uses this object — without memo, every render creates a new
  // object and re-triggers the effect).
  const contextLabels = useMemo<Record<CursorContext, string>>(
    () => ({
      magnet: t('magnet'),
      rotate: t('rotate'),
      preview: t('preview'),
      drag: t('drag'),
      zoom: t('zoom'),
      inspect: t('inspect'),
      external: t('external'),
    }),
    [t],
  )

  useEffect(() => {
    const dot = dotRef.current
    const ring = ringRef.current
    const chip = chipRef.current
    if (!dot || !ring || !chip) return

    // --- Activation guards (prompt §3.1–§3.4) ---------------------------
    const finePointer = window.matchMedia('(pointer: fine)')
    if (!finePointer.matches || reduced) return

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
    // FIX(2-c/6): last chip label written to the DOM — skip the
    // textContent write while hovering a labeled magnet (it ran EVERY
    // frame before; the label only changes when the magnet does).
    let lastChipLabel: string | null = null

    const refreshMagnets = () => {
      magnets = Array.from(document.querySelectorAll('[data-cursor]')).map((el) => {
        const r = el.getBoundingClientRect()
        // Phase 5 WS-7: per-element label takes precedence; otherwise
        // resolve the label from the context's catalog key. Elements
        // with `data-cursor="magnet"` get an empty string (no chip).
        const explicitLabel = el.getAttribute('data-cursor-label')
        const context = el.getAttribute('data-cursor') as CursorContext | null
        const label =
          explicitLabel ??
          (context && ALL_CONTEXTS.includes(context) ? contextLabels[context] : '') ??
          ''
        return {
          el,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          label,
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
      // Phase 5 WS-7: now context-aware (zoom/inspect/external) when
      // data-cursor-label isn't explicitly set.
      if (magnet && magnet.label) {
        if (magnet.label !== lastChipLabel) {
          chip.textContent = magnet.label
          lastChipLabel = magnet.label
        }
        // RTL/LTR neutral offset — chip appears on the ring's right side
        // in LTR, left in RTL (handled by dir=auto on the chip element).
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
      dot.classList.remove('elyra-cursor--visible')
      ring.classList.remove('elyra-cursor--visible')
      document.documentElement.classList.remove('elyra-cursor-active')
    }
  }, [contextLabels, reduced])

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
      {/* WS-2: contextual text chip — dir=auto so RTL/LTR flips */}
      <div
        ref={chipRef}
        aria-hidden="true"
        dir="auto"
        className="elyra-cursor elyra-cursor-chip"
      />
    </>
  )
}
