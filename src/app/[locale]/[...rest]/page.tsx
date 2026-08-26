import { notFound } from 'next/navigation'

/**
 * Catch-all — unknown paths under a valid locale render the LOCALIZED
 * not-found boundary ([locale]/not-found.tsx) INSIDE the [locale] layout
 * (navbar, footer, correct lang/dir). Without this route, unmatched URLs
 * fall through to Next's stock root 404 and lose all locale context
 * (audit P0-2). The proxy rewrites prefix-less paths under the default
 * locale, so this boundary covers every shape of unknown URL.
 *
 * `notFound()` (rather than rendering copy inline) keeps the single
 * source of truth in [locale]/not-found.tsx and makes Next emit the
 * proper 404 status + `noindex` meta.
 *
 * NOTE: deliberately NO loading.tsx in this segment — a Suspense fallback
 * here would flush the shell (HTTP 200) before notFound() throws,
 * turning the hard 404 into a soft 200 (see [locale]/loading.tsx move).
 */
export default function CatchAllPage() {
  notFound()
}
