'use client'

import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[elyra:global-error]', error.message, error.digest)
  }, [error])

  return (
    <html lang="en">
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
            Something went wrong
          </h1>
          <p style={{ opacity: 0.7, marginTop: '0.75rem' }}>
            An unexpected error occurred. Please try again.
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
              background: '#0071E3',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
