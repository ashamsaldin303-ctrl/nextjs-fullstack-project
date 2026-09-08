'use client'

import { useEffect, useRef, useState } from 'react'
import { useIsRtl } from '@/lib/use-rtl'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/**
 * N6 (REF-3 T2) — cursor radar readout (Crafted §3.4 "instrument mode").
 *
 * A live X/Y coordinate readout that follows the pointer inside the PARENT
 * element (mount as a direct child of the target section): microscopic
 * mono digits (`X 0421 · Y 0189`) that fade in on pointerenter and out on
 * pointerleave — the CAD/observatory feeling over the 3D hero zone and
 * the bento card field.
 *
 * RTL logical mirroring: the displayed X is the distance from the
 * READING-START edge (physical left in LTR, physical right in RTL) — the
 * mirrored reading the report's pure-LTR examples need before reuse. The
 * readout element itself also leads the pointer toward the reading
 * direction: +14px on the physical right in LTR, flipped to the physical
 * LEFT side in RTL (px − (width + 14)) so it never clips off the
 * reading-START edge; the symmetric residual risk sits on the reading-end
 * edge exactly like the LTR original. The wrapper is dir="ltr" so
 * `start-0` always anchors the physical left edge and the translate is
 * purely physical — Latin/digits island (bento's NODE_TYPE-badge
 * precedent).
 *
 * Freeze-safe: moves only with the pointer — one rAF-coalesced
 * pointermove (rect read + transform/opacity writes straight to the DOM,
 * never state), zero loops, zero timers; full teardown on unmount. The
 * pointer itself is the only clock. Mount gates: fine pointer (checked
 * after mount, hydration-safe — SSR renders null) + motion allowed.
 * z-10 keeps the readout far below the custom cursor layer
 * (.elyra-cursor-layer, fixed z-200 — the cursor always wins).
 */
export function CursorRadar({ tone = 'light' }: { tone?: 'dark' | 'light' }) {
  const zoneRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLDivElement>(null)
  const isRtl = useIsRtl()
  const reduced = usePrefersReducedMotion()
  const [finePointer, setFinePointer] = useState(false)

  // Hydration-safe fine-pointer gate: state starts false (SSR renders
  // null), flips after mount — matchMedia is never touched during render,
  // so server HTML and first client paint always agree. rAF-deferred per
  // the reveal.tsx no-setState-in-effect-body convention.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setFinePointer(window.matchMedia('(pointer: fine)').matches),
    )
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!finePointer || reduced) return
    // The pointer source is the PARENT element (this component mounts as
    // a direct child of the target section); the readout rides inside our
    // own absolute inset-0 wrapper, which shares the parent's box.
    const zone = zoneRef.current?.parentElement
    const readout = readoutRef.current
    if (!zone || !readout) return

    let raf = 0
    let cx = 0
    let cy = 0

    const pad = (n: number) =>
      String(Math.min(9999, Math.max(0, Math.round(n)))).padStart(4, '0')

    const paint = () => {
      raf = 0
      const rect = zone.getBoundingClientRect()
      // Logical X: distance from the reading-start edge (mirrored in RTL);
      // Y: distance from the top. Both clamped ≥0 at zone boundaries.
      const lx = isRtl ? rect.right - cx : cx - rect.left
      const ly = cy - rect.top
      // Physical local X anchors the translate (the wrapper is dir="ltr",
      // so start-0 is always the physical left edge).
      const px = cx - rect.left
      readout.textContent = `X ${pad(lx)} · Y ${pad(ly)}`
      // Leading offset — flipped to the physical left side in RTL so the
      // readout never clips off the reading-start edge (see header).
      const w = readout.offsetWidth || 96
      const tx = px + (isRtl ? -(w + 14) : 14)
      readout.style.transform = `translate3d(${tx.toFixed(1)}px, ${(ly + 14).toFixed(1)}px, 0)`
    }

    const onMove = (e: PointerEvent) => {
      cx = e.clientX
      cy = e.clientY
      if (raf) return
      raf = requestAnimationFrame(paint)
    }
    const onEnter = () => {
      readout.style.opacity = '1'
    }
    const onLeave = () => {
      readout.style.opacity = '0'
    }

    zone.addEventListener('pointermove', onMove, { passive: true })
    zone.addEventListener('pointerenter', onEnter, { passive: true })
    zone.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      zone.removeEventListener('pointermove', onMove)
      zone.removeEventListener('pointerenter', onEnter)
      zone.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [finePointer, reduced, isRtl])

  if (!finePointer || reduced) return null

  return (
    <div
      ref={zoneRef}
      aria-hidden="true"
      dir="ltr"
      className="pointer-events-none absolute inset-0 z-10"
    >
      <div
        ref={readoutRef}
        className={`absolute top-0 start-0 font-mono text-[10px] tracking-[0.2em] tabular-nums opacity-0 transition-opacity duration-200 will-change-transform ${
          tone === 'dark' ? 'text-white/55' : 'text-foreground/45'
        }`}
      >
        X 0000 · Y 0000
      </div>
    </div>
  )
}
