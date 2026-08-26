import { z } from 'zod'

/**
 * Shared lead-field schemas — the SINGLE source of truth for validation
 * rules on both sides of the wire:
 *
 *   - server (authority): src/app/api/leads/route.ts
 *   - client (pre-submit UX): components/pages/contact-form.tsx +
 *     components/home/calculator.tsx
 *
 * Keeping the rules in one module prevents client/server drift
 * (final-board findings R2-MED-1 / R6-LOW-3: the calculator's whatsapp
 * field had drifted — no pattern, no length bounds — and its server-side
 * rejection was unsurfaced in the UI).
 *
 * IMPORTANT: error MESSAGES here are developer-facing defaults only.
 * The API maps validation issues onto the translated `apiErrors.fields.*`
 * catalog by field key (path), and the forms display their own localized
 * copy — so keep rules in sync here, copy in the consumers.
 */

/**
 * Rejects bidi / zero-width (Cf) and control (Cc) characters, except the
 * legitimate whitespace trio tab/LF/CR (final-board finding R1-LOW):
 * Cf chars (U+202E RLO, zero-widths…) spoof identity display in any
 * downstream admin/CRM view; stray control chars have no legitimate
 * place in lead text. Applied to free-text fields only (name, message) —
 * email/whatsapp are charset-restricted by their own patterns.
 */
const FORBIDDEN_CHARS = /[\p{Cc}\p{Cf}]/u

export function hasForbiddenChars(value: string): boolean {
  // Strip the allowed whitespace first, then look for any Cc/Cf residue.
  return FORBIDDEN_CHARS.test(value.replace(/[\t\n\r]/g, ''))
}

/** Full name: 2–100 chars after trim, no control/format characters. */
export const leadNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .refine((v) => !hasForbiddenChars(v), {
    message: 'control or bidi characters are not allowed',
  })

/** Email: Zod v4 top-level email validator (z.string().email() is
 *  deprecated in v4), bounded to 254 chars. */
export const leadEmailSchema = z.email().max(254)

/** Loose human-typed phone pattern: optional leading +, digits, spaces,
 *  parens, dashes — 5–30 chars. Optional (calculator leads only).
 *
 *  Empty string is treated as ABSENT (closing-verification V-B-1):
 *  zod's `.optional()` only exempts `undefined`, but the calculator's
 *  form state initializes `whatsapp: ''` — without this preprocess an
 *  untouched optional field would fail min(5) and block submission.
 *  Applied at the shared-schema level so client AND server treat ''
 *  identically (an API client sending "" gets the same leniency). */
export const leadWhatsappSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z
    .string()
    .trim()
    .min(5)
    .max(30)
    .regex(/^\+?[0-9 ()\-]{5,30}$/)
    .optional()
)

/** Contact inquiry text: 10–5000 chars, no control/format characters. */
export const leadMessageSchema = z
  .string()
  .trim()
  .min(10)
  .max(5000)
  .refine((v) => !hasForbiddenChars(v), {
    message: 'control or bidi characters are not allowed',
  })

/** Honeypot: hidden `companyWebsite` input that real users never fill
 *  but bots tend to complete. Validated, NEVER persisted — the API
 *  short-circuits non-empty values to a fake 201. */
export const honeypotSchema = z.string().max(200).optional()
