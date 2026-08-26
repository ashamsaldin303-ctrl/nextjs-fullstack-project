import { getTranslations } from 'next-intl/server'
import { Loader2 } from 'lucide-react'

// Server component — resolves the active locale from the request config
// (proxy header + setRequestLocale), so the fallback is fully localized.
// Uses the existing `common.loading` key.
//
// Lives in the page segment (not [locale]/) on purpose: a loading.tsx at
// [locale] level would also wrap the [...rest] catch-all, whose Suspense
// fallback flushes the shell (HTTP 200) before notFound() throws — a
// soft-404. Per-segment boundaries keep the streaming/CLS behavior for
// real pages while letting the catch-all emit a hard 404.
export default async function Loading() {
  const t = await getTranslations('common')

  return (
    <div
      role="status"
      aria-live="polite"
      // Full-viewport fallback keeps the footer OUT of the visible frame
      // during React streaming — the streamed content then replaces
      // same-height whitespace instead of pushing the footer down
      // (measured CLS 0.424 on AR pages with a 60vh fallback).
      className="flex min-h-[100svh] items-center justify-center"
    >
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}
