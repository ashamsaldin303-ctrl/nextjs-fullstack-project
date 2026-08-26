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

/* UI-3: incoming webhook bodies — literal JSON shown verbatim (never
 * translated). Numbers/booleans/strings only; rendered by jsonLines().
 */
type JsonValue = string | number | boolean | { [key: string]: JsonValue }

const PAYLOADS: Record<ScenarioId, JsonValue> = {
  newOrder: {
    event: 'lead.created',
    name: 'Zeinab H.',
    email: 'zeinab@example.com',
    source: 'website:hero',
    estimate: { tier: 'growth', weeks: 9 },
    ts: '2025-11-03T14:02:11.482Z',
  },
  paymentReminder: {
    event: 'invoice.due',
    invoice: 'INV-2041',
    client: 'Nour K.',
    amount: 2400,
    currency: 'USD',
    overdue_days: 3,
    ts: '2025-11-03T14:02:11.482Z',
  },
  weeklyReport: {
    event: 'cron.triggered',
    schedule: '0 9 * * SUN',
    timezone: 'Asia/Damascus',
    window_days: 7,
    recipients: 4,
    ts: '2025-11-03T14:02:11.482Z',
  },
}

const JSON_CLS = {
  key: 'text-g-blue',
  string: 'text-g-green',
  number: 'text-g-yellow',
  punct: 'text-white/40',
} as const

interface JsonToken {
  text: string
  cls: string
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object'
}

function scalarToken(value: Exclude<JsonValue, { [key: string]: JsonValue }>): JsonToken {
  if (typeof value === 'string') return { text: JSON.stringify(value), cls: JSON_CLS.string }
  if (typeof value === 'number') return { text: String(value), cls: JSON_CLS.number }
  return { text: String(value), cls: JSON_CLS.number } // boolean
}

/** Pretty-prints a JsonValue into syntax-colored display lines (2-space indent). */
function jsonLines(value: JsonValue, indent = 0): JsonToken[][] {
  if (!isJsonObject(value)) return [[scalarToken(value)]]
  const pad = '  '.repeat(indent)
  const lines: JsonToken[][] = [[{ text: '{', cls: JSON_CLS.punct }]]
  const entries = Object.entries(value)
  entries.forEach(([key, val], i) => {
    const comma = i < entries.length - 1
    const keyTok: JsonToken = { text: `${pad}  ${JSON.stringify(key)}`, cls: JSON_CLS.key }
    if (isJsonObject(val)) {
      lines.push([keyTok, { text: ': ', cls: JSON_CLS.punct }])
      const nested = jsonLines(val, indent + 1)
      if (comma) {
        const lastLine = nested[nested.length - 1]
        const lastTok = lastLine?.[lastLine.length - 1]
        if (lastTok) lastTok.text += ','
      }
      nested.forEach((line) => lines.push(line))
    } else {
      const tok = scalarToken(val)
      lines.push([
        keyTok,
        { text: ': ', cls: JSON_CLS.punct },
        { text: tok.text + (comma ? ',' : ''), cls: tok.cls },
      ])
    }
  })
  lines.push([{ text: `${pad}}`, cls: JSON_CLS.punct }])
  return lines
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
  const [payloadFlash, setPayloadFlash] = useState(false) // UI-3: "payload arrived" highlight

  const timeouts = useRef<number[]>([])
  const rafRef = useRef<number>(0)
  const logSeq = useRef(0) // UI-3: stable id sequence for log lines
  const logScrollRef = useRef<HTMLDivElement | null>(null)

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
    setPayloadFlash(false)
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

    // UI-3: fresh log — the "webhook received" entry line comes first.
    logSeq.current += 1
    setLogLines([{
      id: logSeq.current,
      time: logTimestamp(new Date()),
      kind: 'entry',
      text: FLOW_ENTRY[scenario],
    }])
    // UI-3: payload panel flashes "arrived" (~1s, cleaned with the rest).
    setPayloadFlash(true)
    schedule(() => setPayloadFlash(false), 1000)

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
        text: 'flow complete',
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

  // UI-3: syntax-highlighted payload lines for the active scenario.
  const payloadLines = useMemo(() => jsonLines(PAYLOADS[scenario]), [scenario])

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
            n8n nodes panel (technical context, not just a magnet snap).
            LOW-11: the min-w-[680px] stage overflows below ~712px, so the
            wrapper is a labelled, focusable region (keyboard-scrollable
            via arrows once focused) + a visible md:hidden hint. */}
        <div
          className="mt-10 overflow-x-auto scroll-dark no-scrollbar rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
            {/* Static stage skin + (motion-allowed only) keyframes. The
                global reduced-motion kill-switch is the backstop; these
                guards keep motion off at the source. */}
            <style>{`
              .elyra-dotgrid {
                background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.5px);
                background-size: 24px 24px;
              }
              /* Real monospace stack for the terminal/log/JSON panels —
                 the global --font-mono token is aliased to Inter, which
                 is not a monospace face. */
              .elyra-mono {
                font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace;
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
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md">
            <dt className="text-[11px] text-white/60">{t('stats.steps')}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{stepCount}</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md">
            <dt className="text-[11px] text-white/60">{t('stats.total')}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{totalDisplay}ms</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md">
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
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md sm:p-6 lg:col-span-3">
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
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md lg:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">{t('logTitle')}</h3>
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
                <p className="text-white/50">{'// awaiting trigger...'}</p>
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

        {/* UI-3: incoming payload viewer — literal JSON, never translated.
            Brief border+glow highlight when a run starts ("payload
            arrived"), fading back after ~1s. */}
        <div
          className={cn(
            'mt-4 overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-md transition-[border-color,box-shadow] duration-700',
            payloadFlash ? 'border-primary/60' : 'border-white/10',
            payloadFlash && !reduced && 'shadow-[0_0_32px_rgba(0,113,227,0.28)]'
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">{t('payloadTitle')}</h3>
            <span aria-hidden="true" dir="ltr" className="elyra-mono text-[10px] text-white/50">
              {FLOW_ENTRY[scenario]}
            </span>
          </div>
          <div dir="ltr" className="scroll-dark overflow-x-auto px-4 py-3">
            <pre className="elyra-mono font-mono text-[11px] leading-relaxed">
              <code className="block">
                {payloadLines.map((tokens, i) => (
                  <span key={i} className="block whitespace-pre">
                    {tokens.map((tok, j) => (
                      <span key={j} className={tok.cls}>{tok.text}</span>
                    ))}
                  </span>
                ))}
              </code>
            </pre>
          </div>
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
