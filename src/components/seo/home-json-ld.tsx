import { SITE_URL } from '@/lib/seo'

/**
 * Emits Organization + WebSite JSON-LD structured data.
 * Per guide §8.9, this is included on the HOME page only — not every route —
 * to avoid duplicate competing schemas.
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
              email: 'hello@elyra.agency',
              sameAs: [
                'https://t.me/elyra_agency',
                'https://instagram.com/elyra.agency',
                'https://linkedin.com/company/elyra-agency',
                'https://github.com/elyra-agency',
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
