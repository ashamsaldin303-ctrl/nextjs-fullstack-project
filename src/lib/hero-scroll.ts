'use client'

import type { MotionValue } from 'framer-motion'

/**
 * Hero scroll bridge (Batch 3 item 15).
 *
 * The methodology section owns a framer-motion `useScroll` progress for
 * its sticky cards; the hero canvas needs the same signal inside R3F's
 * `useFrame`, which cannot subscribe to MotionValues. This module is the
 * one-way handoff: Methodology binds its `scrollYProgress` here (once, in
 * an effect — never during render), and the hero 3D scene polls
 * `getHeroScroll()` each frame.
 *
 * Module-level state (not React state/context) on purpose: both consumers
 * are client components on the same page and share one module instance,
 * and the canvas side only reads — no re-render is ever triggered.
 */

interface ScrollHolder {
  source: MotionValue<number> | null
}

const heroScroll: ScrollHolder = { source: null }

/** Bind a 0…1 scroll progress MotionValue. Returns an unbind cleanup. */
export function bindHeroScroll(source: MotionValue<number>): () => void {
  heroScroll.source = source
  return () => {
    if (heroScroll.source === source) heroScroll.source = null
  }
}

/**
 * Current hero scroll progress (0…1). Always numeric — returns 0 until the
 * methodology section binds (initial load / route change), so consumers
 * never observe `undefined`.
 */
export function getHeroScroll(): number {
  const value = heroScroll.source?.get()
  return typeof value === 'number' ? value : 0
}
