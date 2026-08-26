'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Clock } from 'lucide-react'

/**
 * Live clock — hydration-safe: renders a placeholder until mount,
 * then updates every minute. Uses the visitor's own timezone.
 * (See guide §1.6: time-dependent values live in useEffect.)
 */
export function LiveClock({ variant = 'on-dark' }: { variant?: 'on-dark' | 'on-light' }) {
  const locale = useLocale()
  const t = useTranslations('footer')
  const [time, setTime] = useState<string | null>(null)
  const [tzLabel, setTzLabel] = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const intl = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZoneName: 'short',
      })
      setTime(intl.format(now))

      // A short, friendly timezone label (e.g. "GMT+3")
      try {
        const offset = -now.getTimezoneOffset() / 60
        const sign = offset >= 0 ? '+' : '-'
        setTzLabel(`GMT${sign}${Math.abs(offset)}`)
      } catch {
        setTzLabel(null)
      }
    }
    update()
    const id = window.setInterval(update, 60 * 1000)
    return () => window.clearInterval(id)
  }, [locale])

  const onLight = variant === 'on-light'
  return (
    <span
      className="inline-flex items-center gap-2 text-sm"
      // No aria-live/role on purpose (audit P1-3): a clock that announces
      // every minute is noise for screen-reader users. The visible text
      // stays readable; the `title` tooltip carries the context.
      title={t('localTime')}
    >
      <Clock className={onLight ? 'size-4 text-foreground/60' : 'size-4 text-white/60'} aria-hidden="true" />
      <span className={onLight ? 'text-foreground/70' : 'text-white/70'} aria-hidden="true">
        {t('localTime')}:
      </span>
      <span className={onLight ? 'text-foreground' : 'text-white'}>
        {time ?? '--:--'}
        {tzLabel ? (
          <span className={onLight ? 'text-foreground/60' : 'text-white/60'}>
            {' '}
            ({tzLabel})
          </span>
        ) : null}
      </span>
    </span>
  )
}
