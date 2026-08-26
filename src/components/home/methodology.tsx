'use client'

import { useTranslations } from 'next-intl'
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion'
import { useRef } from 'react'
import { Compass, PencilRuler, Hammer, Rocket, type LucideIcon } from 'lucide-react'
import { SectionHeading } from '@/components/shared/section-heading'
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
        'relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10',
        'sticky top-24',
      )}
    >
      <span
        className="pointer-events-none absolute -end-4 -top-4 text-[120px] font-bold leading-none text-primary/5 sm:text-[160px]"
        aria-hidden="true"
      >
        {String(index + 1).padStart(2, '0')}
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
        <div className="hidden size-16 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground sm:flex">
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

  return (
    <section className="bg-background py-20 sm:py-28" aria-labelledby="method-title">
      <div className="elyra-container max-w-container">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          titleId="method-title"
        />
        <div ref={containerRef} className="mt-14 space-y-4 sm:space-y-6">
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
    </section>
  )
}
