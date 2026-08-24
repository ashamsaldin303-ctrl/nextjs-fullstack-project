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

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getServerSnapshot(): boolean {
  return false
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
