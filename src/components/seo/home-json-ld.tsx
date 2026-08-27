import { SITE_URL } from '@/lib/seo'
import { SITE_CONTACT, SITE_SOCIAL } from '@/lib/site-config'

/**
 * Emits Organization + WebSite JSON-LD structured data.
 * Per guide §8.9, this is included on the HOME page only — not every route —
 * to avoid duplicate competing schemas. Contact/social data reads from the
 * centralized site config (audit P1-14).
 */
export function HomeJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': `${SITE_URL}/#organization`,
              name: 'Elyra',
              alternateName: 'إيليرا',
              url: SITE_URL,
              logo: `${SITE_URL}/icon`,
              email: SITE_CONTACT.email,
              sameAs: [
                SITE_SOCIAL.telegram,
                SITE_SOCIAL.instagram,
                SITE_SOCIAL.linkedin,
                SITE_SOCIAL.github,
              ],
              description:
                'Elyra is a digital agency crafting beautifully designed websites, interactive 3D experiences, and intelligent n8n automation systems.',
              knowsAbout: [
                'Web development',
                'n8n automation',
                '3D experiences',
                'AI agents',
                'Digital design',
              ],
            },
            {
              '@type': 'WebSite',
              '@id': `${SITE_URL}/#website`,
              url: SITE_URL,
              name: 'Elyra',
              publisher: { '@id': `${SITE_URL}/#organization` },
              inLanguage: ['ar', 'en'],
              // FIX(2-c/15): SearchAction removed — it advertised a
              // /work?q={search_term_string} search endpoint that doesn't
              // exist anywhere in the app (no search implementation).
            },
          ],
        })
          // Escape `<` → \u003c (L1-A P3 hardening): JSON.stringify does
          // NOT escape `</script>`, so without this a future dynamic
          // value could break out of the inline script element.
          .replace(/</g, '\\u003c'),
      }}
    />
  )
}
