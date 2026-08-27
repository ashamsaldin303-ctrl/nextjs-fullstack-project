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
 * no next-intl context exists above the [locale] segment, so the recovery
 * labels below are hardcoded AR · EN pairs mirroring the nav.* catalog
 * values (the translated variant lives in [locale]/not-found.tsx).
 */
import type { CSSProperties } from 'react'

const RECOVERY_LINKS = [
  { href: '/', label: 'الرئيسية · Home' },
  { href: '/services/websites', label: 'بناء المواقع · Websites' },
  { href: '/services/automation', label: 'الأتمتة · Automation' },
  { href: '/work', label: 'أعمالنا · Work' },
  { href: '/about', label: 'من نحن · About' },
  { href: '/contact', label: 'تواصل · Contact' },
]

const nfChip: CSSProperties = {
  display: 'inline-flex',
  minHeight: '2.75rem', /* 44px touch target (Batch 1 item 4) */
  alignItems: 'center',
  padding: '0 1rem',
  borderRadius: '9999px',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  color: '#F1F5F9',
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: 500,
}

export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>404 — Elyra</title>
        {/* Self-contained hover/focus states for the recovery chips —
            an inline <style> ships with the page, so it is as guaranteed
            as the inline styles (no globals.css dependency). */}
        <style>{`
          .nf-chip:hover { background: rgba(255, 255, 255, 0.10); border-color: rgba(0, 113, 227, 0.5); }
          .nf-chip:focus-visible { outline: 2px solid #4285F4; outline-offset: 2px; }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(0, 113, 227, 0.16), transparent 70%), #0F172A',
          color: '#F1F5F9',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif',
          textAlign: 'center',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {/* Self-contained hover/focus states ship in <head> above. */}
        <main style={{ padding: '4rem 1.5rem', maxWidth: '34rem' }}>
          {/* Elyra wordmark — inline SVG, zero external assets. Quad-dot
              accent matches logo.tsx (blue palette revert):
              blue / red / light-blue / green. */}
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
              minHeight: '2.75rem', // 44px touch target (L4 R5 P3)
              borderRadius: '9999px',
              background: '#0071E3',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            الصفحة الرئيسية · Home
          </a>

          {/* Batch 3 item 16: recovery nav (root-level, bilingual
              hardcoded — no next-intl context exists here). Plain <a>
              hrefs are safe: routing has localeDetection:false, so
              unmatched paths deterministically serve the default Arabic
              locale — no locale-detect/redirect dance — exactly like the
              home CTA above. Semantic <nav> labelled by its heading;
              RTL-safe (wrap + gap, no directional offsets). */}
          <nav
            aria-labelledby="nf-root-recovery"
            style={{ marginTop: '2.5rem', width: '100%' }}
          >
            <h2
              id="nf-root-recovery"
              style={{
                margin: 0,
                fontSize: '0.75rem',
                fontWeight: 600,
                /* no letter-spacing: the Arabic half of the bilingual
                   label must keep its cursive joins (Batch 1 item 2) */
                color: '#A3AEC2',
              }}
            >
              أين تريد المتابعة؟ · Where would you like to go?
            </h2>
            <ul
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '0.5rem',
                listStyle: 'none',
                margin: '1rem 0 0',
                padding: 0,
              }}
            >
              {RECOVERY_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="nf-chip" style={nfChip}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </main>
      </body>
    </html>
  )
}
