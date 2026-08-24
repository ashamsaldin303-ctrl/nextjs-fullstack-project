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
              potentialAction: {
                '@type': 'SearchAction',
                target: `${SITE_URL}/work?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            },
          ],
        }),
      }}
    />
  )
}
