'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { z } from 'zod'
import {
  Globe, Workflow, Boxes, Check, ArrowLeft, ArrowRight,
  Send, RotateCw, AlertCircle,
} from 'lucide-react'
import {
  Slider,
} from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SectionHeading } from '@/components/shared/section-heading'
import { playSuccess } from '@/lib/sound'
import { toast } from 'sonner'
import { RingGauge } from './ring-gauge'
import {
  computeEstimate, formatMoney,
  type CalculatorInput, type ServiceType, type IntegrationKey,
  type AutomationLevel, type LanguageOption, type ThreeDOption,
} from '@/lib/calculator'

type Step = 0 | 1 | 2

const SERVICES: { id: ServiceType; icon: typeof Globe }[] = [
  { id: 'website', icon: Globe },
  { id: 'automation', icon: Workflow },
  { id: 'full', icon: Boxes },
]

const INTEGRATIONS: IntegrationKey[] = ['crm', 'invoicing', 'email', 'telegram', 'sheets', 'ai']

const leadSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  whatsapp: z.string().trim().optional(),
})

type LeadForm = z.infer<typeof leadSchema>

const INITIAL_INPUT: CalculatorInput = {
  service: 'website',
  pages: 6,
  languages: 'bilingual',
  threeD: 'no',
  integrations: [],
  automationLevel: 'essential',
}

export function Calculator() {
  const t = useTranslations('calculator')
  const locale = useLocale()
  const reduced = useReducedMotion()

  const [step, setStep] = useState<Step>(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [input, setInput] = useState<CalculatorInput>(INITIAL_INPUT)
  const [form, setForm] = useState<LeadForm>({ name: '', email: '', whatsapp: '' })
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  const result = useMemo(() => computeEstimate(input), [input])

  // Breakdown line labels — resolved once for type-safety (guide §4.6).
  const breakdownLabels = {
    base: t('result.base'),
    pages: t('result.pages'),
    bilingual: t('result.bilingual'),
    threeD: t('result.threeD'),
    integrations: t('result.integrations'),
    advanced: t('result.advanced'),
  } as const

  const goNext = () => { setDir(1); setStep((s) => Math.min(2, s + 1) as Step) }
  const goBack = () => { setDir(-1); setStep((s) => Math.max(0, s - 1) as Step) }

  const toggleIntegration = (key: IntegrationKey) => {
    setInput((p) => ({
      ...p,
      integrations: p.integrations.includes(key)
        ? p.integrations.filter((k) => k !== key)
        : [...p.integrations, key],
    }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = leadSchema.safeParse(form)
    if (!parsed.success) {
      const fe: { name?: string; email?: string } = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]
        if (path === 'name') fe.name = t('errors.name')
        if (path === 'email') fe.email = t('errors.email')
      }
      setErrors(fe)
      return
    }
    setErrors({})
    setSubmitting(true)
    // Phase 3: real storage — the server recomputes the estimate from the
    // wizard options and returns a reference (guide §2.9). Client numbers
    // are never sent: only the option set travels.
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-elyra-locale': locale,
        },
        body: JSON.stringify({
          source: 'calculator',
          name: parsed.data.name,
          email: parsed.data.email,
          whatsapp: parsed.data.whatsapp || undefined,
          service: input.service,
          pages: input.pages,
          languages: input.languages,
          threeD: input.threeD,
          integrations: input.integrations,
          automationLevel: input.automationLevel,
        }),
      })

      if (res.status === 201) {
        const data = (await res.json()) as { reference?: string }
        setReference(data.reference ?? null)
        setDone(true)
        playSuccess() // Phase 2 sensory feedback — fires on REAL success only
        return
      }

      // Server rejected: surface translated server-side messages.
      const data = (await res.json().catch(() => null)) as
        | { message?: string; fields?: Record<string, string> }
        | null
      if (res.status === 400 && data?.fields) {
        const fe: { name?: string; email?: string } = {}
        if (data.fields.name) fe.name = data.fields.name
        if (data.fields.email) fe.email = data.fields.email
        setErrors(fe)
      }
      toast.error(t('form.errorTitle'), {
        description: data?.message ?? t('form.errorNetwork'),
      })
    } catch {
      // Network failure — data stays in the form for a retry.
      toast.error(t('form.errorTitle'), { description: t('form.errorNetwork') })
    } finally {
      setSubmitting(false)
    }
  }

  const slideVariants = reduced
    ? undefined
    : {
        enter: (d: number) => ({ opacity: 0, x: d * 30 }),
        center: { opacity: 1, x: 0 },
        exit: (d: number) => ({ opacity: 0, x: -d * 30 }),
      }

  return (
    <section id="calculator" className="bg-background py-20 sm:py-28" aria-labelledby="calc-title" aria-label={t('kicker')}>
      <div className="elyra-container max-w-5xl">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
        />

        {/* Progress */}
        <div className="mt-10 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {t('step', { current: step + 1, total: 3 })}
          </p>
          <div className="flex flex-1 gap-2">
            {[0, 1, 2].map((s) => (
              <div
                key={s}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={false}
                  animate={{ width: step >= s ? '100%' : '0%' }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-8 overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* STEP 0 — Service type */}
              {step === 0 ? (
                <div>
                  <h3 className="text-lg font-semibold">{t('steps.service')}</h3>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {SERVICES.map(({ id, icon: Icon }) => {
                      const active = input.service === id
                      const isFull = id === 'full'
                      return (
                        <button
                          key={id}
                          type="button"
                          data-cursor="magnet"
                          onClick={() => setInput((p) => ({ ...p, service: id }))}
                          aria-pressed={active}
                          className={cn(
                            'group relative overflow-hidden rounded-2xl border p-5 text-start transition-all',
                            active
                              ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_var(--color-primary)]'
                              : 'border-border hover:border-primary/40 hover:bg-foreground/[0.02]'
                          )}
                        >
                          {isFull ? (
                            <span className="absolute end-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              {t('services.full.popular')}
                            </span>
                          ) : null}
                          <div className={cn(
                            'flex size-11 items-center justify-center rounded-xl transition-colors',
                            active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                          )}>
                            <Icon className="size-5" aria-hidden="true" />
                          </div>
                          <p className="mt-3 font-semibold">{t(`services.${id}.title`)}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{t(`services.${id}.desc`)}</p>
                          {active ? (
                            <span className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3.5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* STEP 1 — Features */}
              {step === 1 ? (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{t('pages')}</h3>
                      <span className="text-sm font-medium text-primary tabular-nums">
                        {t('pagesValue', { count: input.pages })}
                      </span>
                    </div>
                    <div className="mt-4 px-1">
                      <Slider
                        value={[input.pages]}
                        onValueChange={(v) => setInput((p) => ({ ...p, pages: v[0] ?? p.pages }))}
                        min={1}
                        max={20}
                        step={1}
                        aria-label={t('pages')}
                      />
                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>1</span><span>20</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold">{t('languages')}</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(['single', 'bilingual'] as LanguageOption[]).map((opt) => {
                        const active = input.languages === opt
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setInput((p) => ({ ...p, languages: opt }))}
                            aria-pressed={active}
                            className={cn(
                              'rounded-xl border px-4 py-3 text-start transition-colors',
                              active ? 'border-primary bg-primary/5' : 'border-border hover:bg-foreground/[0.02]'
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span className={cn('flex size-5 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                                {active ? <Check className="size-3" aria-hidden="true" /> : null}
                              </span>
                              <span className="text-sm font-medium">{t(`languagesOptions.${opt}`)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold">{t('threeD')}</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(['yes', 'no'] as ThreeDOption[]).map((opt) => {
                        const active = input.threeD === opt
                        const disabled = input.service === 'automation'
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={disabled}
                            onClick={() => setInput((p) => ({ ...p, threeD: opt }))}
                            aria-pressed={active}
                            className={cn(
                              'rounded-xl border px-4 py-3 text-start transition-colors',
                              disabled && 'opacity-50',
                              active ? 'border-primary bg-primary/5' : 'border-border hover:bg-foreground/[0.02]'
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span className={cn('flex size-5 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                                {active ? <Check className="size-3" aria-hidden="true" /> : null}
                              </span>
                              <span className="text-sm font-medium">{t(`threeDOptions.${opt}`)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold">{t('integrations')}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {INTEGRATIONS.map((key) => {
                        const active = input.integrations.includes(key)
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleIntegration(key)}
                            aria-pressed={active}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                              active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-foreground/[0.02]'
                            )}
                          >
                            <span className={cn('flex size-4 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                              {active ? <Check className="size-2.5" aria-hidden="true" /> : null}
                            </span>
                            {t(`integrationsOptions.${key}`)}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold">{t('automationLevel')}</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(['essential', 'advanced'] as AutomationLevel[]).map((opt) => {
                        const active = input.automationLevel === opt
                        const disabled = input.service === 'website'
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={disabled}
                            onClick={() => setInput((p) => ({ ...p, automationLevel: opt }))}
                            aria-pressed={active}
                            className={cn(
                              'rounded-xl border px-4 py-3 text-start transition-colors',
                              disabled && 'opacity-50',
                              active ? 'border-primary bg-primary/5' : 'border-border hover:bg-foreground/[0.02]'
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span className={cn('flex size-5 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                                {active ? <Check className="size-3" aria-hidden="true" /> : null}
                              </span>
                              <span className="text-sm font-medium">{t(`automationLevelOptions.${opt}`)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* STEP 2 — Result */}
              {step === 2 ? (
                <div>
                  {done ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <div className="flex size-16 items-center justify-center rounded-full bg-g-green/15 text-g-green">
                        <Check className="size-8" aria-hidden="true" />
                      </div>
                      <h3 className="mt-5 text-2xl font-semibold">{t('form.successTitle')}</h3>
                      <p className="mt-2 max-w-md text-muted-foreground">{t('form.successDesc')}</p>
                      {reference ? (
                        <p className="mt-3 rounded-full border border-g-green/30 bg-g-green/5 px-4 py-1.5 font-mono text-sm font-semibold tracking-wide text-g-green">
                          {t('form.successReference', { reference })}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => { setDone(false); setReference(null); setStep(0); setInput(INITIAL_INPUT); setForm({ name: '', email: '', whatsapp: '' }) }}
                        className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium hover:bg-foreground/5"
                      >
                        <RotateCw className="size-4" aria-hidden="true" />
                        {t('form.successRestart')}
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-8 lg:grid-cols-2">
                      <div>
                        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-6">
                          {/* WS-4: animated SVG ring gauges */}
                          <div className="mb-6 flex items-center justify-center gap-12">
                            <RingGauge
                              fraction={Math.min(1, result.max / 20000)}
                              formatValue={(n) => formatMoney(Math.round(n), locale)}
                              label={t('result.budget')}
                              color="#0071E3"
                              isRtl={locale === 'ar'}
                            />
                            <RingGauge
                              fraction={Math.min(1, result.weeksMax / 12)}
                              formatValue={(n) => `${Math.round(n)}`}
                              label={t('result.duration')}
                              color="#34A853"
                              isRtl={locale === 'ar'}
                            />
                          </div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t('result.budget')}
                          </p>
                          <p className="mt-2 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                            {formatMoney(result.min, locale)} – {formatMoney(result.max, locale)}
                          </p>
                          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t('result.duration')}
                          </p>
                          <p className="mt-1 text-xl font-semibold">
                            {t('result.weeks', { min: result.weeksMin, max: result.weeksMax })}
                          </p>
                        </div>

                        <div className="mt-4">
                          <p className="text-sm font-semibold">{t('result.breakdownTitle')}</p>
                          <ul className="mt-2 space-y-1.5 text-sm">
                            {result.breakdown.map((line) => (
                              <li key={line.labelKey} className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">{breakdownLabels[line.labelKey as keyof typeof breakdownLabels]}</span>
                                <span className="tabular-nums">
                                  {formatMoney(line.min, locale)} – {formatMoney(line.max, locale)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          {t('result.disclaimer')}
                        </p>
                      </div>

                      <form onSubmit={onSubmit} className="rounded-2xl border border-border p-6" noValidate>
                        <h3 className="text-lg font-semibold">{t('form.title')}</h3>
                        <div className="mt-4 space-y-4">
                          <div>
                            <Label htmlFor="calc-name" className="text-sm">{t('form.name')}</Label>
                            <Input
                              id="calc-name"
                              value={form.name}
                              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                              autoComplete="name"
                              aria-invalid={!!errors.name}
                              aria-describedby={errors.name ? 'calc-name-err' : undefined}
                              className="mt-1.5"
                            />
                            {errors.name ? (
                              <p id="calc-name-err" role="alert" className="mt-1 text-xs text-destructive">{errors.name}</p>
                            ) : null}
                          </div>
                          <div>
                            <Label htmlFor="calc-email" className="text-sm">{t('form.email')}</Label>
                            <Input
                              id="calc-email"
                              type="email"
                              value={form.email}
                              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                              autoComplete="email"
                              aria-invalid={!!errors.email}
                              aria-describedby={errors.email ? 'calc-email-err' : undefined}
                              className="mt-1.5"
                            />
                            {errors.email ? (
                              <p id="calc-email-err" role="alert" className="mt-1 text-xs text-destructive">{errors.email}</p>
                            ) : null}
                          </div>
                          <div>
                            <Label htmlFor="calc-wa" className="text-sm">{t('form.whatsapp')}</Label>
                            <Input
                              id="calc-wa"
                              type="tel"
                              value={form.whatsapp ?? ''}
                              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                              autoComplete="tel"
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                        <Button type="submit" data-cursor="magnet" disabled={submitting} className="mt-6 w-full gap-2">
                          {submitting ? (
                            <>
                              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                              {t('form.sending')}
                            </>
                          ) : (
                            <>
                              <Send className="size-4" aria-hidden="true" />
                              {t('form.submit')}
                            </>
                          )}
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          {!done && step < 2 ? (
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              <button
                type="button"
                data-cursor="magnet"
                onClick={goBack}
                disabled={step === 0}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                  step === 0 ? 'cursor-not-allowed opacity-40' : 'hover:bg-foreground/5'
                )}
              >
                {/* Single-flip arrows: ArrowLeft flips to point right ("back") in RTL */}
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                {t('back')}
              </button>
              <button
                type="button"
                data-cursor="magnet"
                onClick={goNext}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
              >
                {step === 1 ? t('calculate') : t('next')}
                {/* ArrowRight flips to point left ("forward") in RTL */}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {!done && step === 2 ? (
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:bg-foreground/5"
              >
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                {t('back')}
              </button>
              <span className="text-sm text-muted-foreground">
                {t('result.disclaimer')}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
