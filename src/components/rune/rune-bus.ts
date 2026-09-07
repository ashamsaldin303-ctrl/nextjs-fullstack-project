'use client'

/**
 * Rune Field invalidate bus (RUNE-2) — the bridge between the DOM scroll
 * listener (edge-rune.tsx, lives in the FIRST chunk, imports no three)
 * and the R3F scene's invalidate() (rune-scene.tsx, inside the lazy
 * three.js chunk).
 *
 * Why a bus: the scene runs frameloop="demand" — the GPU renders a frame
 * ONLY when something calls invalidate(). Scroll events are the heartbeat:
 * each event advances the scroll clocks (scroll-store) and pokes the bus,
 * which renders a frame; the scene's useFrame then chains invalidate()
 * while the glow tail drains or a route morph is unconverged, and STOPS
 * chaining when everything has settled. Idle page = zero rendered frames
 * = the owner's «ألا يتحرك أو يحدث لها أي شيء إذا توقف المستخدم»,
 * enforced at the GPU scheduler level, not just the animation level.
 *
 * Deliberately dependency-free (no three, no React) so both chunks can
 * import it without dragging anything across the chunk boundary.
 */

let invalidate: (() => void) | null = null

/** Register the scene's invalidate (R3F useThree). Idempotent — the last
 *  registration wins; the scene unregisters on unmount. */
export function setRuneInvalidate(fn: (() => void) | null): void {
  invalidate = fn
}

/** Request a frame from the Rune Field scene (scroll event, tab-visible
 *  resume, etc.). No-op when the scene is not mounted. */
export function pokeRuneField(): void {
  invalidate?.()
}
