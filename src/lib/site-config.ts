/**
 * Elyra site configuration — single source of truth for contact channels
 * and brand constants (audit P1-14 / guide §4.10).
 *
 * ⚠️ PLACEHOLDER DATA — MUST be replaced with the real accounts before
 * launch (audit P1-14, mandatory pre-launch item). Swap the values here
 * only; every consumer (footer, contact page, JSON-LD) reads from this file.
 */

export const SITE_CONTACT = {
  email: 'hello@elyra.agency',
  /** International format without "+" — used in wa.me links. */
  whatsappNumber: '963991000000',
  /** Display format for the contact page. */
  whatsappDisplay: '+963 991 000 000',
  telegramHandle: 'elyra_agency',
} as const

export const SITE_SOCIAL = {
  telegram: 'https://t.me/elyra_agency',
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
