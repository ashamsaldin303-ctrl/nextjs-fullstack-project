import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  // Arabic is the default locale: clean URLs without prefix for Arabic,
  // English lives under /en — matches the agency's Arabic-first identity.
  localePrefix: 'as-needed',
  // Deterministic behavior for previews: never redirect based on headers.
  localeDetection: false,
})

export type Locale = (typeof routing.locales)[number]

export function getDir(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}
