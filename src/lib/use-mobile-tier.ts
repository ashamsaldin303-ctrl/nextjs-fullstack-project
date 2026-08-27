'use client'

import { useSyncExternalStore } from 'react'

/**
 * Mobile tier (FIX(2-b), L1-D P2; extracted for LOOP-3 FIX 5 so
 * capability-scene shares it with hero-canvas) via useSyncExternalStore —
 * the exact pattern of use-reduced-motion.ts: one module-level MQL
 * singleton (matchMedia allocates a fresh MediaQueryList on every call) +
 * a false server snapshot (desktop tier during SSR; consumers are
 * client-only dynamic imports anyway). Reactive by design: crossing the
 * boundary mid-session swaps the dpr in place (R3F re-applies the pixel
 * ratio without recreating the canvas/GL context) and lets consumers
 * remount tier-sized buffers via a key so they resize to the new count —
 * the canvas itself survives.
 */

let tierMql: MediaQueryList | null = null

function getTierMql(): MediaQueryList | null {
  if (typeof window === 'undefined') return null
  if (!tierMql) {
    tierMql = window.matchMedia('(max-width: 767px), (pointer: coarse)')
  }
  return tierMql
}

function subscribeTier(onChange: () => void): () => void {
  const mq = getTierMql()
  if (!mq) return () => {}
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getTierSnapshot(): boolean {
  return getTierMql()?.matches ?? false
}

function getTierServerSnapshot(): boolean {
  return false
}

/** True on coarse-pointer or <768px viewports → lighter particle/render tier. */
export function useMobileTier(): boolean {
  return useSyncExternalStore(subscribeTier, getTierSnapshot, getTierServerSnapshot)
}
