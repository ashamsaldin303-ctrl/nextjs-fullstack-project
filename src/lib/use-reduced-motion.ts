'use client'

import { useSyncExternalStore } from 'react'

/**
 * prefers-reduced-motion via useSyncExternalStore — a framer-motion-free
 * replacement for useReducedMotion() so lightweight components (Phase 3
 * §4.3) can drop the framer-motion dependency from the initial bundle.
 *
 * The server snapshot is `false` (motion allowed): this matches how
 * framer-motion behaves during SSR and keeps hydration deterministic.
 */

/**
 * Module-level MQL singleton — `window.matchMedia` allocates a fresh
 * MediaQueryList on every call, and the old getSnapshot ran it on every
 * render. One cached instance serves subscribe + getSnapshot for the whole
 * app (the matches state is shared by all MQLs of the same query anyway).
 */
let mql: MediaQueryList | null = null

function getMql(): MediaQueryList | null {
  if (typeof window === 'undefined') return null
  if (!mql) mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  return mql
}

function subscribe(onChange: () => void): () => void {
  const mq = getMql()
  if (!mq) return () => {}
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return getMql()?.matches ?? false
}

function getServerSnapshot(): boolean {
  return false
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
