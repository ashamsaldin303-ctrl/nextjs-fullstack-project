'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { useMobileTier } from '@/lib/use-mobile-tier'
import { probeWebGL } from '@/lib/use-webgl'
import { runePresetKeyForPath, type RunePresetKey } from './rune-presets'

/**
 * Edge Rune (R4) — the fixed corner sigil mounted ONCE in [locale]/layout,
 * between the footer and the sensory layer. This root component is the
 * GATEKEEPER: it stays out of the three.js chunk boundary entirely (only
 * hooks + next/dynamic here) and mounts the scene only when every gate
 * passes — see rune-scene.tsx for the WebGL core.
 *
 * Gates (spec §4.7, exact three-d-section/hero-canvas patterns):
 * 1. prefers-reduced-motion → NOTHING mounts (the sigil is pure decor —
 *    reduced-motion users lose zero function).
 * 2. Mobile tier (useMobileTier: <768px / coarse pointer) → nothing mounts.
 *    NOTE: this is a NEW, explicit product decision for the rune (the edge
 *    is too narrow to spend a live GL context there) — NOT the site-wide
 *    policy: hero-canvas legitimately runs a lighter tier on phones.
 * 3. requestIdleCallback (2.5s timeout fallback) before the three.js chunk
 *    is even fetched — LCP-neutral on internal pages that otherwise ship
 *    zero WebGL.
 * 4. probeWebGL() (module-memoized, rAF-deferred) → hide entirely, no
 *    fallback gradient (not a hero; an empty corner must stay empty).
 * 5. document visibilitychange → frameloop 'never' while hidden.
 *
 * Stacking: z-[5] — above unpositioned section content, below the navbar
 * (50), intro curtain (80), grain (90) and cursor (200). pointer-events
 * none + aria-hidden: pure decoration, clicks always fall through (G8).
 * Placement is LOGICAL (inset-inline-end): AR → screen-left, EN →
 * screen-right — away from the RTL reading start edge (G9), with
 * safe-area insets respected via the physical-side env() vars.
 */

const RuneScene = dynamic(() => import('./rune-scene').then((m) => m.RuneScene), {
  ssr: false,
})

/** Corner box size (CSS px). The mesh reads ~55% of it, the halo fills it. */
const RUNE_BOX = 220

export function EdgeRune() {
  const reduced = usePrefersReducedMotion()
  const mobileTier = useMobileTier()
  const pathname = usePathname() ?? '/'

  // Idle-load gate — the three.js chunk is fetched only after the browser
  // is idle (hero.tsx pattern). Re-arms if a gated tier flips back off.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (reduced || mobileTier) return
    let started = false
    const start = () => {
      if (!started) {
        started = true
        setReady(true)
      }
    }
    let cancel: (() => void) | undefined
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 2500 })
      cancel = () => window.cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(start, 1500)
      cancel = () => window.clearTimeout(id)
    }
    return () => {
      cancel?.()
    }
  }, [reduced, mobileTier])

  // WebGL probe — module-memoized probeWebGL(), rAF-deferred so the state
  // flip never happens synchronously inside the effect body (hydration-safe
  // + lint-compliant; capability-scene pattern).
  const [glOk, setGlOk] = useState(true)
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      if (!probeWebGL()) setGlOk(false)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [ready])

  // Tab-visibility gate → the Canvas frameloop (IO is meaningless for an
  // always-viewport-corner fixed element; visibilitychange is the whole
  // story — spec §4.7.4).
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (reduced || mobileTier || !ready || !glOk) return null

  const presetKey: RunePresetKey = runePresetKeyForPath(pathname)
  // Physical side for the safe-area env(): inline-end is LEFT in RTL (ar)
  // and RIGHT in LTR (en) — env(safe-area-inset-inline-end) is spottily
  // supported, so resolve the physical side here instead.
  const isEn = pathname === '/en' || pathname.startsWith('/en/')

  return (
    <div
      aria-hidden="true"
      data-elyra-rune=""
      className="pointer-events-none fixed z-[5] opacity-80"
      style={{
        width: RUNE_BOX,
        height: RUNE_BOX,
        insetInlineEnd: `max(1rem, env(safe-area-inset-${isEn ? 'right' : 'left'}, 0px))`,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12vh)',
      }}
    >
      <RuneScene active={visible} presetKey={presetKey} />
    </div>
  )
}
