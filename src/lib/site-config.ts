/**
 * Elyra site configuration — single source of truth for contact channels
 * and brand constants (audit P1-14 / guide §4.10).
 *
 * F-S10-01 (gold-standard audit): values are now ENV-DRIVEN with the
 * production defaults below — the deploy environment (.env) is the
 * override surface, so swapping real accounts never touches code. The
 * three env vars are documented in .env.example; NEXT_PUBLIC_ prefix =
 * inlined at build time, readable on both server and client.
 *
 * ⚠️ OWNER ACTION STILL REQUIRED (pre-launch, audit D26): the WhatsApp
 * default below is the LAST placeholder-shaped value — replace
 * NEXT_PUBLIC_CONTACT_WHATSAPP in the production .env with the real
 * business number BEFORE launch. Email + Telegram already resolve to the
 * owned brand handles (elyra.agency domain / @elyra_agency) and only need
 * the underlying mailboxes/accounts to exist.
 */

function envOr(key: string, fallback: string): string {
  const value = process.env[key]
  // Empty string in .env means "unset" — fall through to the default.
  return value && value.trim() !== '' ? value.trim() : fallback
}

/** Raw E.164 WhatsApp number (no "+"), e.g. 963991000000. */
const WHATSAPP_NUMBER = envOr('NEXT_PUBLIC_CONTACT_WHATSAPP', '963991000000')

/** Formats the E.164 number for display: +963 991 000 000. */
function whatsappDisplay(): string {
  // 963 9XX XXX XXX grouping for Syrian mobile numbers; other lengths
  // render as a plain spaced triple-split so display never breaks.
  if (WHATSAPP_NUMBER.length === 12 && WHATSAPP_NUMBER.startsWith('963')) {
    return `+${WHATSAPP_NUMBER.slice(0, 3)} ${WHATSAPP_NUMBER.slice(3, 6)} ${WHATSAPP_NUMBER.slice(6, 9)} ${WHATSAPP_NUMBER.slice(9)}`
  }
  return `+${WHATSAPP_NUMBER.replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`
}

export const SITE_CONTACT = {
  email: envOr('NEXT_PUBLIC_CONTACT_EMAIL', 'hello@elyra.agency'),
  /** International format without "+" — used in wa.me links. */
  whatsappNumber: WHATSAPP_NUMBER,
  /** Display format for the contact page. */
  whatsappDisplay: whatsappDisplay(),
  telegramHandle: envOr('NEXT_PUBLIC_CONTACT_TELEGRAM', 'elyra_agency'),
} as const

export const SITE_SOCIAL = {
  // Derived from the handle — no duplicated hardcode to drift from the
  // contact page's displayed @handle (L3 audit, R6).
  telegram: `https://t.me/${SITE_CONTACT.telegramHandle}`,
  whatsapp: `https://wa.me/${SITE_CONTACT.whatsappNumber}`,
  instagram: 'https://instagram.com/elyra.agency',
  linkedin: 'https://linkedin.com/company/elyra-agency',
  github: 'https://github.com/elyra-agency',
} as const

/**
 * Single source of truth for the OG/Twitter card image alt text (L1-B P3,
 * fix 2-d): seo.ts, [locale]/layout.tsx and [locale]/page.tsx all reference
 * the SAME per-locale opengraph-image asset — one shared constant prevents
 * the two divergent alt strings the audit found ("… · n8n Automation ·
 * Digital Studio" vs "… & n8n Automation Systems").
 */
export const OG_IMAGE_ALT = 'Elyra — Stunning Websites · n8n Automation · Digital Studio'

/**
 * WhatsApp click-to-chat deep link with a prefilled, URL-encoded greeting
 * (Batch 2 item 7e — hero→contact conversion wave). The greeting copy is
 * owned by the caller (i18n: pages.contact.channels.whatsapp.greeting) so
 * this helper stays locale-agnostic; the number comes from the same
 * centralized SITE_CONTACT block the plain SITE_SOCIAL.whatsapp link uses.
 */
export function whatsappDeepLink(greeting: string): string {
  return `https://wa.me/${SITE_CONTACT.whatsappNumber}?text=${encodeURIComponent(greeting)}`
}
