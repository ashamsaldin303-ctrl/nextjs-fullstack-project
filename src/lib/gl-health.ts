/**
 * WebGL context-health telemetry (plan §2 W3-01).
 *
 * Diagnostic-only counter exposed as `window.__elyraGlHealth` so a
 * support screenshot / DevTools console can read how many context
 * losses + restores the canvases actually experienced in a session.
 * Nothing in the render path reads it — the permanent-failure path
 * already falls back to the CSS gradient by architecture
 * (probeWebGL → glAvailable gate in both canvases); this counter only
 * makes the transient lost/restored cycle observable.
 */

/** Shape of the `window.__elyraGlHealth` diagnostic (typed global). */
export interface GlHealth {
  /** `webglcontextlost` events observed (hero + capability scenes). */
  lost: number
  /** `webglcontextrestored` events observed. */
  restored: number
  /** Label of the canvas that reported the last event ('hero' | 'capability'). */
  lastFrom: string
  /** `performance.now()` ms of the last event. */
  lastAt: number
}

declare global {
  interface Window {
    /** Absent until the first context event of the session happens. */
    __elyraGlHealth?: GlHealth
  }
}

function health(): GlHealth {
  window.__elyraGlHealth ??= { lost: 0, restored: 0, lastFrom: '', lastAt: 0 }
  return window.__elyraGlHealth
}

/** Bump the lost counter (call from a `webglcontextlost` listener). */
export function noteGlLost(from: string): void {
  // Events only ever fire client-side; the guard keeps the module
  // import-safe on the server (SSR never touches it anyway).
  if (typeof window === 'undefined') return
  const h = health()
  h.lost += 1
  h.lastFrom = from
  h.lastAt = performance.now()
}

/** Bump the restored counter (call from a `webglcontextrestored` listener). */
export function noteGlRestored(from: string): void {
  if (typeof window === 'undefined') return
  const h = health()
  h.restored += 1
  h.lastFrom = from
  h.lastAt = performance.now()
}
