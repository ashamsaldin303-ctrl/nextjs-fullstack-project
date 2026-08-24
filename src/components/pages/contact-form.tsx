'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  message: z.string().trim().min(10),
})

type FormValues = z.infer<typeof schema>

export function ContactForm() {
  const t = useTranslations('pages.contact.form')
  const [values, setValues] = useState<FormValues>({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({})
  const [submitting, setSubmitting] = useState(false)

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
    // Phase 1: client-only success. Phase 3 wires POST /api/leads with
    // server-side validation (guide §2.2) + storage + n8n webhook.
    await new Promise((r) => setTimeout(r, 900))
    setSubmitting(false)
    toast.success(t('successTitle'), { description: t('successDesc') })
    setValues({ name: '', email: '', message: '' })
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
      <Button type="submit" disabled={submitting} className={cn('w-full gap-2 sm:w-auto')}>
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
