import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'

/**
 * G2-3 P2-2 (fix 2): compact in-content cross-navigation for the service
 * pages — a quiet row of text links near the page end (the sibling service
 * + /work + /about). Deliberately NOT cards: the site's link idiom is a
 * text label + single ArrowRight glyph that flips via rtl:rotate-180
 * (audit P1-8 single-flip pattern) with the established hover nudge.
 *
 * Link labels reuse the existing nav.* catalog keys (the not-found
 * recovery nav does the same — zero duplicated copy); only the row label
 * is a per-page key (pages.{websites,automation}.explore.label).
 *
 * Server component (no client JS): the pages pin the request locale via
 * setRequestLocale before rendering, so the implicit-locale
 * getTranslations('nav') here never falls back to headers().
 */

const CROSS_LINKS = {
  websites: { href: '/services/websites', navKey: 'websites' },
  automation: { href: '/services/automation', navKey: 'automation' },
  work: { href: '/work', navKey: 'work' },
  about: { href: '/about', navKey: 'about' },
} as const

type CrossLinkId = keyof typeof CROSS_LINKS

export async function ServiceCrossNav({
  label,
  links,
}: {
  /** Row heading — the localized "our other services" label. */
  label: string
  /** Cross-link ids, in display order (the sibling service first). */
  links: readonly CrossLinkId[]
}) {
  const navT = await getTranslations('nav')

  return (
    <nav aria-label={label} className="border-t border-border bg-background">
      <div className="elyra-container max-w-5xl py-8">
        {/* Quiet row heading — the 404 recovery-heading idiom (uppercase
            tracking is a no-op in Arabic; the universal :lang(ar)
            letter-spacing reset covers the LTR-only tracking intent). */}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          {links.map((id) => (
            <li key={id}>
              <Link
                href={CROSS_LINKS[id].href}
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {navT(CROSS_LINKS[id].navKey)}
                <ArrowRight
                  className="size-3.5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
