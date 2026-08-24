import { getTranslations } from 'next-intl/server'
import { Loader2 } from 'lucide-react'

// Server component — resolves the active locale from the request config
// (proxy header + setRequestLocale), so the fallback is fully localized
// (audit P1-2). Uses the existing `common.loading` key.
export default async function Loading() {
  const t = await getTranslations('common')

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}
