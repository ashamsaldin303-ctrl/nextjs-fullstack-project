'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')
  useEffect(() => {
    // Client-side log (browser console only) — this is a client boundary,
    // so nothing reaches the server here. Wiring this into a server-side
    // capture (e.g. a reporting endpoint) is future work.
    console.error('[elyra:error]', error.message, error.digest)
  }, [error])

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t('errorTitle')}
      </h1>
      <p className="mt-4 text-muted-foreground">{t('errorDesc')}</p>
      <Button onClick={reset} className="mt-8 gap-2">
        <RotateCcw className="size-4" aria-hidden="true" />
        {t('retry')}
      </Button>
    </section>
  )
}
