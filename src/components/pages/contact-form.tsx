'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { z } from 'zod'
import { toast } from 'sonner'
import { Check, Package, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { playImpact, playSuccess } from '@/lib/sound'
import { tiltFromName } from '@/lib/tilt'
import {
  leadEmailSchema,
  leadMessageSchema,
  leadNameSchema,
  leadWhatsappSchema,
} from '@/lib/lead-fields'

/** Project-type quick chips (Batch 2 item 7c) — the service taxonomy shared
 *  with the /contact prefill URL contract, whose live producers are the
 *  automation simulator's completion CTA (/contact?service=automation) and
 *  the bento AI mini-app's convert action (/contact?service=agent&idea=…):
 *  service ∈ store|booking|agent|dashboard|automation|websites. */
export type ContactServiceId =
  | 'store'
  | 'booking'
  | 'agent'
  | 'dashboard'
  | 'websites'
  | 'automation'

const SERVICE_IDS: ContactServiceId[] = [
  'store',
  'booking',
  'agent',
  'dashboard',
  'websites',
  'automation',
]

const SERVICE_LABEL_KEYS: Record<ContactServiceId, string> = {
  store: 'projectTypes.store',
  booking: 'projectTypes.booking',
  agent: 'projectTypes.agent',
  dashboard: 'projectTypes.dashboard',
  websites: 'projectTypes.websites',
  automation: 'projectTypes.automation',
}

// Shared lead-field schemas (R2-MED-1): the SAME rules the API enforces
// (name 2–100, email via zod v4 z.email() ≤254, whatsapp 5–30 + phone
// pattern optional, message 10–5000) — one source of truth, no
// client/server rule drift.
const schema = z.object({
  name: leadNameSchema,
  email: leadEmailSchema,
  whatsapp: leadWhatsappSchema,
  message: leadMessageSchema,
})

type FormValues = {
  name: string
  email: string
  whatsapp: string
  message: string
}

type FormErrors = {
  name?: string
  email?: string
  whatsapp?: string
  message?: string
}

export function ContactForm({
  prefillService,
  prefillIdea,
}: {
  /** `service` search param — already validated by the page (7a). */
  prefillService?: ContactServiceId
  /** `idea` search param — already sanitized + clamped by the page (7a). */
  prefillIdea?: string
}) {
  const t = useTranslations('pages.contact.form')
  // Whatsapp has no local errors key — reuse the API's own translated
  // field copy (apiErrors.fields.whatsapp) so client and server
  // rejections read identically (same rule, same message) — the same
  // convention the calculator form already uses.
  const tApiFields = useTranslations('apiErrors.fields')
  const locale = useLocale()

  /** Localized message template seeded from the arriving intent (7a):
   *  chip-only → service sentence; free text → idea sentence; both →
   *  combined. The template is a STARTING POINT the visitor edits.
   *  useCallback on [t] so the re-seed effect below can depend on it —
   *  `t` (hence this callback) changes identity exactly when the active
   *  locale does, which is what re-seeds the message on a soft locale
   *  switch. */
  const buildTemplate = useCallback(
    (service: ContactServiceId | null, idea: string | undefined): string => {
      const serviceLabel = service ? t(SERVICE_LABEL_KEYS[service]) : undefined
      if (serviceLabel && idea) {
        return t('prefill.serviceIdea', { service: serviceLabel, idea })
      }
      if (idea) return t('prefill.ideaOnly', { idea })
      if (serviceLabel) return t('prefill.serviceOnly', { service: serviceLabel })
      return ''
    },
    [t],
  )

  const initialService = prefillService ?? null
  const [service, setService] = useState<ContactServiceId | null>(initialService)
  const [values, setValues] = useState<FormValues>(() => ({
    name: '',
    email: '',
    whatsapp: '',
    message: buildTemplate(initialService, prefillIdea),
  }))
  // L1-C P3 (fix 2-d): the template above is computed ONCE by the useState
  // initializer. A soft re-navigation — a client-side locale switch on
  // /contact?service=… keeps this component mounted — would leave the
  // textarea holding the OLD language's template. The effect below
  // re-seeds it, guarded by the LAST template this component generated
  // (seed or chip re-seed): while the message still equals that template
  // (or is empty — the same edit-protection as onToggleService) it is
  // machine text and may be replaced; the visitor's own edits are never
  // clobbered. Triggers: the arriving intent (prefillService/prefillIdea),
  // the locale (via buildTemplate's `t`), and chip toggles (service —
  // already re-seeded synchronously by onToggleService, which keeps
  // lastTemplateRef in sync, so those runs are no-ops via the guard).
  const lastTemplateRef = useRef(buildTemplate(initialService, prefillIdea))
  /** V-2 L3-2b P3: once a submission SUCCEEDS, an empty message is the
   *  post-reset state, not an invitation to re-seed — without this flag a
   *  locale switch after success (with ?idea= present) repopulates the
   *  just-cleared textarea with the ideaOnly template in the new locale
   *  (buildTemplate identity changes → prev≠next → the `trim()===''` arm
   *  fires). Resets naturally on reload (fresh mount). The chip-toggle
   *  path still re-seeds intentionally — it has its own synchronous guard. */
  const submittedRef = useRef(false)
  useEffect(() => {
    const prevTemplate = lastTemplateRef.current
    const nextTemplate = buildTemplate(service, prefillIdea)
    lastTemplateRef.current = nextTemplate
    if (prevTemplate === nextTemplate) return
    setValues((v) =>
      v.message === prevTemplate || (v.message.trim() === '' && !submittedRef.current)
        ? { ...v, message: nextTemplate }
        : v,
    )
  }, [prefillService, prefillIdea, locale, service, buildTemplate])
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  // N7 (REF-3 T2) — the success-box ritual state: null = closed box; a
  // string (possibly '' when a 201 body was malformed — the API contract
  // guarantees { reference }, that arm is pure defense since the success
  // toast was removed and silence would read as failure) = open, carrying
  // the reference token revealed inside the box.
  const [successRef, setSuccessRef] = useState<string | null>(null)
  // N7: "send another" returns focus to the first field — the visitor's
  // hands are already on the keyboard after the ritual.
  const nameInputRef = useRef<HTMLInputElement>(null)
  // FIX(2-c/18): honeypot trap — bots autofill hidden "companyWebsite"
  // fields; humans never see it. The value rides along in the JSON body
  // and the API silently discards bot submissions with a fake success.
  const honeypotRef = useRef<HTMLInputElement>(null)

  /** Chip toggle (7c): single-select — clicking the active chip clears the
   *  selection. The message template is re-seeded ONLY while the textarea
   *  still holds the previously generated template (or is empty) so the
   *  visitor's own edits are never clobbered. */
  const onToggleService = (id: ContactServiceId) => {
    const next = service === id ? null : id
    setService(next)
    const prevTemplate = buildTemplate(service, prefillIdea)
    const nextTemplate = buildTemplate(next, prefillIdea)
    const reseed = values.message === prevTemplate || values.message.trim() === ''
    // Keep the re-seed guard's source of truth in sync (fix 2-d): the
    // effect above compares against the LAST generated template.
    if (reseed) lastTemplateRef.current = nextTemplate
    setValues((v) => (reseed ? { ...v, message: nextTemplate } : v))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const fe: FormErrors = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]
        if (path === 'name') fe.name = t('errors.name')
        if (path === 'email') fe.email = t('errors.email')
        if (path === 'whatsapp') fe.whatsapp = tApiFields('whatsapp')
        if (path === 'message') fe.message = t('errors.message')
      }
      setErrors(fe)
      return
    }
    setErrors({})
    setSubmitting(true)
    // Phase 3: real storage — same endpoint as the calculator with
    // source "contact-form" (prompt §3.2); no duplicated logic.
    // NOTE: the project-type chip selection intentionally does NOT ride
    // the JSON body — the strict contact-form schema accepts no `service`
    // key, so the type is carried by the seeded message template instead.
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
          'Content-Type': 'application/json',
          'x-elyra-locale': locale,
        },
        signal: controller.signal,
        body: JSON.stringify({
          source: 'contact-form',
          companyWebsite: honeypotRef.current?.value ?? '',
          name: parsed.data.name,
          email: parsed.data.email,
          whatsapp: parsed.data.whatsapp || undefined,
          message: parsed.data.message,
        }),
      })

      if (res.status === 201) {
        // N7 (REF-3 T2): the API returns { reference } — read it like the
        // calculator does (null-safe parse).
        const data = (await res.json().catch(() => null)) as
          | { reference?: string }
          | null
        playSuccess() // sensory feedback — fires on REAL success only
        // N7: the box lands — the organic thud doubles the arrival.
        playImpact(1)
        setSuccessRef(data?.reference ?? '')
        setValues({ name: '', email: '', whatsapp: '', message: '' })
        setService(null)
        // Sync the re-seed guard to the post-reset state (R5 P2): the
        // effect below will next compute buildTemplate(null, prefillIdea)
        // for service=null — without this sync it would see prev≠next and
        // re-populate the just-cleared message textarea with the ideaOnly
        // machine template on the primary conversion funnel.
        lastTemplateRef.current = buildTemplate(null, prefillIdea)
        // V-2 L3-2b P3: post-success, an empty message is user-owned —
        // blocks the locale-switch re-seed path (see submittedRef above).
        submittedRef.current = true
        return
      }

      // Server rejected — surface translated server-side messages.
      const data = (await res.json().catch(() => null)) as
        | { message?: string; fields?: Record<string, string> }
        | null
      if (res.status === 400 && data?.fields) {
        const fe: FormErrors = {}
        if (data.fields.name) fe.name = data.fields.name
        if (data.fields.email) fe.email = data.fields.email
        if (data.fields.whatsapp) fe.whatsapp = data.fields.whatsapp
        if (data.fields.message) fe.message = data.fields.message
        setErrors(fe)
      }
      toast.error(t('errorTitle'), {
        description: data?.message ?? t('errorNetwork'),
      })
    } catch {
      // Network failure or the 20s abort — the message stays for a retry
      // (indistinguishable to the visitor by design).
      toast.error(t('errorTitle'), { description: t('errorNetwork') })
    } finally {
      window.clearTimeout(abortTimer)
      setSubmitting(false)
    }
  }

  const field = (key: keyof FormValues) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }))
      // AUDIT-A5 LOW (fix 6): editing a field clears THAT field's error
      // (the calculator's discipline, added in parallel) — the red ring +
      // message no longer persist until the next submit attempt.
      setErrors((prev) => {
        if (!prev[key]) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `cf-${key}-err` : undefined,
  })

  return (
    <>
      {/* N7 (REF-3 T2) — the lid-opening ritual replaces the success toast
          (error toasts stay): role="status" announces the panel, the chest
          lid hinges open revealing the recessed reference. */}
      <AnimatePresence>
        {successRef !== null && (
          <SuccessBox
            reference={successRef}
            onSendAnother={() => {
              setSuccessRef(null)
              nameInputRef.current?.focus()
            }}
          />
        )}
      </AnimatePresence>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

      {/* Project-type quick chips (Batch 2 item 7c) — single-select toggles
          reusing the hero taxonomy. The choice seeds the message template
          below; the API itself takes no service key on this source. */}
      <fieldset>
        <legend className="text-sm font-medium">{t('projectTypeLabel')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SERVICE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onToggleService(id)}
              aria-pressed={service === id}
              data-cursor="magnet"
              /* N3 (REF-3 T1/T2): hash-seeded angular dispersion — every
                 service chip settles at its own stable tiltFromName(id)
                 (±3.5°), the "hand-placed, not machine-perfect" look. The
                 independent CSS `rotate` property stays compositor-only. */
              style={{ rotate: `${tiltFromName(id)}deg` }}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                service === id
                  ? 'border-primary bg-primary/10 text-primary-strong'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              {t(SERVICE_LABEL_KEYS[id])}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="cf-name" className="text-sm">{t('name')}</Label>
        {/* LOW-9: required communicated to AT (3.3.2) — attributes only;
            validation stays in the zod schema (form is noValidate). */}
        <Input
          id="cf-name"
          ref={nameInputRef}
          autoComplete="name"
          required
          aria-required="true"
          className="mt-1.5"
          {...field('name')}
        />
        {errors.name ? <p id="cf-name-err" role="alert" className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
      </div>
      <div>
        <Label htmlFor="cf-email" className="text-sm">{t('email')}</Label>
        <Input id="cf-email" type="email" autoComplete="email" required aria-required="true" className="mt-1.5" {...field('email')} />
        {errors.email ? <p id="cf-email-err" role="alert" className="mt-1 text-xs text-destructive">{errors.email}</p> : null}
      </div>

      {/* Optional whatsapp (Batch 2 item 7b) — same shared schema rule the
          API enforces; dir="ltr" keeps the phone number visually coherent
          inside the RTL Arabic layout. */}
      <div>
        <Label htmlFor="cf-whatsapp" className="text-sm">{t('whatsapp')}</Label>
        <Input
          id="cf-whatsapp"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder={t('whatsappPlaceholder')}
          className="mt-1.5"
          {...field('whatsapp')}
          aria-describedby={errors.whatsapp ? 'cf-whatsapp-err' : 'cf-whatsapp-hint'}
        />
        {errors.whatsapp ? (
          <p id="cf-whatsapp-err" role="alert" className="mt-1 text-xs text-destructive">{errors.whatsapp}</p>
        ) : (
          <p id="cf-whatsapp-hint" className="mt-1 text-xs text-muted-foreground">{t('whatsappHint')}</p>
        )}
      </div>

      <div>
        <Label htmlFor="cf-message" className="text-sm">{t('message')}</Label>
        <Textarea
          id="cf-message"
          rows={5}
          placeholder={t('messagePlaceholder')}
          required
          aria-required="true"
          className="mt-1.5"
          {...field('message')}
        />
        {errors.message ? <p id="cf-message-err" role="alert" className="mt-1 text-xs text-destructive">{errors.message}</p> : null}
      </div>
      {/* N2 (REF-3 T1/T2): submit press scale — the active-state squash
          (0.97) of the Olssons §2.3 family; independent `scale` property,
          compositor-only. */}
      <Button
        type="submit"
        data-cursor="magnet"
        disabled={submitting}
        className={cn('active:scale-[0.97] h-11 w-full gap-2 sm:w-auto')}
      >
        {submitting ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            {t('sending')}
          </>
        ) : (
          <>
            <Send className="size-4" aria-hidden="true" />
            {t('send')}
          </>
        )}
      </Button>
      </form>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* N7 (REF-3 T2) — the contact success box                             */
/* ------------------------------------------------------------------ */

/**
 * The success ritual (Aardvark §5.2 box-lid hinge): a bordered panel
 * (mirroring the calculator's success treatment — green Check chip,
 * focusable h3, LTR-island mono reference) plus a small chest whose LID
 * hinges open around its TOP edge, revealing the recessed reference.
 *
 * Hinge math + sign convention: the report's −120°·(1−cos(πt/2)) assumes
 * a Y-up sign convention where NEGATIVE tips the top edge away from the
 * viewer. CSS rotateX is the mirrored sign (Y-down right-hand rule) —
 * the same physical swing is POSITIVE rotateX here, so we animate
 * 0 → +120 with the identical cosine ease-out:
 *   rotateX(t) = 120° · (1 − cos(πt/2)).
 * The hinge EDGE (see the VLM-round-2 note on the lid element below) is
 * the lid's top edge, so the resting state stays a visible opened plane.
 *
 * Reduced motion: the lid renders at its FINAL state (rotateX 120, no
 * transition, no impact timer) — the "already-open box lid" house
 * contract. Freeze-safe: one-shot tweens only (mount animation + hinge);
 * the single impact timer is cleaned on unmount.
 */
function SuccessBox({
  reference,
  onSendAnother,
}: {
  /** The API reference token ('' = success without a token — defensive). */
  reference: string
  onSendAnother: () => void
}) {
  const t = useTranslations('pages.contact.form')
  const reduced = useReducedMotion()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Calculator pattern: the focused submit button just went disabled —
  // move focus to the success heading so screen readers announce the
  // panel (tabIndex={-1}: programmatically focusable, out of tab order).
  // The effect runs after the mount commits, so the ref is attached.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // The thud lands mid-swing (0.15s settle delay + ~0.35s into the 0.85s
  // hinge ≈ 0.5s) — one-shot timer, cleaned on unmount; playImpact
  // self-gates on mute. No timer under reduced motion (lid is open).
  useEffect(() => {
    if (reduced) return
    const id = window.setTimeout(() => playImpact(0.9), 500)
    return () => window.clearTimeout(id)
  }, [reduced])

  return (
    <motion.div
      role="status"
      initial={reduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={reduced ? { duration: 0 } : { duration: 0.3 }}
    >
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-g-green/15 text-g-green">
          <Check className="size-8" aria-hidden="true" />
        </div>
        <h3 ref={headingRef} tabIndex={-1} className="mt-5 text-2xl font-semibold">
          {t('successTitle')}
        </h3>
        <p className="mt-2 text-muted-foreground">{t('successDesc')}</p>

        {/* THE BOX — the lid-opening ritual. Perspective on the parent so
            the hinge reads as a 3D chest, not a flat skew. */}
        <div className="relative mx-auto mt-5 h-24 w-56" style={{ perspective: '600px' }}>
          {/* The reference recess — revealed underneath the lid. Gold
              strengths raised (VLM round 2): /40 borders on white read as
              "a flat white rectangle"; /60+/10 keeps the recess legibly
              golden at rest. */}
          <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-elyra-gold/60 bg-elyra-gold/10">
            {/* L6-R4 P3 (calculator precedent): only the Latin reference
                token is a font-mono LTR island; the label keeps the
                default face so the Arabic «رقمك المرجعي:» never falls into
                the latin-only mono stack. */}
            <p className="px-3 text-sm font-semibold text-foreground">
              {t('referenceLabel')}{' '}
              {reference ? (
                <span dir="ltr" className="font-mono tracking-wide">{reference}</span>
              ) : null}
            </p>
          </div>
          {/* The lid — the chest's closed front, hinged at its TOP edge
              (origin-top). VLM round 2 correction: with a bottom hinge the
              120° resting state swings the lid DOWN-BEHIND the recess
              where it is completely hidden — the "opened chest" vanished
              after the animation. Hinging at the top edge instead swings
              the lid's bottom edge UP and back, so at rest it stays
              visible as a foreshortened golden plane RISING ABOVE the box
              — the readable opened-lid silhouette. Same 0→120°, same
              (1−cos(πt/2)) hinge curve, 0.15s after the panel settles. */}
          <motion.div
            className="absolute inset-0 origin-top rounded-xl border border-elyra-gold/70 bg-gradient-to-b from-card to-background shadow-lg"
            initial={reduced ? false : { rotateX: 0 }}
            animate={{ rotateX: 120 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.85, delay: 0.15, ease: (t: number) => 1 - Math.cos((Math.PI * t) / 2) }
            }
            style={{ backfaceVisibility: 'visible' }}
          >
            {/* Handle glyph — a gold hairline flanking the package knot. */}
            <span
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center gap-3"
            >
              <span className="block h-px w-10 bg-elyra-gold/60" />
              <Package className="size-4 text-elyra-gold" aria-hidden="true" />
              <span className="block h-px w-10 bg-elyra-gold/60" />
            </span>
          </motion.div>
        </div>

        <button
          type="button"
          onClick={onSendAnother}
          /* Gold-tinted outline (VLM round 2: the plain border-border pill
             read as "solid gray" and untied the ritual's palette). */
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-elyra-gold/40 px-5 text-sm font-medium text-foreground transition-colors hover:border-elyra-gold/60 hover:bg-elyra-gold/5"
        >
          {t('sendAnother')}
        </button>
      </div>
    </motion.div>
  )
}
