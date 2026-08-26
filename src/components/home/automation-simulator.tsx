'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Inbox, Database, KanbanSquare, Mail, Send,
  FileText, Clock, CalendarClock, BarChart3, RefreshCw,
  Play, RotateCw, Check,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsRtl } from '@/lib/use-rtl'
import { SectionHeading } from '@/components/shared/section-heading'
import { playSuccess } from '@/lib/sound'

type StepId =
  | 'receive' | 'validate' | 'crm' | 'email' | 'telegram'
  | 'invoice' | 'schedule' | 'update'
  | 'trigger' | 'collect' | 'analyze' | 'report' | 'notify'

interface StepDef {
  id: StepId
  icon: LucideIcon
}

type ScenarioId = 'newOrder' | 'paymentReminder' | 'weeklyReport'

const SCENARIOS: Record<ScenarioId, StepDef[]> = {
  newOrder: [
    { id: 'receive', icon: Inbox },
    { id: 'validate', icon: Database },
    { id: 'crm', icon: KanbanSquare },
    { id: 'email', icon: Mail },
    { id: 'telegram', icon: Send },
  ],
  paymentReminder: [
    { id: 'invoice', icon: FileText },
    { id: 'schedule', icon: Clock },
    { id: 'email', icon: Mail },
    { id: 'telegram', icon: Send },
    { id: 'update', icon: RefreshCw },
  ],
  weeklyReport: [
    { id: 'trigger', icon: CalendarClock },
    { id: 'collect', icon: Database },
    { id: 'analyze', icon: BarChart3 },
    { id: 'report', icon: FileText },
    { id: 'notify', icon: Send },
  ],
}

const NODE_Y = 140 // svg viewBox y center for nodes
const VIEW_W = 1000
const VIEW_H = 280

interface SimulatorProps {
  scenario?: ScenarioId
  showScenarioPicker?: boolean
}

export function AutomationSimulator({
  scenario: initialScenario = 'newOrder',
  showScenarioPicker = false,
}: SimulatorProps) {
  const t = useTranslations('simulator')
  const isRtl = useIsRtl()
  const reduced = useReducedMotion()

  const [scenario, setScenario] = useState<ScenarioId>(initialScenario)
  const steps = SCENARIOS[scenario]
  const stepCount = steps.length

  // node center positions in % (RTL mirrors the order so the flow reads naturally)
  const positions = useMemo(() => {
    const ltr = [8, 29, 50, 71, 92]
    return isRtl ? [...ltr].reverse() : ltr
  }, [isRtl])

  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle')
  const [currentStep, setCurrentStep] = useState(-1)
  const [completed, setCompleted] = useState<number[]>([])
  const [counter, setCounter] = useState(0) // live ms counter for current step

  const timeouts = useRef<number[]>([])
  const rafRef = useRef<number>(0)

  const clearAll = useCallback(() => {
    timeouts.current.forEach((id) => window.clearTimeout(id))
    timeouts.current = []
    cancelAnimationFrame(rafRef.current)
  }, [])

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timeouts.current.push(id)
  }, [])

  useEffect(() => () => clearAll(), [clearAll])

  const reset = useCallback(() => {
    clearAll()
    setStatus('idle')
    setCurrentStep(-1)
    setCompleted([])
    setCounter(0)
  }, [clearAll])

  // Reset whenever scenario changes — deferred to rAF so the setStates
  // inside reset() aren't called synchronously within the effect body.
  useEffect(() => {
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (!cancelled) reset()
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [scenario, reset])

  const run = useCallback(() => {
    clearAll()
    setCompleted([])
    setCounter(0)
    setStatus('running')
    setCurrentStep(0)

    const STEP_DISPLAY = reduced ? 250 : 850
    const TRANSITION = reduced ? 80 : 320

    steps.forEach((step, i) => {
      const startAt = i * (STEP_DISPLAY + TRANSITION)
      schedule(() => {
        setCurrentStep(i)
        // animate counter 0 → step.ms over STEP_DISPLAY
        const stepMs = t.raw(`scenarios.${scenario}.steps.${step.id}.ms`) as number
        const target = Number(stepMs)
        if (reduced) {
          setCounter(target)
        } else {
          const start = performance.now()
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / STEP_DISPLAY)
            const eased = 1 - Math.pow(1 - p, 3)
            setCounter(Math.round(eased * target))
            if (p < 1) rafRef.current = requestAnimationFrame(tick)
          }
          rafRef.current = requestAnimationFrame(tick)
        }
      }, startAt)

      schedule(() => {
        setCompleted((c) => (c.includes(i) ? c : [...c, i]))
      }, startAt + STEP_DISPLAY)
    })

    schedule(() => {
      setStatus('completed')
      setCurrentStep(-1)
      setCounter(0)
      playSuccess() // Phase 2 sensory feedback (no-op while muted)
    }, steps.length * (STEP_DISPLAY + TRANSITION))
  }, [clearAll, reduced, steps, scenario, t, schedule])

  const totalMs = useMemo(() => {
    return steps.reduce((acc, step) => {
      const ms = Number(t.raw(`scenarios.${scenario}.steps.${step.id}.ms`))
      return acc + (Number.isFinite(ms) ? ms : 0)
    }, 0)
  }, [steps, scenario, t])

  const secondsLabel = (totalMs / 1000).toFixed(2)

  // current step def
  const activeStep = currentStep >= 0 ? steps[currentStep] : null
  const activeStepTitle = activeStep ? t(`scenarios.${scenario}.steps.${activeStep.id}.title`) : null
  const activeStepDesc = activeStep ? t(`scenarios.${scenario}.steps.${activeStep.id}.desc`) : null
  const activeStepMs = activeStep ? Number(t.raw(`scenarios.${scenario}.steps.${activeStep.id}.ms`)) : 0

  return (
    <section className="bg-elyra-deep py-20 text-elyra-on-dark sm:py-28" aria-labelledby="sim-title">
      <div className="elyra-container max-w-container">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          variant="on-dark"
        />

        {showScenarioPicker ? (
          <div className="mt-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label={t('title')}>
            {(['newOrder', 'paymentReminder', 'weeklyReport'] as ScenarioId[]).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                data-cursor="magnet"
                aria-selected={scenario === s}
                onClick={() => setScenario(s)}
                className={cn(
                  'inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors',
                  scenario === s
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
                )}
              >
                {t(`scenarios.${s}.label`)}
              </button>
            ))}
          </div>
        ) : null}

        {/* Stage — Phase 5 WS-7: data-cursor="inspect" so the magnetic
            cursor shows the localized 'Inspect element' chip over the
            n8n nodes panel (technical context, not just a magnet snap). */}
        <div className="mt-10 overflow-x-auto scroll-dark no-scrollbar" data-cursor="inspect">
          <div className="relative min-w-[680px]" style={{ height: '260px' }}>
            {/* SVG edges */}
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="absolute inset-0 size-full"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="elyra-edge" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0071E3" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#0071E3" stopOpacity="1" />
                  <stop offset="100%" stopColor="#34A853" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              {steps.slice(0, -1).map((_, i) => {
                const x1 = ((positions[i] ?? 0) / 100) * VIEW_W
                const x2 = ((positions[i + 1] ?? 0) / 100) * VIEW_W
                const edgeActive = currentStep === i + 1
                const edgeDone = currentStep > i + 1 || (completed.includes(i) && completed.includes(i + 1)) || (status === 'completed' && completed.includes(i))
                const stroke = edgeActive ? 'url(#elyra-edge)' : edgeDone ? 'rgba(0,113,227,0.45)' : 'rgba(255,255,255,0.10)'
                return (
                  <line
                    key={i}
                    x1={x1} y1={NODE_Y} x2={x2} y2={NODE_Y}
                    stroke={stroke}
                    strokeWidth={2}
                    strokeDasharray={edgeActive ? '6 6' : undefined}
                    className={edgeActive && !reduced ? 'elyra-flow' : undefined}
                  />
                )
              })}
            </svg>
            {!reduced ? (
              <style>{`@keyframes elyra-flow { to { stroke-dashoffset: -24 } } .elyra-flow { animation: elyra-flow 0.8s linear infinite; }`}</style>
            ) : null}

            {/* HTML nodes — positioned to align with SVG node centers */}
            {steps.map((step, i) => {
              const Icon = step.icon
              const isActive = currentStep === i
              const isDone = completed.includes(i)
              const xPercent = positions[i]
              if (!xPercent) return null
              return (
                <div
                  key={`${scenario}-${step.id}`}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: `${xPercent}%`, top: '46%' }}
                >
                  <div
                    className={cn(
                      'relative flex size-16 items-center justify-center rounded-2xl border backdrop-blur-md transition-all duration-300',
                      isActive && 'border-primary bg-primary/20 shadow-[0_0_28px_rgba(0,113,227,0.55)]',
                      isDone && 'border-g-green/70 bg-g-green/15',
                      !isActive && !isDone && 'border-white/15 bg-white/5'
                    )}
                  >
                    {isActive && !reduced ? (
                      <motion.span
                        className="absolute inset-0 rounded-2xl border-2 border-primary/50"
                        animate={{ boxShadow: ['0 0 0 0 rgba(0,113,227,0.5)', '0 0 0 12px rgba(0,113,227,0)'] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        'size-6 transition-colors',
                        isActive ? 'text-white' : isDone ? 'text-g-green' : 'text-white/60'
                      )}
                      aria-hidden="true"
                    />
                    {isDone ? (
                      <span className="absolute -top-1.5 -end-1.5 flex size-5 items-center justify-center rounded-full bg-g-green text-white">
                        <Check className="size-3" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                  <p className={cn(
                    'mt-2 max-w-[110px] text-center text-xs leading-tight',
                    isActive ? 'text-white' : 'text-white/55'
                  )}>
                    {t(`scenarios.${scenario}.steps.${step.id}.title`)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Step card */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/60">
              {status === 'idle' ? t('idle') : status === 'running' ? t('running') : t('completed', { seconds: secondsLabel })}
            </p>
            <p className="text-xs text-white/40">
              {status === 'running' && activeStep
                ? t('stepOf', { current: currentStep + 1, total: stepCount })
                : status === 'completed'
                  ? t('completed', { seconds: secondsLabel })
                  : ''}
            </p>
          </div>

          {activeStep && status === 'running' ? (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-white">{activeStepTitle}</h3>
              <p className="mt-1 text-sm text-white/70">{activeStepDesc}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
                <span className="tabular-nums text-g-green">{counter}ms</span>
                <span>/ {activeStepMs}ms</span>
              </div>
            </div>
          ) : null}

          {status === 'completed' ? (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-white">{t('completed', { seconds: secondsLabel })}</h3>
              <p className="mt-1 text-sm text-white/70">{t('subtitle')}</p>
            </div>
          ) : null}

          {/* Log of completed steps */}
          {completed.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {completed.map((idx) => {
                const step = steps[idx]
                if (!step) return null
                const ms = Number(t.raw(`scenarios.${scenario}.steps.${step.id}.ms`))
                return (
                  <li key={step.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 text-white/70">
                      <Check className="size-3 text-g-green" aria-hidden="true" />
                      {t(`scenarios.${scenario}.steps.${step.id}.title`)}
                    </span>
                    <span className="tabular-nums text-white/40">{ms}ms</span>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>

        {/* Controls */}
        <div className="mt-6 flex justify-center gap-3">
          {status !== 'running' ? (
            <button
              type="button"
              data-cursor="magnet"
              onClick={run}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
            >
              {status === 'completed' ? <RotateCw className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
              {status === 'completed' ? t('replay') : t('run')}
            </button>
          ) : (
            <span className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-6 text-sm text-white/60">
              <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
              {t('running')}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
