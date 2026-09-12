/**
 * Client-side lead-submission transport helpers (F-S1-04 + F-S2-01 —
 * gold-standard audit).
 *
 * Shared by BOTH /api/leads callers (contact form + calculator). Keeps the
 * header contract in ONE place so the two forms can never drift:
 *
 *   x-csrf-token      — CSRF double-submit echo (reads the elyra-csrf
 *                       cookie fresh at call time; the proxy rotates the
 *                       value on every document response, so reading at
 *                       mount would risk desync. Absent cookie → header
 *                       omitted → the API's browser-class CSRF gate only
 *                       arms when the cookie is actually present).
 *   Idempotency-Key   — UUID minted per submission INTENT (mount-scoped,
 *                       refreshed after every 201): a network-level retry
 *                       of the SAME logical submission reuses the key, so
 *                       the server returns the original row instead of
 *                       creating a duplicate (route-side dedupe via the
 *                       unique idempotency_key column).
 */

import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf'

/** Reads one cookie value (first match, URL-decoded defensively). */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim())
      } catch {
        return part.slice(eq + 1).trim()
      }
    }
  }
  return null
}

/**
 * Standard fetch headers for a lead POST. `locale` rides the existing
 * x-elyra-locale contract (server-side error translation).
 */
export function leadRequestHeaders(locale: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-elyra-locale': locale,
  }
  const token = readCookie(CSRF_COOKIE)
  if (token) headers[CSRF_HEADER] = token
  return headers
}

/**
 * RFC-4122 v4 UUID — crypto.randomUUID when available (secure contexts),
 * with a manual fallback for exotic/embedded webviews that lack it.
 * Matches the server-side charset validation [0-9a-f-]{8,64}.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const v6 = bytes[6] ?? 0
  const v8 = bytes[8] ?? 0
  bytes[6] = (v6 & 0x0f) | 0x40 // version 4
  bytes[8] = (v8 & 0x3f) | 0x80 // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}
