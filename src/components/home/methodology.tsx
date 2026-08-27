'use client'

import { useTranslations } from 'next-intl'
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { Compass, PencilRuler, Hammer, Rocket, type LucideIcon } from 'lucide-react'
import { SectionHeading } from '@/components/shared/section-heading'
import { bindHeroScroll } from '@/lib/hero-scroll'
import { cn } from '@/lib/utils'

interface StepDef {
  key: 'discover' | 'design' | 'build' | 'launch'
  icon: LucideIcon
}

const STEPS: StepDef[] = [
  { key: 'discover', icon: Compass },
  { key: 'design', icon: PencilRuler },
  { key: 'build', icon: Hammer },
  { key: 'launch', icon: Rocket },
]

function MethodologyStep({
  step,
  index,
  total,
  progress,
  reduced,
}: {
  step: StepDef
  index: number
  total: number
  progress: MotionValue<number>
  reduced: boolean | null
}) {
  const t = useTranslations('methodology')
  const Icon = step.icon
  const start = index / total
  const end = (index + 1) / total
  const scale = useTransform(progress, [start, end], [1, 0.94])
  const opacity = useTransform(progress, [start, Math.min(end + 0.05, 1)], [1, 0.55])

  return (
    <motion.article
      style={reduced ? undefined : { scale, opacity }}
      className={cn(
        'relative rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10',
        'sticky top-24',
      )}
    >
      {/* UI-5: timeline dot on the start-side rail. The oversized step
          number's clip moved to an inner box (below) so this dot can hang
          OUTSIDE the card, in the stack's start gutter, centered on the
          rail. Aligns with the icon row: p-6 + 28px ≈ top-13 (mobile) /
          p-10 + 28px ≈ top-17 (sm+). The ring punches it through the rail. */}
      <span
        aria-hidden="true"
        className="absolute -start-6 top-13 size-2.5 rounded-full bg-primary ring-4 ring-background sm:-start-8 sm:top-17"
      />
      {/* Same corner-bleed clip the article's own overflow-hidden used to
          provide — now scoped to a box with identical bounds/rounding so
          the article can host the gutter dot without clipping it.
          pointer-events-none keeps the inset-0 box inert (the original
          number span carried it too). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
      >
        <span
          className="absolute -end-4 -top-4 text-[120px] font-bold leading-none text-primary/5 sm:text-[160px]"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </span>
      <div className="relative grid gap-6 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-7" aria-hidden="true" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t(`steps.${step.key}.title`)}
            </h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary-strong">
              {t(`steps.${step.key}.duration`)}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t(`steps.${step.key}.desc`)}
          </p>
        </div>
        {/* L3 FIX (R3): decorative flow glyph — aria-hidden so SR users don't
            hear a contextless "down arrow" / "check mark" per step. */}
        <div
          aria-hidden="true"
          className="hidden size-16 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground sm:flex"
        >
          {index < total - 1 ? '↓' : '✓'}
        </div>
      </div>
    </motion.article>
  )
}

export function Methodology() {
  const t = useTranslations('methodology')
  const reduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 20%', 'end 60%'],
  })
  // 4-I4 (Batch 3 item 15): one-way bridge — feed this section's scroll
  // progress to the hero canvas camera dolly (bound in an effect so no
  // module state is touched during render; unbinds on unmount).
  useEffect(() => bindHeroScroll(scrollYProgress), [scrollYProgress])

  return (
    <section className="bg-background py-20 sm:py-28" aria-labelledby="method-title">
      <div className="elyra-container max-w-container">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          titleId="method-title"
        />
        {/* `relative` anchors the framer-motion scroll offsets (useScroll
            warns when the container is statically positioned). The ref'd
            wrapper boxes the steps AND the rail, so their heights match
            and scrollYProgress semantics are unchanged. */}
        <div ref={containerRef} className="relative mt-14">
          {/* UI-5: vertical progress rail on the START side (logical
              inset — flips with RTL). Track is a hairline; the fill is a
              scaleY transform on the same scrollYProgress the cards use
              (no extra listeners). Reduced motion → static full line. */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 start-0 top-0 w-0.5 rounded-full bg-border"
          >
            {reduced ? (
              <div className="h-full w-full origin-top rounded-full bg-gradient-to-b from-primary via-primary/70 to-primary/30" />
            ) : (
              <motion.div
                className="h-full w-full origin-top rounded-full bg-gradient-to-b from-primary via-primary/70 to-primary/30"
                style={{ scaleY: scrollYProgress }}
              />
            )}
          </div>
          {/* Start-side gutter hosts the rail + per-card dots; sticky
              containment is preserved — the steps' direct parent box is
              geometrically identical to the previous single stack. */}
          <div className="space-y-4 ps-5 sm:space-y-6 sm:ps-7">
            {STEPS.map((step, i) => (
              <MethodologyStep
                key={step.key}
                step={step}
                index={i}
                total={STEPS.length}
                progress={scrollYProgress}
                reduced={reduced}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
