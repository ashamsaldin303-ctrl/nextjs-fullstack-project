'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { z } from 'zod'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { playSuccess } from '@/lib/sound'
import {
  leadEmailSchema,
  leadMessageSchema,
  leadNameSchema,
  leadWhatsappSchema,
} from '@/lib/lead-fields'

/** Project-type quick chips (Batch 2 item 7c) — the same taxonomy the hero
 *  console presets and the /contact prefill URL contract use:
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
  useEffect(() => {
    const prevTemplate = lastTemplateRef.current
    const nextTemplate = buildTemplate(service, prefillIdea)
    lastTemplateRef.current = nextTemplate
    if (prevTemplate === nextTemplate) return
    setValues((v) =>
      v.message === prevTemplate || v.message.trim() === ''
        ? { ...v, message: nextTemplate }
        : v,
    )
  }, [prefillService, prefillIdea, locale, service, buildTemplate])
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
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
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-elyra-locale': locale,
        },
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
        playSuccess() // sensory feedback — fires on REAL success only
        toast.success(t('successTitle'), { description: t('successDesc') })
        setValues({ name: '', email: '', whatsapp: '', message: '' })
        setService(null)
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
      // Network failure — the message stays for a retry.
      toast.error(t('errorTitle'), { description: t('errorNetwork') })
    } finally {
      setSubmitting(false)
    }
  }

  const field = (key: keyof FormValues) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value })),
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `cf-${key}-err` : undefined,
  })

  return (
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
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                service === id
                  ? 'border-primary bg-primary/10 text-primary'
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
        <Input id="cf-name" autoComplete="name" required aria-required="true" className="mt-1.5" {...field('name')} />
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
      <Button type="submit" data-cursor="magnet" disabled={submitting} className={cn('w-full gap-2 sm:w-auto')}>
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
  )
}
