'use client'

/**
 * Scroll velocity store for the Edge Rune (R1) — the generalization of
 * hero-scroll.ts's philosophy to a whole-page signal, WITHOUT framer-motion.
 *
 * Why no framer-motion: the repo keeps framer-motion out of app-wide
 * components on purpose (Reveal and the layout-level layers are
 * framer-motion-free; only 4 homepage files import it). A `useScroll()` +
 * `useVelocity()` pair inside a layout-level component would drag the
 * framer-motion chunk onto every internal page — for a decorative sigil.
 * Instead the ONE consumer (rune-scene's useFrame) samples window.scrollY
 * here once per frame and derives velocity from the delta. Zero listeners,
 * zero re-renders, zero new client JS.
 *
 * Module-level singleton (like hero-scroll.ts): read-only from useFrame,
 * never triggers a React render.
 *
 * Directional semantics (owner's literal request): scrolling DOWN spins the
 * rune one way, scrolling UP the opposite way. `dir` is the HELD sign of
 * the damped velocity — a dead-zone hysteresis so micro-jitter around zero
 * never flips the spin direction (spec §4.3).
 */

interface ScrollSample {
  /** Damped velocity, px/s (positive = scrolling down). */
  vy: number
  /** Held direction: 1 (down), -1 (up). Holds the last non-zero direction
   *  while inside the dead-zone — never flips on jitter. */
  dir: 1 | -1 | 0
}

interface ScrollState {
  y: number
  vy: number
  dir: 1 | -1 | 0
  initialized: boolean
}

const state: ScrollState = { y: 0, vy: 0, dir: 0, initialized: false }

/** Velocity clamp — beyond this (violent trackpad fling) the response
 *  saturates so the rune never turns into a blur. */
const VY_MAX = 3200
/** Single-frame position jump (px) that means "navigation scroll reset /
 *  anchor jump", not a real fling — ignored entirely (vy raw = 0). */
const TELEPORT = 900
/** Dead-zone (px/s) inside which the held direction is kept. */
const DEADZONE = 6
/** Damping rate for the velocity EMA — dt-compensated (1 - e^(-k·dt)). */
const VY_K = 9

/**
 * Sample the page scroll once. MUST be called at most once per frame by the
 * scene's useFrame (single consumer by design — a second caller would
 * double-advance the baseline). `delta` is the useFrame delta in seconds.
 */
export function sampleScroll(delta: number): ScrollSample {
  if (typeof window === 'undefined') return { vy: 0, dir: 0 }
  const y = window.scrollY
  if (!state.initialized) {
    state.y = y
    state.initialized = true
    return { vy: 0, dir: state.dir }
  }
  const dt = delta > 0 ? delta : 1 / 60
  const dy = y - state.y
  state.y = y
  let raw = 0
  if (Math.abs(dy) <= TELEPORT) {
    raw = dy / dt
    if (raw > VY_MAX) raw = VY_MAX
    else if (raw < -VY_MAX) raw = -VY_MAX
  }
  const s = 1 - Math.exp(-VY_K * dt)
  state.vy += (raw - state.vy) * s
  if (state.vy > DEADZONE) state.dir = 1
  else if (state.vy < -DEADZONE) state.dir = -1
  return { vy: state.vy, dir: state.dir }
}
