'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
import { useRouter } from '@/i18n/navigation'
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

/* UI-3 ───────────────────────────────────────────────────────────────
 * Literal (non-translated) technical metadata for the enriched stage:
 * per-step node type badges and per-scenario trigger/entry lines.
 */
const NODE_TYPE: Record<StepId, string> = {
  receive: 'WEBHOOK', validate: 'VALIDATE', crm: 'CRM', email: 'EMAIL', telegram: 'TG',
  invoice: 'FILE', schedule: 'CRON', update: 'DB',
  trigger: 'CRON', collect: 'QUERY', analyze: 'AI', report: 'DOC', notify: 'PUSH',
}

const FLOW_ENTRY: Record<ScenarioId, string> = {
  newOrder: 'POST /webhook/elyra-lead 200',
  paymentReminder: 'POST /webhook/invoice-reminder 200',
  weeklyReport: 'CRON 0 9 * * SUN · fired',
}

/** UI-3: wall-clock timestamp for log lines — HH:MM:SS.mmm, LTR-safe. */
function logTimestamp(date: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0')
  const p3 = (n: number) => String(n).padStart(3, '0')
  return `${p2(date.getHours())}:${p2(date.getMinutes())}:${p2(date.getSeconds())}.${p3(date.getMilliseconds())}`
}

interface LogLine {
  id: number
  time: string
  kind: 'entry' | 'step' | 'done'
  text: string
  ms?: number
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
  // Batch 2 item 9: locale-aware router (@/i18n/navigation) for the
  // post-run completion CTA → /contact?service=automation.
  const router = useRouter()

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
  const [logLines, setLogLines] = useState<LogLine[]>([]) // UI-3: execution log

  const timeouts = useRef<number[]>([])
  const rafRef = useRef<number>(0)
  const logSeq = useRef(0) // UI-3: stable id sequence for log lines
  const logScrollRef = useRef<HTMLDivElement | null>(null)
  // R9: the nodes stage — the run button sits ABOVE it now, and run()
  // scrolls it into view so the user always watches the nodes work.
  const stageRef = useRef<HTMLDivElement | null>(null)

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
    setLogLines([]) // UI-3: log clears on scenario change
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

  // UI-3: keep the newest log line in view (instant jump — functional
  // scrolling, not an animation, so it stays under reduced motion).
  useEffect(() => {
    const el = logScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logLines])

  const totalMs = useMemo(() => {
    return steps.reduce((acc, step) => {
      const ms = Number(t.raw(`scenarios.${scenario}.steps.${step.id}.ms`))
      return acc + (Number.isFinite(ms) ? ms : 0)
    }, 0)
  }, [steps, scenario, t])

  const run = useCallback(() => {
    clearAll()
    setCompleted([])
    setCounter(0)
    setStatus('running')
    setCurrentStep(0)

    // R9 (user request — "the button rises and the user sees the nodes
    // working"): the run button now lives directly ABOVE the stage, and a
    // run glides the stage itself into comfortable view (only when it
    // isn't already fully visible), so the nodes lighting up are never
    // happening offscreen below the fold. NOTE: window.scrollTo with
    // computed math, NOT element.scrollIntoView — the stage wrapper is
    // itself a scroll container (overflow-x-auto for the 680px min-width
    // canvas), and Chromium routes scrollIntoView into the stage's own
    // (non-scrollable) axis, leaving the page untouched (verified live).
    // Reduced motion: behavior 'auto'.
    requestAnimationFrame(() => {
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
      if (!fullyVisible) {
        const target =
          window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2
        window.scrollTo({
          top: Math.max(0, target),
          behavior: reduced ? 'auto' : 'smooth',
        })
      }
    })

    // UI-3: fresh log — the "webhook received" entry line comes first.
    logSeq.current += 1
    setLogLines([{
      id: logSeq.current,
      time: logTimestamp(new Date()),
      kind: 'entry',
      text: FLOW_ENTRY[scenario],
    }])

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
        // UI-3: timestamped log line appended at completion time.
        const ms = Number(t.raw(`scenarios.${scenario}.steps.${step.id}.ms`))
        logSeq.current += 1
        setLogLines((prev) => [...prev, {
          id: logSeq.current,
          time: logTimestamp(new Date()),
          kind: 'step',
          text: t(`scenarios.${scenario}.steps.${step.id}.title`),
          ms: Number.isFinite(ms) ? ms : 0,
        }])
      }, startAt + STEP_DISPLAY)
    })

    schedule(() => {
      setStatus('completed')
      setCurrentStep(-1)
      setCounter(0)
      playSuccess() // Phase 2 sensory feedback (no-op while muted)
      // UI-3: final summary line for the terminal.
      logSeq.current += 1
      setLogLines((prev) => [...prev, {
        id: logSeq.current,
        time: logTimestamp(new Date()),
        kind: 'done',
        text: t('flowComplete'),
        ms: totalMs,
      }])
    }, steps.length * (STEP_DISPLAY + TRANSITION))
  }, [clearAll, reduced, steps, scenario, t, schedule, totalMs])

  const secondsLabel = (totalMs / 1000).toFixed(2)

  // current step def
  const activeStep = currentStep >= 0 ? steps[currentStep] : null
  const activeStepTitle = activeStep ? t(`scenarios.${scenario}.steps.${activeStep.id}.title`) : null
  const activeStepDesc = activeStep ? t(`scenarios.${scenario}.steps.${activeStep.id}.desc`) : null
  const activeStepMs = activeStep ? Number(t.raw(`scenarios.${scenario}.steps.${activeStep.id}.ms`)) : 0

  // UI-3: stats chip values — live elapsed while running (finished steps +
  // in-flight counter; during the inter-step transition the active step is
  // already in `completed`, so the counter is never double-counted),
  // expected/final total otherwise.
  const completedMsSum = useMemo(() => completed.reduce((acc, i) => {
    const step = steps[i]
    if (!step) return acc
    const ms = Number(t.raw(`scenarios.${scenario}.steps.${step.id}.ms`))
    return acc + (Number.isFinite(ms) ? ms : 0)
  }, 0), [completed, steps, scenario, t])
  const inFlightMs = currentStep >= 0 && !completed.includes(currentStep) ? counter : 0
  const totalDisplay = status === 'running' ? completedMsSum + inFlightMs : totalMs

  const statusDotCls = status === 'running'
    ? 'bg-primary'
    : status === 'completed'
      ? 'bg-g-green'
      : 'bg-white/40'

  return (
    <section className="bg-elyra-deep py-20 text-elyra-on-dark sm:py-28" aria-labelledby="sim-title">
      <div className="elyra-container max-w-container">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          variant="on-dark"
          titleId="sim-title"
        />

        {showScenarioPicker ? (
          // FIX(2-c/14): plain toggle-button group — the previous
          // role="tablist"/"tab" markup had no tabpanels, no aria-controls
          // and no roving tabindex, which is an incomplete (broken) tabs
          // pattern. These are scenario switches, not tabs.
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {(['newOrder', 'paymentReminder', 'weeklyReport'] as ScenarioId[]).map((s) => (
              <button
                key={s}
                type="button"
                data-cursor="magnet"
                aria-pressed={scenario === s}
                onClick={() => setScenario(s)}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors',
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

        {/* R9 (user request — "the button rises up and moves the nodes
            itself"): the run control now sits directly ABOVE the nodes
            stage, so a click starts the flow right where the eyes already
            are, and run() glides the stage into view when needed. The
            button also gets a gentle rise-in on mount (sim-btn-rise). */}
        <div className="mt-8 flex flex-col items-center gap-3">
          {status !== 'running' ? (
            <button
              type="button"
              data-cursor="magnet"
              onClick={run}
              className="sim-btn-rise inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-[0_10px_30px_-10px_rgba(0,113,227,0.7)] transition-transform hover:scale-105 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark motion-reduce:animate-none"
            >
              {status === 'completed' ? <RotateCw className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
              {status === 'completed' ? t('replay') : t('run')}
            </button>
          ) : (
            <span className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-8 text-sm text-white/60">
              <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
              {t('running')}
            </span>
          )}
        </div>

        {/* Stage — Phase 5 WS-7: data-cursor="inspect" so the magnetic
            cursor shows the localized 'Inspect element' chip over the
            n8n nodes panel (technical context, not just a magnet snap).
            LOW-11: the min-w-[680px] stage overflows below ~712px, so the
            wrapper is a labelled, focusable region (keyboard-scrollable
            via arrows once focused) + a visible md:hidden hint.
            R9: stageRef anchors run()'s scroll-into-view. */}
        <div
          ref={stageRef}
          className="mt-6 overflow-x-auto scroll-dark no-scrollbar rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          data-cursor="inspect"
          tabIndex={0}
          role="region"
          aria-label={t('scrollHint')}
        >
          <div
            className="elyra-dotgrid relative min-w-[680px]"
            style={{ height: '260px' }}
          >
            {/* SVG edges */}
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="absolute inset-0 size-full"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="elyra-edge" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4285F4" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#4285F4" stopOpacity="1" />
                  <stop offset="100%" stopColor="#34A853" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              {steps.slice(0, -1).map((_, i) => {
                const x1 = ((positions[i] ?? 0) / 100) * VIEW_W
                const x2 = ((positions[i + 1] ?? 0) / 100) * VIEW_W
                const edgeActive = currentStep === i + 1
                const edgeDone = currentStep > i + 1 || (completed.includes(i) && completed.includes(i + 1)) || (status === 'completed' && completed.includes(i))
                const stroke = edgeActive ? 'url(#elyra-edge)' : edgeDone ? 'rgba(66,133,244,0.45)' : 'rgba(255,255,255,0.10)'
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
            {/* Static stage skin + (motion-allowed only) keyframes. The
                global reduced-motion kill-switch is the backstop; these
                guards keep motion off at the source. */}
            <style>{`
              .elyra-dotgrid {
                background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.5px);
                background-size: 24px 24px;
              }
              /* Real monospace for the terminal/log panels — the
                 global --font-mono token resolves to JetBrains Mono
                 (next/font, Batch 1 item 3 / I-1); the panels below are
                 already dir="ltr" so Latin tokens align correctly. */
              .elyra-mono {
                font-family: var(--font-mono);
              }
              /* R9: run button rise-in — settles above the stage. */
              @keyframes sim-btn-rise {
                from { opacity: 0; transform: translateY(14px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              .sim-btn-rise {
                opacity: 0;
                animation: sim-btn-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
              }
            `}</style>
            {!reduced ? (
              <style>{`
                @keyframes elyra-flow { to { stroke-dashoffset: -24 } }
                .elyra-flow { animation: elyra-flow 0.8s linear infinite; }
                /* UI-3: traveling packet along the active edge — travels
                   between the two node centers (physical left; RTL is
                   handled by the mirrored positions array). */
                @keyframes elyra-packet {
                  0% { left: var(--from); opacity: 0 }
                  12% { opacity: 1 }
                  88% { opacity: 1 }
                  100% { left: var(--to); opacity: 0 }
                }
                .elyra-packet { left: var(--from); animation: elyra-packet 1.05s linear infinite; }
                /* UI-3: log line entry (fade/slide, one-shot). */
                @keyframes elyra-log-in {
                  from { opacity: 0; transform: translateY(4px) }
                  to { opacity: 1; transform: translateY(0) }
                }
                .elyra-log-line { animation: elyra-log-in 0.25s ease-out both; }
                /* UI-3: one-shot g-green ring flash when a flow completes. */
                @keyframes elyra-node-flash {
                  0% { box-shadow: 0 0 0 0 rgba(52,168,83,0.55) }
                  100% { box-shadow: 0 0 0 16px rgba(52,168,83,0) }
                }
                .elyra-node-flash { animation: elyra-node-flash 0.8s ease-out 1; }
              `}</style>
            ) : null}

            {/* UI-3: packet dots travel the active edge (below the nodes,
                so they emerge from / disappear into each node). */}
            {!reduced
              ? steps.slice(0, -1).map((_, i) => {
                  if (currentStep !== i + 1) return null
                  const from = positions[i]
                  const to = positions[i + 1]
                  if (from == null || to == null) return null
                  return (
                    <span
                      key={`packet-${i}`}
                      aria-hidden="true"
                      className="elyra-packet absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_rgba(0,113,227,0.95)]"
                      style={{ '--from': `${from}%`, '--to': `${to}%` } as CSSProperties}
                    />
                  )
                })
              : null}

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
                  {/* UI-3: literal tech type badge (decorative — aria-hidden). */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'elyra-mono mb-1.5 text-[8px] uppercase tracking-[0.18em]',
                      isActive ? 'text-g-blue' : 'text-white/55'
                    )}
                  >
                    {NODE_TYPE[step.id]}
                  </span>
                  <div
                    className={cn(
                      'relative flex size-16 items-center justify-center rounded-2xl border backdrop-blur-md transition-all duration-300',
                      isActive && 'border-primary bg-primary/20 shadow-[0_0_28px_rgba(0,113,227,0.55)]',
                      isDone && 'border-g-green/70 bg-g-green/15',
                      !isActive && !isDone && 'border-white/15 bg-white/5',
                      status === 'completed' && !reduced && 'elyra-node-flash'
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
        {/* LOW-11: visible horizontal-scroll hint — the stage only
            overflows below ~712px (min-w-[680px] + container padding),
            so it is hidden from md (768px) up. Key exists in both
            catalogs (ar/en simulator.scrollHint). */}
        <p className="mt-2 text-center text-xs text-white/55 md:hidden">
          {t('scrollHint')}
        </p>

        {/* UI-3: compact run stats. No aria-live here on purpose — status
            changes are announced once by the polite region inside the
            step card (MED-8 dedup semantics stay authoritative). */}
        <dl className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <dt className="text-[11px] text-white/60">{t('stats.steps')}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{stepCount}</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <dt className="text-[11px] text-white/60">{t('stats.total')}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{totalDisplay}ms</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <dt className="text-[11px] text-white/60">{t('stats.status')}</dt>
            <dd className="mt-1 flex items-center gap-2 text-base font-semibold text-white">
              <span
                aria-hidden="true"
                className={cn('size-2 shrink-0 rounded-full', statusDotCls, status === 'running' && 'animate-pulse')}
              />
              {t(`state.${status}`)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          {/* Step card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 lg:col-span-3">
            {/* MED-8: live region for status changes (idle/running/stepOf).
                The per-frame ms counter below is deliberately OUTSIDE this
                region — polite announcements happen on status/step change
                only, not every animation frame. */}
            <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
              {/* FIX(2-c/13): the completion sentence used to render 3×
                  (status row left + right + h3). The h3 below is now the
                  single completion announcement; the status row only
                  carries idle/running + step progress. */}
              <p className="text-sm text-white/60">
                {status === 'idle' ? t('idle') : status === 'running' ? t('running') : null}
              </p>
              <p className="text-xs text-white/60">
                {status === 'running' && activeStep
                  ? t('stepOf', { current: currentStep + 1, total: stepCount })
                  : null}
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
                {/* MED-8: the completion announcement point (see comment
                    above) — polite, fires once when the flow finishes. */}
                <h3 className="text-lg font-semibold text-white" aria-live="polite">{t('completed', { seconds: secondsLabel })}</h3>
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
                      <span className="tabular-nums text-white/60">{ms}ms</span>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>

          {/* UI-3: execution log terminal. Supplementary panel — role="log"
              with an explicit aria-live="off" override so it NEVER
              duplicates the polite announcements from the step card.
              dir="ltr" keeps timestamps/monospace alignment correct even
              on the Arabic RTL page. */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/50 lg:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/85">{t('logTitle')}</h3>
              <span
                aria-hidden="true"
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  status === 'idle' ? 'bg-white/30' : statusDotCls,
                  status === 'running' && 'animate-pulse'
                )}
              />
            </div>
            <div
              ref={logScrollRef}
              role="log"
              aria-live="off"
              dir="ltr"
              className="elyra-mono scroll-dark max-h-48 min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed"
            >
              {logLines.length === 0 ? (
                // literal JS-style comment as the terminal's idle hint
                // (L6-F1: catalog key simulator.awaiting — the ar copy carries
                // its own "//" prefix so the terminal chrome stays identical)
                <p className="text-white/50">{t('awaiting')}</p>
              ) : (
                logLines.map((line) => (
                  <div key={line.id} dir="ltr" className={cn('whitespace-pre', !reduced && 'elyra-log-line')}>
                    <span className="text-white/50">[{line.time}] </span>
                    {line.kind === 'entry' ? (
                      <span className="text-primary">→ </span>
                    ) : (
                      <span className="text-g-green">✓ </span>
                    )}
                    <span
                      className={cn(
                        line.kind === 'entry'
                          ? 'text-g-blue'
                          : line.kind === 'done'
                            ? 'text-g-green'
                            : 'text-white/80'
                      )}
                    >
                      {line.text}
                    </span>
                    {typeof line.ms === 'number' ? (
                      <>
                        <span className="text-white/40"> — </span>
                        <span className="tabular-nums text-white/50">{line.ms}ms</span>
                      </>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* R9 (user request): the "incoming payload" JSON viewer was
            REMOVED from the live-automation section (simulator.payloadTitle
            key dropped from both catalogs; PAYLOADS/jsonLines helpers
            deleted). The execution-log terminal above remains. */}

        {/* Completion — Batch 2 item 9: the finished run converts instead
            of dead-ending: completion title + CTA to a prefilled contact
            request (URL contract: /contact?service=automation, locale-
            correct via @/i18n/navigation's router). The run/replay control
            itself now lives ABOVE the nodes stage (R9). */}
        {status === 'completed' ? (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium text-white/85">{t('completionTitle')}</p>
            <button
              type="button"
              data-cursor="magnet"
              onClick={() => router.push('/contact?service=automation')}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-g-green/40 bg-g-green/15 px-6 text-sm font-medium text-white transition-colors hover:bg-g-green/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
            >
              <Send className="size-4" aria-hidden="true" />
              {t('completionCta')}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
