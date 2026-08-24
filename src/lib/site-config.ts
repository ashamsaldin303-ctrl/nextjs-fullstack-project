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
 * Brand palette mirrored from globals.css :root for programmatic consumers
 * (JSON-LD, OG images, icons). Keep in sync with the CSS custom properties
 * (audit P2-1 — see globals.css "Elyra Design Tokens").
 */
export const BRAND_COLORS = {
  primary: '#0071E3',
  dark: '#0F172A',
  onDark: '#F1F5F9',
  gBlue: '#4285F4',
  gRed: '#EA4335',
  gYellow: '#FBBC05',
  gGreen: '#34A853',
} as const
