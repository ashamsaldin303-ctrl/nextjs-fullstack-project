import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getDir } from '@/i18n/routing'

export default async function NotFound() {
  const t = await getTranslations('common')
  const locale = await getLocale()
  const isRtl = getDir(locale) === 'rtl'
  const Arrow = isRtl ? ArrowLeft : ArrowRight

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="kicker">404</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
        {t('notFoundTitle')}
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">{t('notFoundDesc')}</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-primary-foreground transition-transform hover:scale-105"
      >
        {t('backToHome')}
        <Arrow className="size-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
