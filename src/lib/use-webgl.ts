'use client'

import { useEffect, useState } from 'react'

/**
 * WebGL support probe — checks ACTUAL context creation, not just API
 * presence (FIX(2-b) for L1-C/L1-D P3).
 *
 * Why: `'WebGLRenderingContext' in window` stays true on
 * driver-blocklisted / hardened browsers where getContext() still returns
 * null. R3F v9's Canvas configure() is async and un-awaited, so a
 * WebGLRenderer construction failure rejects silently — the consumer shows
 * an empty dark box instead of its fallback.
 *
 * · SSR-safe: `useWebGLSupport()` returns false on the server and resolves
 *   after the first client frame (hero-console's scene only mounts on user
 *   interaction, long after the probe settles — no fallback flash).
 * · rAF-deferred, mirroring hero-canvas.tsx's proven glAvailable probe: no
 *   synchronous context creation inside the effect body.
 * · Memoized at module level — the probe runs at most once per page load
 *   and every consumer shares the result. hero-canvas.tsx and
 *   capability-scene.tsx carry their own inline probes today and can adopt
 *   `probeWebGL()` later without any API change here.
 */

let cached: boolean | null = null

/**
 * Synchronous one-shot probe (memoized after the first call). Safe to call
 * anywhere on the client; returns false on the server without touching
 * the cache (the SSR pass must never pin a bogus result).
 */
export function probeWebGL(): boolean {
  if (typeof window === 'undefined') return false
  if (cached !== null) return cached
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    cached = Boolean(gl)
  } catch {
    cached = false
  }
  return cached
}

/**
 * True once an actual WebGL context has been created successfully.
 * Returns false until the first rAF after mount (see above).
 */
export function useWebGLSupport(): boolean {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      setSupported(probeWebGL())
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [])
  return supported
}
