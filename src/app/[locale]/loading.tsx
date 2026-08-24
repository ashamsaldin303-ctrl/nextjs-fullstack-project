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
      // Hotfix H-1: a full-viewport fallback keeps the footer OUT of the
      // visible frame during React streaming — the streamed content then
      // replaces same-height whitespace instead of pushing the footer down
      // (production Lighthouse measured CLS 0.424 on AR pages with the old
      // 60vh fallback; /en was unaffected only because its shell renders
      // differently). Layout + spinner unchanged.
      className="flex min-h-[100svh] items-center justify-center"
    >
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}
