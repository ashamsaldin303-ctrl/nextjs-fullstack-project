/**
 * Server-side translations for the /api/leads route (Phase 3).
 *
 * Route handlers under /app/api are excluded from the next-intl proxy
 * matcher by design, so we read the message catalogs directly and expose
 * a tiny namespaced getter. Locale resolution lives in the route.
 */

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

export type ApiLocale = 'ar' | 'en'

type ApiMessages = typeof ar.apiErrors

const CATALOGS: Record<ApiLocale, ApiMessages> = {
  ar: ar.apiErrors,
  en: en.apiErrors,
}

export type ApiT = (key: string) => string

export function getApiT(locale: ApiLocale): ApiT {
  const messages = CATALOGS[locale]
  return (key: string): string => {
    const parts = key.split('.')
    let node: unknown = messages
    for (const part of parts) {
      if (typeof node !== 'object' || node === null) return key
      node = (node as Record<string, unknown>)[part]
    }
    return typeof node === 'string' ? node : key
  }
}
