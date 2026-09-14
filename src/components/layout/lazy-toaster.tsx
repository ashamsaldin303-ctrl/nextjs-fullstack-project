'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ToasterProps } from 'sonner'

/**
 * LazyToaster — F-S3-01 partial (audit r2): sonner's Toaster (plus its
 * chunk) used to sit on EVERY route's initial critical path even though
 * toasts only ever fire in response to user actions. This wrapper mounts
 * the real Toaster after the FIRST user gesture (pointerdown / keydown,
 * once, capture-phase so no stopPropagation can eat it) — by the time any
 * toast() call can happen, the toaster is already mounted; the sonner
 * chunk leaves the initial JS budget entirely.
 *
 * Renders nothing until armed. Props pass through verbatim to
 * components/ui/sonner (the translated aria labels included — they arrive
 * as plain strings from the server layout).
 */

const Toaster = dynamic(
  () => import('@/components/ui/sonner').then((m) => m.Toaster),
  { ssr: false }
)

type PassthroughProps = ToasterProps

export function LazyToaster(props: PassthroughProps) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (armed) return
    const arm = () => setArmed(true)
    // once: the listener removes itself after the first event; the manual
    // removeEventListener in the cleanup covers unmount-before-gesture.
    window.addEventListener('pointerdown', arm, { once: true, capture: true })
    window.addEventListener('keydown', arm, { once: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', arm, { capture: true })
      window.removeEventListener('keydown', arm, { capture: true })
    }
  }, [armed])

  if (!armed) return null
  return <Toaster {...props} />
}
