/**
 * ROOT-level 404 — the last-resort boundary for requests that never enter
 * the [locale] layout: extension-bearing paths skipped by the proxy
 * matcher (e.g. `/foo.txt`), or `notFound()` thrown from
 * [locale]/layout.tsx itself (invalid locale segment). It renders OUTSIDE
 * every layout, so it ships its own <html>/<body> — the same
 * self-contained pattern as global-error.tsx — with inline styles only:
 * globals.css and Tailwind classes are NOT guaranteed to load here.
 *
 * Bilingual by design, Arabic-first RTL (the site's default locale):
 * no next-intl context exists above the [locale] segment.
 */
export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>404 — Elyra</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(0, 113, 227, 0.18), transparent 70%), #0F172A',
          color: '#F1F5F9',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif',
          textAlign: 'center',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <main style={{ padding: '4rem 1.5rem', maxWidth: '34rem' }}>
          {/* Elyra wordmark — inline SVG, zero external assets */}
          <svg
            viewBox="0 0 36 36"
            width="48"
            height="48"
            role="img"
            aria-label="Elyra"
            style={{ display: 'inline-block' }}
          >
            <rect width="36" height="36" rx="9" fill="#F1F5F9" />
            <path
              d="M11 9 H22 V12.4 H14.6 V16.4 H20.6 V19.8 H14.6 V24 H22 V27.4 H11 Z"
              fill="#0F172A"
            />
            <circle cx="27" cy="20.4" r="2.6" fill="#4285F4" />
            <circle cx="27" cy="14.8" r="1.5" fill="#EA4335" />
            <circle cx="22.6" cy="20.4" r="1.5" fill="#FBBC05" />
            <circle cx="27" cy="25.9" r="1.5" fill="#34A853" />
          </svg>
          <div
            style={{
              marginTop: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              letterSpacing: '0.25em',
              color: '#A3AEC2',
            }}
          >
            ELYRA
          </div>
          <p
            style={{
              margin: '1.5rem 0 0',
              fontSize: '5rem',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            404
          </p>
          <h1 style={{ margin: '1.25rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
            الصفحة غير موجودة
          </h1>
          <p lang="en" dir="ltr" style={{ margin: '0.5rem 0 0', color: '#A3AEC2' }}>
            Page not found
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: '2rem',
              padding: '0.625rem 1.5rem',
              borderRadius: '9999px',
              background: '#0071E3',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            الصفحة الرئيسية · Home
          </a>
        </main>
      </body>
    </html>
  )
}
