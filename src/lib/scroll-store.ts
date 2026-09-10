'use client'

/**
 * Scroll clocks for the Rune Field (RUNE-2) — the "scroll is time" engine.
 *
 * OWNER'S CONTRACT (2025 feedback, verbatim semantics):
 * · «تتحرك في جميع أنحاء الشاشة مع Scroll Up/Down» → D, the SIGNED
 *   accumulated scroll offset, drives every position path: scrolling down
 *   carries the runes along their paths, scrolling up retraces them.
 * · «كبيرة ثم تصغر وتكبر» → S, the UNSIGNED accumulated scroll distance,
 *   drives the scale breathing — one full big→small→big cycle every ~2
 *   screens of scrolling, phase-staggered per rune so the field ripples.
 * · «ألا تتحرك أو يحدث لها أي شيء إذا توقف المستخدم عن التمرير» → the
 *   clocks only advance inside scroll EVENT handlers. No wall-clock time
 *   enters the animation anywhere (zero uTime in the shaders); combined
 *   with the scene's frameloop="demand" the GPU renders literally zero
 *   frames once the velocity tail below has drained.
 *
 * The ONLY time-based quantity is the velocity EMA tail, which fades the
 * glow energy out over ≤ ~350 ms after the last scroll event (a hard
 * linear drain guarantees the tail terminates) — motion itself stops on
 * the very last scroll event, instantly.
 *
 * Event-driven (v2 rewrite of the RUNE-1 per-frame sampler): the old
 * sampleScroll() polled window.scrollY once per rendered frame, which
 * needs a running frame loop. The Rune Field renders frames ONLY while
 * animating, so the store must instead be fed by the DOM scroll listener
 * (rune field root attaches it) — the frame loop then READS the clocks
 * and drains the tail.
 *
 * Module-level singleton (hero-scroll.ts pattern): read-only from the
 * scene's useFrame, mutated only by onScrollEvent/tickScrollTail/
 * expectTeleport, never triggers a React render.
 */

export interface ScrollClocks {
  /** Signed accumulated scroll offset (px). Down = positive. */
  D: number
  /** Unsigned accumulated scroll distance (px). */
  S: number
  /** Velocity EMA (px/s, positive = down) — glow energy source only. */
  vy: number
}

interface ScrollState {
  lastY: number
  D: number
  S: number
  vy: number
  /** One-shot: the next scroll write is a navigation teleport (see
   *  expectTeleport) — re-baseline and swallow it. */
  teleport: boolean
  initialized: boolean
  lastT: number
}

const state: ScrollState = {
  lastY: 0,
  D: 0,
  S: 0,
  vy: 0,
  teleport: false,
  initialized: false,
  lastT: 0,
}

/** Velocity clamp — beyond this (violent trackpad fling) the response
 *  saturates so the glow never clips into strobing. */
const VY_MAX = 3600
/** Single-event position jump (px) that means "navigation scroll reset /
 *  anchor jump / scroll restoration", not a real gesture — ignored.
 *  Covers the >900px half; sub-900px navigation resets are declared
 *  up-front via expectTeleport() by their writers instead. */
const TELEPORT = 900
/** Dead-zone (px/s): below this the glow tail counts as fully drained
 *  (the demand loop parks and frames stop). */
const DEADZONE = 6
/** EMA rise rate (1/s) — fast enough to track a fling within ~2 events. */
const EMA_RISE = 26
/** Exponential drain rate (1/s) for the glow tail after the last event. */
const TAIL_DECAY = 12
/** Linear drain floor (px/s²) — guarantees the tail reaches zero in
 *  bounded time instead of asymptotically (the "strict freeze" contract:
 *  frames stop when |vy| drains below the dead-zone). */
const TAIL_DRAIN = 320

/**
 * Feed the clocks from a scroll event. Called by the Rune Field root's
 * passive scroll listener (never from the render loop). Teleport-class
 * jumps (route changes, hash anchors, scroll restoration) advance
 * NOTHING — the field must not fling because the page jumped. Jumps
 * larger than TELEPORT are caught here by magnitude; sub-900px
 * navigation resets are swallowed via the expectTeleport flag below.
 */
export function onScrollEvent(): void {
  if (typeof window === 'undefined') return
  const y = window.scrollY
  const now = performance.now()
  if (!state.initialized) {
    state.initialized = true
    state.lastY = y
    state.lastT = now
    return
  }
  if (state.teleport) {
    // The awaited navigation-class write has landed: re-baseline and
    // swallow it entirely — no D/S advance, no velocity spike (this is
    // the sub-900px companion the magnitude guard cannot see).
    state.teleport = false
    state.lastY = y
    state.lastT = now
    state.vy = 0
    return
  }
  const dt = (now - state.lastT) / 1000
  const dy = y - state.lastY
  state.lastY = y
  state.lastT = now
  if (dy === 0) return
  if (Math.abs(dy) > TELEPORT) return

  state.D += dy
  state.S += Math.abs(dy)

  // Instantaneous velocity from event spacing (clamped; scroll events can
  // arrive in bursts where dt under-reports — the clamp + EMA smooth it).
  let raw = 0
  if (dt > 0.0001 && dt < 0.5) {
    raw = dy / dt
    if (raw > VY_MAX) raw = VY_MAX
    else if (raw < -VY_MAX) raw = -VY_MAX
  }
  const s = 1 - Math.exp(-EMA_RISE * Math.max(dt, 1 / 120))
  state.vy += (raw - state.vy) * s
}

/**
 * AUDIT-A3 (FIX 1): announce an upcoming programmatic navigation-class
 * scroll (route change, back/forward restore, locale restore, an
 * `immediate: true` lenisScrollTo). The NEXT scroll write is re-
 * baselined and swallowed — no D/S advance, no velocity/glow spike — and
 * any live glow tail is drained instantly. The TELEPORT magnitude guard
 * above stays for real gesture spikes; this covers the sub-900px resets
 * that guard cannot tell apart from a gesture. Call BEFORE issuing the
 * write, in the same synchronous block (a scroll event cannot
 * interleave; same-task writes coalesce into one event at the final
 * position). If the write is a no-op (already at the target) the flag
 * lingers and swallows the next single event — one sub-perceptual tick,
 * and the rune field rebuilds per route regardless.
 */
export function expectTeleport(): void {
  state.teleport = true
  state.vy = 0
}

/**
 * Drain the glow tail once per RENDERED frame. Returns true while the
 * tail is still above the dead-zone (the caller must invalidate another
 * frame); false once fully drained — the demand loop then stops and the
 * field is frozen proof-positive.
 */
export function tickScrollTail(dt: number): boolean {
  const t = dt > 0 ? Math.min(dt, 0.1) : 1 / 60
  state.vy *= Math.exp(-TAIL_DECAY * t)
  if (Math.abs(state.vy) < 60) {
    // linear floor drain — bounded termination
    const mag = Math.abs(state.vy) - TAIL_DRAIN * t
    state.vy = mag > 0 ? Math.sign(state.vy) * mag : 0
  }
  if (Math.abs(state.vy) < DEADZONE) {
    state.vy = 0
    return false
  }
  return true
}

/** Pure read of the clocks (useFrame / debug handle). */
export function getScrollClocks(): ScrollClocks {
  return { D: state.D, S: state.S, vy: state.vy }
}

/** Normalized glow energy 0..1 (≈ saturated at a deliberate 1600 px/s). */
export function scrollEnergy(): number {
  return Math.min(Math.abs(state.vy) / 1600, 1)
}
