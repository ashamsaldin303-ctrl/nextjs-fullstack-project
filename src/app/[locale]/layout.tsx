import type { Metadata, Viewport } from 'next'
import { Inter, Cairo } from 'next/font/google'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing, getDir } from '@/i18n/routing'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Toaster } from '@/components/ui/sonner'
import { MagneticCursor } from '@/components/sensory/magnetic-cursor'
import { FilmGrain } from '@/components/sensory/film-grain'
import '../globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Viewport: explicit width/scale (Next would default these anyway) +
// themeColor matching the dark hero surface (--elyra-dark #0F172A — every
// page opens on a dark hero, so browser chrome blends with it). The site
// is a light design with dark sections → colorScheme 'light'.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F172A',
  colorScheme: 'light',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })
  // Locale-aware canonical: Arabic (default) at "/", English at "/en"
  // (Lighthouse SEO: the EN homepage must not canonicalize to the AR one).
  const canonicalPath = locale === 'ar' ? '/' : '/en'

  return {
    title: {
      default: t('title'),
      template: `%s — Elyra`,
    },
    description: t('description'),
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    ),
    alternates: {
      canonical: canonicalPath,
      // P2-3: hreflang set incl. x-default (default Arabic locale).
      languages: {
        ar: '/',
        en: '/en',
        'x-default': '/',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: canonicalPath,
      siteName: 'Elyra',
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
    // Favicon is provided by the src/app/icon.tsx file convention — no
    // manual `icons` override (an explicit `/icon` URL 404s because the
    // convention route is content-hashed by Next).
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)
  const dir = getDir(locale)
  // Skip-link copy from the catalog (nav.skipToContent) — no hardcoded
  // strings that can drift from the messages files.
  const t = await getTranslations('nav')

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            {t('skipToContent')}
          </a>
          <Navbar />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          {/* Phase 2 — Sensory Polish Layer (app-wide, single instance each).
              MagneticCursor lives INSIDE NextIntlClientProvider so the
              Phase 5 WS-7 context chip can resolve translated labels
              from common.cursor.* at runtime. */}
          <FilmGrain />
          <MagneticCursor />
        </NextIntlClientProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
