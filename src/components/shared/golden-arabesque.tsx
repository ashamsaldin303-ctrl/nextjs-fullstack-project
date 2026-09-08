'use client'

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'

import { cn } from '@/lib/utils'

/**
 * N5 (REF-3 T2) — self-drawing golden arabesque (Damascene divider/crown).
 *
 * The Atelier §4.2/§4.5 "golden wire that draws itself": strokeDashoffset
 * scrubbed by scroll, implemented with framer-motion's `pathLength` (the
 * ONE sanctioned non-transform/opacity house exception — it IS the whole
 * mechanic here). The mechanic is borrowed; the MARK is ours: a Damascene
 * arabesque band in the Elyra gold token — the same wire that gilds the
 * Fresnel spec-card edge (N9) and the contact success-box lid (N7).
 * Identity continuity: the stroke that closes the manifesto is the stroke
 * that frames the site.
 *
 * Geometry (viewBox 0 0 1200 120, all stroke/no fill) — VLM-round-2
 * densified: the original sparse band (gap around the rosette stage) read
 * as "disconnected primitives". Now:
 *   · a gentle WAVE RAIL runs the full width — the connecting vine every
 *     Damascene band has, drawn FIRST (the journey opens with the rail);
 *   · 6 CONTINUOUS motif cells (200px each, x = 0..1000), motif + mirror
 *     per cell — no gaps;
 *   · the octagon rosette (outer + inner ring) OVERLAPS the middle cells'
 *     curls — the interlaced center of the band, drawn LAST.
 * 15 strokes total; the band is mirror-symmetric around x = 600.
 *
 * Draw order = array order: rail → left→right motifs → rosette — one
 * continuous stroke journey that ends on the center jewel.
 *
 * SSR-armed pattern (CRITICAL): the server HTML AND the hydration paint
 * render every path at pathLength 1 (FULLY DRAWN — the no-JS /
 * reduced-motion / first-paint resting state). An effect flips `armed`
 * after mount, which swaps style.pathLength from the number 1 to the
 * scroll-driven MotionValue — which sits at 0 while the divider is still
 * below the fold (the useScroll offset only wakes at 95% viewport), so
 * the "erase" is never visible. framer accepts a MotionValue OR a plain
 * number in style, which is what makes the swap legal.
 *
 * Reduced motion: the wrapper branch renders plain <path> elements —
 * fully drawn, and the split keeps useScroll/useSpring entirely
 * unmounted, so "static final state, no listeners" is literal.
 */

/**
 * The unit motif — a sweeping vine curl, one single-stroke path in a
 * 200×120 local box (spans roughly x∈[16,140], y∈[16,110]).
 */
const MOTIF_D =
  'M16,84 C48,20 96,16 124,48 C152,80 128,110 88,102 C48,94 52,40 96,32'

/** The wave rail — the connecting vine under the whole band (drawn first). */
const RAIL_D =
  'M8,62 C208,48 408,76 608,62 C808,48 1008,76 1192,62'

/** Central rosette — outer octagon (center 600,60; ~112 wide). */
const ROSETTE_OUTER_D =
  'M600,18 L642,36 L656,60 L642,84 L600,102 L558,84 L544,60 L558,36 Z'
/** Central rosette — inner octagon (≈0.46 scale of the outer ring). */
const ROSETTE_INNER_D =
  'M600,39 L621,48 L626,60 L621,72 L600,81 L579,72 L574,60 L579,48 Z'

/**
 * The stroke table. Each entry carries its own SVG transform; the draw
 * slice is derived from the array index (order = draw order). Wave rail
 * → 6 continuous motif cells (left→right) → the interlaced center jewel
 * (drawn LAST — the journey's final beat).
 */
const STROKES: ReadonlyArray<{ d: string; transform: string }> = [
  // The rail — the band's spine.
  { d: RAIL_D, transform: '' },
  // Cell x=0: motif + mirror.
  { d: MOTIF_D, transform: 'translate(0, 0)' },
  { d: MOTIF_D, transform: 'translate(200, 0) scale(-1, 1)' },
  // Cell x=200.
  { d: MOTIF_D, transform: 'translate(200, 0)' },
  { d: MOTIF_D, transform: 'translate(400, 0) scale(-1, 1)' },
  // Cell x=400 (its mirror interlaces into the rosette's left side).
  { d: MOTIF_D, transform: 'translate(400, 0)' },
  { d: MOTIF_D, transform: 'translate(600, 0) scale(-1, 1)' },
  // Cell x=600 (the band's exact center; the rosette overlays it).
  { d: MOTIF_D, transform: 'translate(600, 0)' },
  { d: MOTIF_D, transform: 'translate(800, 0) scale(-1, 1)' },
  // Cell x=800.
  { d: MOTIF_D, transform: 'translate(800, 0)' },
  { d: MOTIF_D, transform: 'translate(1000, 0) scale(-1, 1)' },
  // Cell x=1000.
  { d: MOTIF_D, transform: 'translate(1000, 0)' },
  { d: MOTIF_D, transform: 'translate(1200, 0) scale(-1, 1)' },
  // The center jewel — drawn LAST.
  { d: ROSETTE_OUTER_D, transform: '' },
  { d: ROSETTE_INNER_D, transform: '' },
]

const GOLD = 'var(--elyra-gold-strong)'

export function GoldenArabesque({ className }: { className?: string }) {
  const reduced = useReducedMotion()

  if (reduced) {
    // Static final state: fully drawn, plain <path> (zero framer).
    // `relative` on the wrapper satisfies framer's useScroll target
    // contract (non-static position) for the live branch below.
    return (
      <div aria-hidden="true" className={cn('relative', className)}>
        <svg
          viewBox="0 0 1200 120"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
          className="h-auto w-full"
          style={{ opacity: 0.9 }}
        >
          {STROKES.map((s) => (
            <path
              key={s.d + s.transform}
              d={s.d}
              transform={s.transform}
              stroke={GOLD}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    )
  }

  return <DrawnArabesque className={className} />
}

/**
 * The live (scroll-driven) half — a separate component so its framer
 * hooks never mount under reduced motion (see the header note).
 */
function DrawnArabesque({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [armed, setArmed] = useState(false)

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start 95%', 'end 55%'],
  })
  // LOCAL decorative clock — deliberately NOT the methodology W2-01
  // shared spring (stiffness 100 / damping 30 / mass 0.5): this divider
  // is an isolated island (manifesto close / about crown — never on the
  // methodology page), and a slightly softer, overdamped spring (80/24,
  // ζ≈1.34) reads better for a slow ornament. Scroll-linked only — the
  // spring settles when scrolling stops and framer parks its driver
  // loop (freeze contract).
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 24 })

  useEffect(() => {
    // The SSR-armed flip (see header). rAF-deferred so we never setState
    // synchronously inside the effect body (reveal.tsx convention).
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div ref={wrapRef} aria-hidden="true" className={cn('relative', className)}>
      <svg
        viewBox="0 0 1200 120"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full"
        style={{ opacity: 0.9 }}
      >
        {STROKES.map((s, i) => (
          // The transform rides on a plain <g> wrapper: framer-motion owns
          // the transform attribute on motion elements it animates — the
          // group keeps our static placement geometry out of that path.
          <g key={s.d + s.transform} transform={s.transform}>
            <ArabesqueStroke
              d={s.d}
              smooth={smooth}
              from={i / STROKES.length}
              to={(i + 1) / STROKES.length}
              armed={armed}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}

/**
 * One stroke of the band. Hooks stay static (one useTransform per
 * component) — the slice is a prop, never a loop variable.
 */
function ArabesqueStroke({
  d,
  smooth,
  from,
  to,
  armed,
}: {
  d: string
  smooth: MotionValue<number>
  from: number
  to: number
  armed: boolean
}) {
  // Stroke i draws across its own slice of the smoothed progress —
  // [i/N, (i+1)/N] — so the array order IS the pen's travel order.
  const draw = useTransform(smooth, [from, to], [0, 1])

  return (
    <motion.path
      d={d}
      // The SSR-armed switch: number 1 keeps the server/no-JS/first
      // paint fully drawn; after mount the MotionValue takes over.
      style={{ pathLength: armed ? draw : 1 }}
      stroke={GOLD}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}
