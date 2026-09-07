'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { onScrollEvent } from '@/lib/scroll-store'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { useMobileTier } from '@/lib/use-mobile-tier'
import { probeWebGL } from '@/lib/use-webgl'
import { pokeRuneField } from './rune-bus'
import { runeDirForPath, runePresetKeyForPath, type RunePresetKey } from './model-registry'

/**
 * Rune Landmarks root (RUNE-3) — the full-viewport semantic layer
 * mounted ONCE in [locale]/layout. This root is the GATEKEEPER and the
 * SCROLL HEARTBEAT: it stays out of the three.js chunk boundary entirely
 * (only hooks + next/dynamic + the tiny rune-bus + the pure-TS landmark
 * registry here) and translates every DOM scroll event into (a)
 * scroll-clock advancement (scroll-store) and (b) a poke on the
 * invalidate bus, which is what makes the scene's frameloop="demand"
 * render frames while — and only while — the page is being scrolled.
 *
 * Gates (unchanged product decisions from RUNE-1):
 * 1. prefers-reduced-motion → NOTHING mounts (pure decor; reduced-motion
 *    users lose zero function).
 * 2. Mobile tier (useMobileTier: <768px / coarse pointer) → nothing
 *    mounts. A full-viewport roaming layer over a phone's reading column
 *    would be visual noise at best — the desktop tier is the stage the
 *    choreography is composed for.
 * 3. requestIdleCallback (2.5s timeout fallback) before the three.js
 *    chunk is even fetched — LCP-neutral.
 * 4. probeWebGL() (module-memoized, rAF-deferred) → hide entirely.
 * 5. document visibilitychange → frameloop 'never' while hidden; on
 *    return-to-visible the bus is poked so the field repaints.
 *
 * Stacking: z-[5] fixed inset-0 — the semantic bodies float in the
 * sections' free margins ABOVE section content (translucent,
 * pointer-events-none), below the navbar (50), scroll progress (60),
 * intro curtain (80), grain (90) and cursor (200). pointer-events none +
 * aria-hidden: pure decoration, clicks always fall through (G8). The
 * landmarks' anchors are LOGICAL ('start'/'end') and resolve against
 * the active writing direction, so AR and EN mirror each other
 * correctly without rebuilding anything.
 */

const RuneScene = dynamic(() => import('./rune-scene').then((m) => m.RuneScene), {
  ssr: false,
})

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

  // Scroll heartbeat — attached for the ROOT's whole lifetime (before the
  // scene even loads) so the scroll clocks track the user from the first
  // gesture; the poke is a no-op until the scene registers on the bus.
  useEffect(() => {
    if (reduced || mobileTier) return
    const onScroll = () => {
      onScrollEvent()
      pokeRuneField()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced, mobileTier])

  // WebGL probe — module-memoized probeWebGL(), rAF-deferred so the state
  // flip never happens synchronously inside the effect body
  // (hydration-safe + lint-compliant; capability-scene pattern).
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

  // Tab-visibility gate → the Canvas frameloop ('never' while hidden);
  // returning to visible pokes the bus so the frozen field repaints.
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const onVis = () => {
      const nowVisible = !document.hidden
      setVisible(nowVisible)
      if (nowVisible) pokeRuneField()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Mount fade-in — one rAF after the scene mounts, the layer eases from
  // transparent to full presence (700ms), so a direct landing or a route
  // morph never flashes an unblended composition.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!ready || !glOk) return
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [ready, glOk])

  if (reduced || mobileTier || !ready || !glOk) return null

  const presetKey: RunePresetKey = runePresetKeyForPath(pathname)
  const dir = runeDirForPath(pathname)

  return (
    <div
      aria-hidden="true"
      data-elyra-rune-field=""
      className="pointer-events-none fixed inset-0 z-[5]"
      style={{
        opacity: shown ? 1 : 0,
        transition: 'opacity 700ms ease-out',
      }}
    >
      <RuneScene active={visible} presetKey={presetKey} dir={dir} />
    </div>
  )
}
