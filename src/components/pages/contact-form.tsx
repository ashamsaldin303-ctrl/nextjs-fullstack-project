'use client'

import { useRef, useState } from 'react'
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

const schema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  message: z.string().trim().min(10),
})

type FormValues = z.infer<typeof schema>

export function ContactForm() {
  const t = useTranslations('pages.contact.form')
  const locale = useLocale()
  const [values, setValues] = useState<FormValues>({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  // FIX(2-c/18): honeypot trap — bots autofill hidden "companyWebsite"
  // fields; humans never see it. The value rides along in the JSON body
  // and the API silently discards bot submissions with a fake success.
  const honeypotRef = useRef<HTMLInputElement>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const fe: typeof errors = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]
        if (path === 'name') fe.name = t('errors.name')
        if (path === 'email') fe.email = t('errors.email')
        if (path === 'message') fe.message = t('errors.message')
      }
      setErrors(fe)
      return
    }
    setErrors({})
    setSubmitting(true)
    // Phase 3: real storage — same endpoint as the calculator with
    // source "contact-form" (prompt §3.2); no duplicated logic.
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
          message: parsed.data.message,
        }),
      })

      if (res.status === 201) {
        playSuccess() // sensory feedback — fires on REAL success only
        toast.success(t('successTitle'), { description: t('successDesc') })
        setValues({ name: '', email: '', message: '' })
        return
      }

      // Server rejected — surface translated server-side messages.
      const data = (await res.json().catch(() => null)) as
        | { message?: string; fields?: Record<string, string> }
        | null
      if (res.status === 400 && data?.fields) {
        const fe: typeof errors = {}
        if (data.fields.name) fe.name = data.fields.name
        if (data.fields.email) fe.email = data.fields.email
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
      {/* Honeypot — bots fill it, humans never see it (API silently discards) */}
      <input
        ref={honeypotRef}
        type="text"
        name="companyWebsite"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
      />
      <div>
        <Label htmlFor="cf-name" className="text-sm">{t('name')}</Label>
        <Input id="cf-name" autoComplete="name" className="mt-1.5" {...field('name')} />
        {errors.name ? <p id="cf-name-err" role="alert" className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
      </div>
      <div>
        <Label htmlFor="cf-email" className="text-sm">{t('email')}</Label>
        <Input id="cf-email" type="email" autoComplete="email" className="mt-1.5" {...field('email')} />
        {errors.email ? <p id="cf-email-err" role="alert" className="mt-1 text-xs text-destructive">{errors.email}</p> : null}
      </div>
      <div>
        <Label htmlFor="cf-message" className="text-sm">{t('message')}</Label>
        <Textarea
          id="cf-message"
          rows={5}
          placeholder={t('messagePlaceholder')}
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
