'use client'

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/**
 * CustomCursor — R7-b "Sensory Polish Layer". Supersedes the Phase 2
 * MagneticCursor: a 7px dot + 34px trailing ring, both difference-blended
 * so they invert over any background (dark hero AND light sections).
 *
 * Architecture (codebase rAF conventions — see use-cursor-velocity.ts):
 *   · ONE permanent rAF loop lerps both layers. Transforms are written
 *     straight to the DOM via refs — never through React state, never a
 *     re-render per frame — and only when a value moved >0.01px, so an
 *     idle pointer costs a few arithmetic ops per frame. (Chosen over
 *     cancel/reschedule: one self-sustaining loop is simpler and cannot
 *     deschedule itself into a frozen cursor.)
 *   · Each layer is a POSITIONER (per-frame translate3d + difference
 *     blend) wrapping a visual CORE (CSS-transitioned ~220ms scale) plus,
 *     for the ring, a LABEL span. Splitting position from scale is what
 *     lets hover growth ease via CSS without the per-frame position
 *     writes also being eased into mush.
 *   · mix-blend-mode: difference lives on the WRAPPER layer — NOT on the
 *     positioners. A `position:fixed; z-index` wrapper creates a stacking
 *     context that isolates any blend set on its children (pixel-probe
 *     verified: the white dot stayed pure white and vanished over the light
 *     page). On the wrapper itself the blend is NOT isolated, so the whole
 *     group (dot + ring + label) inverts as one against the page beneath.
 *
 * Interaction states, all via classList on the positioners (CSS owns the
 * transitions; JS never writes scale/opacity inline):
 *   · is-hover  — pointer over `a, button, [role="button"], [data-cursor],
 *                 input, textarea, select, label`, tracked by event
 *                 delegation on document (pointerover/pointerout with a
 *                 relatedTarget check, so moving between an element's own
 *                 children does not flicker): ring 1.9× + brighter border,
 *                 dot 0.4×. `[data-cursor]` (any value) extends the task's
 *                 `[data-cursor="magnet"]` so the site-wide Phase 5 WS-7
 *                 affordance markers (zoom / inspect / external / rotate /
 *                 drag / preview) keep working.
 *   · is-label  — the hovered element carries data-cursor-label, or a
 *                 known data-cursor context resolved from common.cursor.*
 *                 (explicit attribute always wins; `magnet` maps to "" —
 *                 no label, matching the Phase 2 chip behavior): the ring
 *                 grows to ~72px with a faint fill and the label centers
 *                 inside it (dir=auto — Arabic safe).
 *   · is-press  — pointerdown squeeze (0.85×) until pointerup/cancel.
 *   · is-hidden — until the first pointermove, and whenever the pointer
 *                 leaves the document (200ms opacity fade).
 *
 * Enabled only when matchMedia('(pointer: fine)') matches AND motion is
 * allowed (reactive: toggling either mid-session mounts/unmounts the
 * layers). SSR renders null — no hydration mismatch, no FOUC. A non-mouse
 * pointerdown (touch gesture on a hybrid device) tears the whole engine
 * down for the session: the native cursor returns, no ghost layers.
 */

const DOT_LERP = 0.4
const RING_LERP = 0.16
/** Sub-pixel threshold below which a layer's transform is not rewritten. */
const MOVE_EPSILON = 0.01

const INTERACTIVE =
  'a, button, [role="button"], [data-cursor], input, textarea, select, label'

// Phase 5 WS-7 contexts — label fallback from common.cursor.* when an
// element carries only `data-cursor` (no explicit data-cursor-label).
type CursorContext =
  | 'magnet'
  | 'rotate'
  | 'preview'
  | 'drag'
  | 'zoom'
  | 'inspect'
  | 'external'

const CONTEXTS: ReadonlySet<string> = new Set([
  'magnet',
  'rotate',
  'preview',
  'drag',
  'zoom',
  'inspect',
  'external',
])

/* (pointer: fine) via useSyncExternalStore — the exact pattern of
 * use-reduced-motion.ts: a module-level MQL singleton (matchMedia
 * allocates on every call) + a false server snapshot, so SSR renders null
 * (cursor disabled) and hydration stays deterministic while the real
 * value — reactive, mouse plugged in mid-session — arrives right after. */
let fineMql: MediaQueryList | null = null

function getFineMql(): MediaQueryList | null {
  if (typeof window === 'undefined') return null
  if (!fineMql) fineMql = window.matchMedia('(pointer: fine)')
  return fineMql
}

function subscribeFinePointer(onChange: () => void): () => void {
  const mq = getFineMql()
  if (!mq) return () => {}
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getFinePointerSnapshot(): boolean {
  return getFineMql()?.matches ?? false
}

function getFinePointerServerSnapshot(): boolean {
  return false
}

function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribeFinePointer,
    getFinePointerSnapshot,
    getFinePointerServerSnapshot,
  )
}

export function CustomCursor() {
  const t = useTranslations('common.cursor')
  const reduced = usePrefersReducedMotion()
  const finePointer = useFinePointer()

  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  // Resolve context labels once per locale — stable identity keeps the
  // engine effect from re-initializing on every render (same memo pattern
  // as the Phase 2 cursor).
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

  const enabled = finePointer && !reduced

  useEffect(() => {
    if (!enabled) return
    const dot = dotRef.current
    const ring = ringRef.current
    const label = labelRef.current
    if (!dot || !ring || !label) return

    const root = document.documentElement
    // The native cursor is hidden (html.elyra-cursor-active, globals.css)
    // only at the FIRST real pointermove — see onPointerMove. If the
    // embedding environment never delivers pointer events (some preview
    // panels / streamed frames), the user keeps a working native cursor
    // instead of none at all.

    let disposed = false
    let killed = false // touch gesture seen — session-wide disable
    let raf = 0
    let hasMoved = false
    let currentHit: Element | null = null

    const pointer = { x: 0, y: 0 }
    const dotPos = { x: 0, y: 0 }
    const ringPos = { x: 0, y: 0 }
    // Last values actually written to the DOM — NaN forces the first write.
    let dotWX = Number.NaN
    let dotWY = Number.NaN
    let ringWX = Number.NaN
    let ringWY = Number.NaN

    const hitFrom = (target: EventTarget | null): Element | null =>
      target instanceof Element ? target.closest(INTERACTIVE) : null

    const applyHit = (hit: Element | null) => {
      if (hit) {
        dot.classList.add('is-hover')
        ring.classList.add('is-hover')
        // Explicit data-cursor-label wins; else the WS-7 context fallback.
        const explicit = hit.getAttribute('data-cursor-label')
        const context = hit.getAttribute('data-cursor')
        const text =
          explicit ??
          (context !== null && CONTEXTS.has(context)
            ? contextLabels[context as CursorContext]
            : '')
        if (text) {
          // Skip the textContent write while the label is unchanged —
          // it only changes when the hovered element does.
          if (label.textContent !== text) label.textContent = text
          ring.classList.add('is-label')
        } else {
          ring.classList.remove('is-label')
        }
      } else {
        dot.classList.remove('is-hover')
        ring.classList.remove('is-hover', 'is-label')
      }
    }

    const onPointerOver = (e: PointerEvent) => {
      if (killed || e.pointerType !== 'mouse') return
      const hit = hitFrom(e.target)
      if (!hit || hit === currentHit) return
      currentHit = hit
      applyHit(hit)
    }

    const onPointerOut = (e: PointerEvent) => {
      if (killed || e.pointerType !== 'mouse') return
      if (!currentHit) return
      // Leaving toward somewhere still inside the same interactive
      // element (button → its own icon, …) is not a real exit.
      if (hitFrom(e.relatedTarget) === currentHit) return
      currentHit = null
      applyHit(null)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (killed || e.pointerType !== 'mouse') return
      pointer.x = e.clientX
      pointer.y = e.clientY
      if (!hasMoved) {
        hasMoved = true
        // Appear exactly at the pointer — never fly in from a corner.
        dotPos.x = pointer.x
        dotPos.y = pointer.y
        ringPos.x = pointer.x
        ringPos.y = pointer.y
        dot.classList.remove('is-hidden')
        ring.classList.remove('is-hidden')
        // First PROVEN movement — now the custom layers track, so it is
        // finally safe to hide the native cursor.
        root.classList.add('elyra-cursor-active')
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (killed) return
      if (e.pointerType !== 'mouse') {
        kill()
        return
      }
      ring.classList.add('is-press')
    }

    const onPointerUp = () => {
      ring.classList.remove('is-press')
    }

    const onMouseLeave = () => {
      dot.classList.add('is-hidden')
      ring.classList.add('is-hidden')
    }

    const onMouseEnter = () => {
      if (!hasMoved) return
      dot.classList.remove('is-hidden')
      ring.classList.remove('is-hidden')
    }

    // --- The single permanent rAF loop ---------------------------------
    const tick = () => {
      if (disposed || killed) return
      dotPos.x += (pointer.x - dotPos.x) * DOT_LERP
      dotPos.y += (pointer.y - dotPos.y) * DOT_LERP
      ringPos.x += (pointer.x - ringPos.x) * RING_LERP
      ringPos.y += (pointer.y - ringPos.y) * RING_LERP

      // NaN guard: dotWX/dotWY start as NaN, and Math.abs(x - NaN) is NaN,
      // which compares false against everything — without this guard the
      // very first write never happens and the layers stay parked at the
      // top-left corner forever (the "stuck cursor" bug).
      if (
        Number.isNaN(dotWX) ||
        Number.isNaN(dotWY) ||
        Math.abs(dotPos.x - dotWX) > MOVE_EPSILON ||
        Math.abs(dotPos.y - dotWY) > MOVE_EPSILON
      ) {
        dotWX = dotPos.x
        dotWY = dotPos.y
        dot.style.transform = `translate3d(${dotPos.x.toFixed(2)}px, ${dotPos.y.toFixed(2)}px, 0)`
      }
      if (
        Number.isNaN(ringWX) ||
        Number.isNaN(ringWY) ||
        Math.abs(ringPos.x - ringWX) > MOVE_EPSILON ||
        Math.abs(ringPos.y - ringWY) > MOVE_EPSILON
      ) {
        ringWX = ringPos.x
        ringWY = ringPos.y
        ring.style.transform = `translate3d(${ringPos.x.toFixed(2)}px, ${ringPos.y.toFixed(2)}px, 0)`
      }
      raf = requestAnimationFrame(tick)
    }

    const detach = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      root.removeEventListener('mouseleave', onMouseLeave)
      root.removeEventListener('mouseenter', onMouseEnter)
    }

    // Touch gesture on a hybrid device: hide the layers, bring the native
    // cursor back, and stop the engine for the rest of the session.
    // (Arrow-const, NOT a hoisted function declaration — TS only keeps
    // the null-guard narrowing inside closures created after the guard.)
    const kill = () => {
      if (killed || disposed) return
      killed = true
      cancelAnimationFrame(raf)
      detach()
      dot.classList.add('is-hidden')
      ring.classList.add('is-hidden')
      root.classList.remove('elyra-cursor-active')
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerUp, { passive: true })
    document.addEventListener('pointerover', onPointerOver, { passive: true })
    document.addEventListener('pointerout', onPointerOut, { passive: true })
    root.addEventListener('mouseleave', onMouseLeave)
    root.addEventListener('mouseenter', onMouseEnter)

    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      detach()
      root.classList.remove('elyra-cursor-active')
    }
  }, [enabled, contextLabels])

  if (!enabled) return null

  return (
    <div className="elyra-cursor-layer" aria-hidden="true">
      {/* Precision dot — fast lerp */}
      <div ref={dotRef} className="elyra-cursor-dot is-hidden">
        <div className="elyra-cursor-dot-core" />
      </div>
      {/* Trailing ring — slow lerp; hosts the centered label */}
      <div ref={ringRef} className="elyra-cursor-ring is-hidden">
        <div className="elyra-cursor-ring-core" />
        <span ref={labelRef} dir="auto" className="elyra-cursor-label" />
      </div>
    </div>
  )
}
