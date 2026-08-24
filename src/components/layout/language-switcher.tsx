'use client'

import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({
  variant = 'on-dark',
  className,
}: {
  variant?: 'on-dark' | 'on-light'
  className?: string
}) {
  const locale = useLocale()
  const t = useTranslations('nav')
  const router = useRouter()
  const pathname = usePathname()
  const target = locale === 'ar' ? 'en' : 'ar'

  const onLight = variant === 'on-light'
  const base =
    'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  const colors = onLight
    ? 'bg-foreground/5 text-foreground hover:bg-foreground/10'
    : 'bg-white/10 text-white hover:bg-white/15'

  return (
    <button
      type="button"
      data-cursor="magnet"
      className={cn(base, colors, className)}
      aria-label={t('switchLocaleLabel')}
      onClick={() => router.replace(pathname, { locale: target })}
    >
      <Globe className="size-4" aria-hidden="true" />
      <span aria-hidden="true">{t('switchLocale')}</span>
    </button>
  )
}
