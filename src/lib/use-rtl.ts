'use client'

import { useLocale } from 'next-intl'

/**
 * Returns true when the current locale is RTL (Arabic).
 * Safe to call in client components; resolves synchronously from the
 * NextIntlClientProvider context (no hydration flash).
 */
export function useIsRtl(): boolean {
  const locale = useLocale()
  return locale === 'ar'
}
