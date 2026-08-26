'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Fires `near` once the element approaches the viewport (rootMargin
 * lead) — powers the three lazy-section wrappers. Falls back to a
 * one-shot rAF when IntersectionObserver is unavailable.
 *
 * Extracted (board-R2) from simulator-lazy / calculator-lazy /
 * methodology-lazy, which had copy-pasted the identical observer
 * machinery. The observer disconnects on first intersection (one-shot:
 * once a section is near, it stays mounted) and both the observer and
 * the rAF fallback are cleaned up on unmount.
 */
export function useNearViewport<T extends HTMLElement>(rootMargin = '400px 0px'): {
  ref: React.RefObject<T | null>
  near: boolean
} {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      const id = window.requestAnimationFrame(() => setNear(true))
      return () => window.cancelAnimationFrame(id)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  return { ref, near }
}
