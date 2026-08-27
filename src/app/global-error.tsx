'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { RotateCcw } from 'lucide-react'

// Root-level error boundary sits ABOVE the [locale] segment, so next-intl
// context is unavailable here. We detect the browser language instead and
// serve bilingual copy (audit P1-1).
const COPY = {
  ar: {
    lang: 'ar',
    dir: 'rtl',
    title: 'حدث خطأ ما',
    desc: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
    button: 'حاول مجدداً',
  },
  en: {
    lang: 'en',
    dir: 'ltr',
    title: 'Something went wrong',
    desc: 'An unexpected error occurred. Please try again.',
    button: 'Try again',
  },
} as const

const subscribeNoop = () => () => {}

function detectCopy(): (typeof COPY)[keyof typeof COPY] {
  if (
    typeof navigator !== 'undefined' &&
    (navigator.language.startsWith('ar') ||
      navigator.languages?.some((l) => l.startsWith('ar')))
  ) {
    return COPY.ar
  }
  return COPY.en
}

function getServerCopy(): (typeof COPY)[keyof typeof COPY] {
  return COPY.en
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Language is read via useSyncExternalStore — the canonical React 19 way
  // to consume client-only external values hydration-safely (the server
  // snapshot stays English; no setState-in-effect cascading render).
  const copy = useSyncExternalStore(subscribeNoop, detectCopy, getServerCopy)

  useEffect(() => {
    console.error('[elyra:global-error]', error.message, error.digest)
  }, [error])

  return (
    <html lang={copy.lang} dir={copy.dir}>
      <body
        style={{
          background: '#0F172A',
          color: '#F1F5F9',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, margin: 0 }}>
            {copy.title}
          </h1>
          <p style={{ opacity: 0.7, marginTop: '0.75rem' }}>
            {copy.desc}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '9999px',
              background: '#B45309',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            {copy.button}
          </button>
        </div>
      </body>
    </html>
  )
}
