'use client'

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
 * · SSR-safe: returns false on the server WITHOUT touching the cache (the
 *   SSR pass must never pin a bogus result).
 * · Memoized at module level — the probe runs at most once per page load
 *   and both live consumers (hero-canvas.tsx + capability-scene.tsx,
 *   LOOP-3 FIX 8) share the result.
 *
 * L6-F1: the useWebGLSupport() hook wrapper was deleted — it had zero
 * consumers since R9 removed the hero console (hero-console.tsx +
 * console-scene.tsx). Both live WebGL canvases call probeWebGL() inside
 * their own rAF-deferred glAvailable effects, which keeps the identical
 * "no synchronous context creation inside the effect body" timing.
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
