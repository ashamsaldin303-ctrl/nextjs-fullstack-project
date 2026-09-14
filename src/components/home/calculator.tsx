'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { leadEmailSchema, leadNameSchema, leadWhatsappSchema } from '@/lib/lead-fields'
import { leadRequestHeaders, newIdempotencyKey } from '@/lib/lead-http'
import { playImpact, playSuccess } from '@/lib/sound'
import { tiltFromName } from '@/lib/tilt'
import { toast } from 'sonner'
import { RingGauge } from './ring-gauge'
import { BRAND_COLORS } from '@/lib/brand-colors'
import {
  computeEstimate, formatMoney, MAX_BUDGET, MAX_WEEKS,
  type CalculatorInput, type ServiceType, type IntegrationKey,
  type AutomationLevel, type LanguageOption, type ThreeDOption, type Locale,
} from '@/lib/calculator'

type Step = 0 | 1 | 2

const SERVICES: { id: ServiceType; icon: typeof Globe }[] = [
  { id: 'website', icon: Globe },
  { id: 'automation', icon: Workflow },
  { id: 'full', icon: Boxes },
]

const INTEGRATIONS: IntegrationKey[] = ['crm', 'invoicing', 'email', 'telegram', 'sheets', 'ai']

// Shared lead-field schemas (R2-MED-1 / R6-LOW-3): the SAME rules the
// API enforces — name 2–100, email ≤254, whatsapp 5–30 + phone pattern —
// so a client-side rejection can never diverge from a server-side one.
const leadSchema = z.object({
  name: leadNameSchema,
  email: leadEmailSchema,
  whatsapp: leadWhatsappSchema,
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

/* AUDIT-C4 LOW (fix 4): next-intl formats NUMBER t() params with the
   message locale — bare 'ar' renders Latin digits on current engines
   (Node 24 / ICU 78, Chromium) but is engine-dependent: Safari/JSC
   could emit Arabic-Indic numerals and diverge from the site's pinned
   Latin-numeral sites (formatMoney, live-clock, damascus-clock).
   Pre-formatting to a STRING param (next-intl inserts string params
   verbatim) with the same ar-u-nu-latn pin hardens the numeric call
   sites below; rendering is byte-identical on current engines (small
   integers, no grouping separators). */
const formatTNumber = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-US').format(value)

export function Calculator() {
  const t = useTranslations('calculator')
  // Whatsapp has no local calculator.errors key — reuse the API's own
  // translated field copy (apiErrors.fields.whatsapp) so client and
  // server rejections read identically (same rule, same message).
  const tApiFields = useTranslations('apiErrors.fields')
  // useLocale() returns a broad `string`; narrow to the routing union
  // (unknown values fall back to `ar`, the site default) so formatMoney's
  // tightened `Locale` param type-checks.
  const localeRaw = useLocale()
  const locale: Locale = localeRaw === 'en' ? 'en' : 'ar'
  const reduced = useReducedMotion()

  const [step, setStep] = useState<Step>(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [input, setInput] = useState<CalculatorInput>(INITIAL_INPUT)
  const [form, setForm] = useState<LeadForm>({ name: '', email: '', whatsapp: '' })
  const [errors, setErrors] = useState<{ name?: string; email?: string; whatsapp?: string }>({})
  // F-S5-08 (audit r2): per-field refs for focus-to-first-error + the
  // shared blur-validation helper.
  const calcFieldRefs = useRef<Record<'name' | 'email' | 'whatsapp', HTMLInputElement | null>>({
    name: null,
    email: null,
    whatsapp: null,
  })
  /** F-S5-08: blur re-validation — engaged fields (with content) or
   *  already-errored fields get instant per-field feedback; empty
   *  untouched fields blurring stay quiet. */
  const validateOnBlur = useCallback(
    (key: 'name' | 'email' | 'whatsapp') => {
      if (!form[key] && !errors[key]) return
      const parsed = leadSchema.safeParse(form)
      const issue = parsed.success
        ? undefined
        : parsed.error.issues.find((i) => i.path[0] === key)
      const msg =
        issue?.path[0] === 'name'
          ? t('errors.name')
          : issue?.path[0] === 'email'
            ? t('errors.email')
            : issue?.path[0] === 'whatsapp'
              ? tApiFields('whatsapp')
              : undefined
      setErrors((er) => {
        const had = er[key]
        if (msg) return had === msg ? er : { ...er, [key]: msg }
        if (!had) return er
        return { ...er, [key]: undefined }
      })
    },
    [form, errors, t, tApiFields],
  )
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [reference, setReference] = useState<string | null>(null)
  // FIX(2-c/18): honeypot trap — bots autofill hidden "companyWebsite"
  // fields; humans never see it. The value rides along in the JSON body
  // and the API silently discards bot submissions with a fake success.
  const honeypotRef = useRef<HTMLInputElement>(null)
  // F-S2-01 (gold-standard audit): idempotency key — one per submission
  // INTENT, lazily minted; a network-level retry of the same submit reuses
  // the key and the server dedupes to the original row (the calculator's
  // success panel ends the flow, so no post-success refresh is needed —
  // a remount mints a fresh key).
  const idemKeyRef = useRef<string | null>(null)

  const result = useMemo(() => computeEstimate(input), [input])

  /* G2-4 F9 (G3-6): dependency flags for the two service-gated option
     groups, derived once (not re-derived inline per option button) so the
     hint line + aria-describedby wiring read from one source of truth. */
  const threeDDisabled = input.service === 'automation'
  const automationDisabled = input.service === 'website'

  // L3 FIX (R5): on 201 the `done` branch swaps the form (whose focused
  // submit button just disappeared) for the success panel — focus fell to
  // <body> and nothing was announced. Move focus to the success heading
  // (tabIndex={-1} = programmatically focusable, out of tab order). The
  // effect runs after the swap commits, so the ref is attached when it
  // fires; done can only flip at step 2 (the form lives there).
  const successHeadingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (done) successHeadingRef.current?.focus()
  }, [done])

  // AUDIT-C4 MEDIUM (fix 2a): the step 1→2 landing focus — the same
  // contract as successHeadingRef above (tabIndex={-1} target,
  // programmatic focus), but armed via a REF CALLBACK instead of an
  // effect: AnimatePresence mode="wait" mounts the step-2 panel only
  // AFTER step 1's 0.4s exit completes — long after an effect keyed on
  // `step` would have fired (the ref would still be null there).
  // goNext() arms the flag; the result card's budget heading focuses
  // itself at mount and clears the flag (mirrors the success L3/R5 and
  // simulator run→status choreography).
  const focusResultHeading = useRef(false)

  // Breakdown line labels — resolved once for type-safety (guide §4.6).
  const breakdownLabels = {
    base: t('result.base'),
    pages: t('result.pages'),
    bilingual: t('result.bilingual'),
    threeD: t('result.threeD'),
    integrations: t('result.integrations'),
    advanced: t('result.advanced'),
  } as const

  // N1 (REF-3 T1) — impact wiring (plan item 5): the organic wood-knock
  // thud fires ONLY when the destination step is 2 (the estimate result —
  // the "landing"), where the N2 squash & stretch numbers below land in the
  // same instant: sound + motion arriving together is the tactile read.
  // playImpact is self-gated inside sound.ts (the context arms on the
  // first user gesture and every path fails silently), so it is
  // safe to call unconditionally. The closure `step` is fresh here — the
  // Next button only renders while step < 2 (see the controls guard below),
  // so next = step + 1 ∈ {1, 2} exactly like the old Math.min form.
  const goNext = () => {
    const next = Math.min(2, step + 1) as Step
    if (next === 2) {
      playImpact(0.85)
      // AUDIT-C4 MEDIUM (fix 2a): the focused Calculate button unmounts
      // with the `!done && step < 2` controls guard the instant step
      // flips, dropping focus to <body> (WCAG 4.1.3) — arm the landing
      // focus consumed by the heading's ref callback when the step-2
      // panel mounts.
      focusResultHeading.current = true
    }
    setDir(1)
    setStep(next)
  }
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
    // B4 fix 5a: re-entrancy guard — the submit Button is disabled while
    // `submitting`, but Enter-key submits bypass the disabled state (the
    // form element itself stays focusable), which would double-fire the
    // POST and toast twice.
    if (submitting) return
    const parsed = leadSchema.safeParse(form)
    if (!parsed.success) {
      const fe: { name?: string; email?: string; whatsapp?: string } = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]
        if (path === 'name') fe.name = t('errors.name')
        if (path === 'email') fe.email = t('errors.email')
        if (path === 'whatsapp') fe.whatsapp = tApiFields('whatsapp')
      }
      setErrors(fe)
      // F-S5-08 (audit r2): focus the FIRST invalid field on a failed
      // submit (DOM order: name → email → whatsapp) — the visitor lands
      // where the fix is, instead of hunting for the red ring.
      const firstInvalid = (['name', 'email', 'whatsapp'] as const).find((k) => fe[k])
      if (firstInvalid) calcFieldRefs.current[firstInvalid]?.focus()
      return
    }
    setErrors({})
    setSubmitting(true)
    // Phase 3: real storage — the server recomputes the estimate from the
    // wizard options and returns a reference (guide §2.9). Client numbers
    // are never sent: only the option set travels.
    // L6-R2 P3: ~20s abort — a stalled connection must not pin the
    // submitting state until the browser's own timeout (minutes). An
    // AbortError lands in the catch below and surfaces the SAME generic
    // network-failure message as a real network error (never a raw
    // exception string).
    const controller = new AbortController()
    const abortTimer = window.setTimeout(() => controller.abort(), 20_000)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          ...leadRequestHeaders(locale),
          // F-S2-01: minted lazily — retries of THIS submit reuse the key.
          'Idempotency-Key': (idemKeyRef.current ??= newIdempotencyKey()),
        },
        signal: controller.signal,
        body: JSON.stringify({
          source: 'calculator',
          companyWebsite: honeypotRef.current?.value ?? '',
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
        // N1 (REF-3 T1) — the success "landing" gets the impact thud layered
        // UNDER playSuccess (full intensity 1): chime + knock = a sealed deal.
        playImpact(1)
        return
      }

      // Server rejected: surface translated server-side messages.
      const data = (await res.json().catch(() => null)) as
        | { message?: string; fields?: Record<string, string> }
        | null
      if (res.status === 400 && data?.fields) {
        const fe: { name?: string; email?: string; whatsapp?: string } = {}
        if (data.fields.name) fe.name = data.fields.name
        if (data.fields.email) fe.email = data.fields.email
        if (data.fields.whatsapp) fe.whatsapp = data.fields.whatsapp
        setErrors(fe)
      }
      toast.error(t('form.errorTitle'), {
        description: data?.message ?? t('form.errorNetwork'),
      })
    } catch {
      // Network failure or the 20s abort — data stays in the form for a
      // retry (indistinguishable to the visitor by design).
      toast.error(t('form.errorTitle'), { description: t('form.errorNetwork') })
    } finally {
      window.clearTimeout(abortTimer)
      setSubmitting(false)
    }
  }

  // L6-F1: locale-aware slide direction. `x` is PHYSICAL — with the raw
  // d * 30 sign, advancing (d = 1) always enters from the physical right
  // and exits left, which reads backwards in RTL. Flipping the sign for
  // Arabic mirrors the gesture so the advance flows toward the
  // reading-direction start (rightward, like turning an RTL page): the
  // incoming step enters from the physical left, the outgoing one exits
  // toward the right. Reduced-motion gating is unchanged (variants stay
  // undefined → no slide at all).
  const slideSign = locale === 'ar' ? -1 : 1
  const slideVariants = reduced
    ? undefined
    : {
        enter: (d: number) => ({ opacity: 0, x: d * 30 * slideSign }),
        center: { opacity: 1, x: 0 },
        exit: (d: number) => ({ opacity: 0, x: -d * 30 * slideSign }),
      }

  // L1-C P3 (fix 2-d): aria-label REMOVED — it overrode aria-labelledby
  // and named the landmark by the short kicker instead of the full h2.
  return (
    // G3-5 (G2-3 P2-1 fix 1): id="calculator" moved to the CalculatorLazy
    // WRAPPER (stable across the lazy swap) — keeping it here would put two
    // elements with the same id in the DOM once the lazy section mounts.
    <section className="bg-background py-20 sm:py-28" aria-labelledby="calc-title">
      <div className="elyra-container max-w-5xl">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          titleId="calc-title"
        />

        {/* Progress */}
        <div className="mt-10 flex items-center justify-between gap-4">
          {/* AUDIT-C4 MEDIUM (fix 2b): polite live region — the counter
              sits OUTSIDE the AnimatePresence swap, so it updates (and
              is announced) the instant a step button fires, covering the
              transition while the panel swap itself stays silent. */}
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t('step', { current: formatTNumber(step + 1, locale), total: formatTNumber(3, locale) })}
          </p>
          <div className="flex flex-1 gap-2">
            {[0, 1, 2].map((s) => (
              <div
                key={s}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <motion.div
                  className="h-full w-full origin-left rounded-full bg-primary rtl:origin-right"
                  initial={false}
                  animate={{ scaleX: step >= s ? 1 : 0 }}
                  // G2-4 F4: scaleX + transform-origin instead of animating
                  // `width` — the codebase's compositor-only convention
                  // (L6-F1 hb-scan, G3F-A packet/flow-dot/pulse). The fill
                  // grows from the reading-start edge: origin-left in LTR,
                  // origin-right in RTL (rtl: variant). initial={false}
                  // keeps the no-mount-animation contract.
                  // L4 R3 P3: framer-motion animates on its own JS clock —
                  // the global CSS reduced-motion kill-switch can't reach
                  // it. Gate the tween duration like the file's own
                  // slideVariants discipline.
                  transition={reduced ? { duration: 0 } : { duration: 0.4 }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-8 overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-10">
          {/* UI-5 (visual-only): gradient hairline accent along the wizard
              card's top edge — decorative, no logic/state/pricing impact. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          />
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
                          // N1 (REF-3 T1) — service capture: the softer
                          // wood-knock (0.5 = the "pick up" moment; the
                          // louder 0.85 landing is reserved for the estimate
                          // step, keeping the two tiers distinguishable).
                          onClick={() => {
                            playImpact(0.5)
                            setInput((p) => ({ ...p, service: id }))
                          }}
                          aria-pressed={active}
                          className={cn(
                            'group relative overflow-hidden rounded-2xl border p-5 text-start transition-[border-color,background-color,box-shadow] duration-300',
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
                      {/* AUDIT-C4 LOW (fix 4): intentionally left raw —
                          pagesValue is an ICU plural whose `#` arms are
                          formatted by next-intl with the message locale
                          (plural matching needs the raw number). Values
                          1–20 render Latin digits on current engines
                          ('ar' → latn, ICU 78+); formally the # glyphs
                          follow the message locale on other engines —
                          documented limitation. */}
                      <span className="text-sm font-medium text-primary tabular-nums">
                        {t('pagesValue', { count: input.pages })}
                      </span>
                    </div>
                    <div className="mt-4 px-1">
                      {/* AUDIT-C4 MEDIUM (fix 1): Radix resolves direction
                          via useDirection (localDir || globalDir || 'ltr')
                          and NO DirectionProvider exists app-wide, so the
                          slider kept min at the PHYSICAL left inside the
                          RTL page while the `flex justify-between` scale
                          labels mirror with the RTL flow ("1" at
                          inline-start = right) — the labels sat over the
                          wrong ends. The Slider's local dir prop
                          (SliderHorizontalProps, verified in
                          @radix-ui/react-slider source) mirrors the
                          slider itself: min at inline-start, max at
                          inline-end — the labels row below now aligns
                          automatically in both locales, and the arrow-key
                          mapping flips with the visual direction. */}
                      <Slider
                        value={[input.pages]}
                        onValueChange={(v) => setInput((p) => ({ ...p, pages: v[0] ?? p.pages }))}
                        min={1}
                        max={20}
                        step={1}
                        aria-label={t('pages')}
                        dir={locale === 'ar' ? 'rtl' : 'ltr'}
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
                    {/* G2-4 F9 (G3-6): the dependent group greys out with no
                        WHY — the single new catalog key explains it, wired as
                        BOTH a visible muted line (sighted visitors) and
                        aria-describedby on the disabled buttons (SR). Rendered
                        ONLY while the group is disabled, so the active state
                        carries zero extra noise. */}
                    {threeDDisabled ? (
                      <p id="calc-depends-threed" className="mt-1.5 text-xs text-muted-foreground">
                        {t('dependsHint')}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(['yes', 'no'] as ThreeDOption[]).map((opt) => {
                        const active = input.threeD === opt
                        const disabled = threeDDisabled
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={disabled}
                            onClick={() => setInput((p) => ({ ...p, threeD: opt }))}
                            aria-pressed={active}
                            aria-describedby={disabled ? 'calc-depends-threed' : undefined}
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
                            // N3 (REF-3 T1) — hash-seeded angular dispersion
                            // (Olssons §2.2): each integration chip settles at
                            // its own stable tilt from tiltFromName(key) — the
                            // same angle every render and every locale
                            // ("hand-placed, not machine-perfect"). Uses the
                            // independent CSS `rotate` property, which
                            // composes without touching `transform`; ±3.5°
                            // keeps the min-h-11 hit targets safe.
                            style={{ rotate: `${tiltFromName(key)}deg` }}
                            className={cn(
                              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                              active ? 'border-primary bg-primary/10 text-primary-strong' : 'border-border hover:bg-foreground/[0.02]'
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
                    {/* G2-4 F9 (G3-6): same single-key WHY hint, mirrored
                        wiring — visible line + aria-describedby, only while
                        the group is greyed out. */}
                    {automationDisabled ? (
                      <p id="calc-depends-automation" className="mt-1.5 text-xs text-muted-foreground">
                        {t('dependsHint')}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(['essential', 'advanced'] as AutomationLevel[]).map((opt) => {
                        const active = input.automationLevel === opt
                        const disabled = automationDisabled
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={disabled}
                            onClick={() => setInput((p) => ({ ...p, automationLevel: opt }))}
                            aria-pressed={active}
                            aria-describedby={disabled ? 'calc-depends-automation' : undefined}
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
                      <div className="flex size-16 items-center justify-center rounded-full bg-g-green-strong/15 text-g-green-strong">
                        <Check className="size-8" aria-hidden="true" />
                      </div>
                      <h3
                        ref={successHeadingRef}
                        tabIndex={-1}
                        className="mt-5 text-2xl font-semibold"
                      >
                        {t('form.successTitle')}
                      </h3>
                      <p className="mt-2 max-w-md text-muted-foreground">{t('form.successDesc')}</p>
                      {reference ? (
                        <p className="mt-3 rounded-full border border-g-green-strong/30 bg-g-green-strong/5 px-4 py-1.5 text-sm font-semibold text-g-green-strong">
                          {/* L6-R4 P3: the label renders in the default Cairo
                              face — the old blanket font-mono put the Arabic
                              «رقمك المرجعي:» inside the latin-only JetBrains
                              Mono stack (fallback glyphs). Only the Latin
                              reference token keeps font-mono, isolated as an
                              LTR island so it stays coherent in RTL. */}
                          {t('form.successReference')}{' '}
                          <span dir="ltr" className="font-mono tracking-wide">{reference}</span>
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => { setDone(false); setReference(null); setStep(0); setInput(INITIAL_INPUT); setForm({ name: '', email: '', whatsapp: '' }) }}
                        className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                              fraction={Math.min(1, result.max / MAX_BUDGET)}
                              value={result.max}
                              formatValue={(n) => formatMoney(Math.round(n), locale)}
                              label={t('result.budget')}
                              color={BRAND_COLORS.primary}
                              isRtl={locale === 'ar'}
                            />
                            <RingGauge
                              fraction={Math.min(1, result.weeksMax / MAX_WEEKS)}
                              value={result.weeksMax}
                              formatValue={(n) => `${Math.round(n)}`}
                              label={t('result.duration')}
                              color={BRAND_COLORS.gGreen}
                              isRtl={locale === 'ar'}
                            />
                          </div>
                          {/* AUDIT-C4 MEDIUM (fix 2a): p→h3 — the result
                              card had no heading of its own (steps 0/1
                              each open with one), so the budget label
                              becomes the result card's h3 AND the step-2
                              focus landing (tabIndex={-1} + ref callback,
                              mirroring the success heading above).
                              Visual output is identical: Tailwind
                              preflight un-styles headings, so every
                              typographic property still comes from the
                              classes below. */}
                          <h3
                            ref={(el) => {
                              if (el && focusResultHeading.current) {
                                focusResultHeading.current = false
                                el.focus()
                              }
                            }}
                            tabIndex={-1}
                            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                          >
                            {t('result.budget')}
                          </h3>
                          {/* N2 (REF-3 T1) — squash & stretch landing
                              (Olssons §2.3), 380ms: this branch mounts via
                              AnimatePresence key={step}, so the reveal is a
                              ONE-SHOT tween per mount (freeze-contract safe —
                              nothing loops, nothing listens). Keyframes
                              scaleY 1.08→0.96→1 / scaleX 0.92→1.03→1 read as
                              the figure physically "landing" on the card,
                              with a fast 0.18s opacity so the number is
                              readable almost immediately. origin-center keeps
                              the squash centered. Reduced motion → static
                              final state: initial={false} + animate to the
                              settled values with a 0s transition — numbers
                              appear instantly, zero motion. */}
                          <motion.p
                            className="mt-2 origin-center text-3xl font-bold tracking-tight text-primary sm:text-4xl"
                            initial={reduced ? false : { opacity: 0, scaleY: 1.08, scaleX: 0.92 }}
                            animate={reduced ? { opacity: 1 } : { opacity: 1, scaleY: [1.08, 0.96, 1], scaleX: [0.92, 1.03, 1] }}
                            transition={reduced ? { duration: 0 } : { duration: 0.38, ease: 'easeOut', opacity: { duration: 0.18 } }}
                          >
                            {formatMoney(result.min, locale)} – {formatMoney(result.max, locale)}
                          </motion.p>
                          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t('result.duration')}
                          </p>
                          {/* N2 (REF-3 T1) — same squash & stretch landing on
                              the duration figure (identical one-shot 380ms
                              tween, identical reduced-motion static path). */}
                          <motion.p
                            className="mt-1 origin-center text-xl font-semibold"
                            initial={reduced ? false : { opacity: 0, scaleY: 1.08, scaleX: 0.92 }}
                            animate={reduced ? { opacity: 1 } : { opacity: 1, scaleY: [1.08, 0.96, 1], scaleX: [0.92, 1.03, 1] }}
                            transition={reduced ? { duration: 0 } : { duration: 0.38, ease: 'easeOut', opacity: { duration: 0.18 } }}
                          >
                            {t('result.weeks', { min: formatTNumber(result.weeksMin, locale), max: formatTNumber(result.weeksMax, locale) })}
                          </motion.p>
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
                        {/* Honeypot — bots fill it, humans never see it (API silently discards).
                            L1-C P3 (fix 2-d): logical inset + fixed positioning — the old
                            physical `-left-[9999px]` absolute offset inflated the RTL body
                            scrollWidth (documented UI-5 note); fixed removes it from the
                            scroll container entirely. */}
                        <input
                          ref={honeypotRef}
                          type="text"
                          name="companyWebsite"
                          tabIndex={-1}
                          autoComplete="off"
                          aria-hidden="true"
                          className="pointer-events-none fixed -start-[9999px] h-px w-px overflow-hidden"
                        />
                        <div className="mt-4 space-y-4">
                          <div>
                            <Label htmlFor="calc-name" className="text-sm">{t('form.name')}</Label>
                            <Input
                              id="calc-name"
                              ref={(el) => { calcFieldRefs.current.name = el }}
                              value={form.name}
                              onChange={(e) => {
                                setForm((f) => ({ ...f, name: e.target.value }))
                                // B4 fix 5b: clear THIS field's rejection the
                                // moment the user edits it — a stale error
                                // (aria-invalid + role=alert) must not persist
                                // while typing.
                                if (errors.name) setErrors((er) => ({ ...er, name: undefined }))
                              }}
                              onBlur={() => validateOnBlur('name')}
                              autoComplete="name"
                              required
                              aria-required="true"
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
                              ref={(el) => { calcFieldRefs.current.email = el }}
                              type="email"
                              value={form.email}
                              onChange={(e) => {
                                setForm((f) => ({ ...f, email: e.target.value }))
                                if (errors.email) setErrors((er) => ({ ...er, email: undefined }))
                              }}
                              onBlur={() => validateOnBlur('email')}
                              autoComplete="email"
                              required
                              aria-required="true"
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
                              ref={(el) => { calcFieldRefs.current.whatsapp = el }}
                              type="tel"
                              value={form.whatsapp ?? ''}
                              onChange={(e) => {
                                setForm((f) => ({ ...f, whatsapp: e.target.value }))
                                if (errors.whatsapp) setErrors((er) => ({ ...er, whatsapp: undefined }))
                              }}
                              onBlur={() => validateOnBlur('whatsapp')}
                              autoComplete="tel"
                              aria-invalid={!!errors.whatsapp}
                              aria-describedby={errors.whatsapp ? 'calc-wa-err' : undefined}
                              className="mt-1.5"
                            />
                            {errors.whatsapp ? (
                              <p id="calc-wa-err" role="alert" className="mt-1 text-xs text-destructive">{errors.whatsapp}</p>
                            ) : null}
                          </div>
                        </div>
                        {/* N2 (REF-3 T1) — press confirmation on the submit
                            button: active:scale-[0.97] (rides the base
                            Button's transition-all; disabled buttons never
                            receive :active). */}
                        <Button type="submit" data-cursor="magnet" disabled={submitting} className="mt-6 h-11 w-full gap-2 active:scale-[0.97]">
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
                  'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
                /* N2 (REF-3 T1) — press confirmation: active:scale-[0.97]
                   layered after hover:scale-105 — Tailwind orders active
                   after hover, so the press wins while held. B4 fix 6:
                   focus-visible ring matches every sibling control. */
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:bg-foreground/5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                {t('back')}
              </button>
              {/* F-S5-07 (audit r2): the 271-char disclaimer used to render
                  TWICE at step 2 — here AND next to the annotated breakdown
                  copy. The annotated instance (with the icon + full rule)
                  is the canonical one; the controls row now shows a short
                  neutral step marker instead. */}
              <span className="text-sm text-muted-foreground" aria-hidden="true">
                •
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
