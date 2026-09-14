// Client-side skeleton (RouteLoading) — ZERO server-side request APIs, so
// this segment no longer opts the route into dynamic rendering (audit
// F-S4-01: getTranslations here forced no-store on 10 of 12 routes).
// Lives in the page segment (not [locale]/) on purpose: a loading.tsx at
// [locale] level would also wrap the [...rest] catch-all, whose Suspense
// fallback flushes the shell (HTTP 200) before notFound() throws — a
// soft-404. Per-segment boundaries keep the streaming/CLS behavior for
// real pages while letting the catch-all emit a hard 404.
import { RouteLoading } from '@/components/shared/route-loading'

export default function Loading() {
  return <RouteLoading variant="about" />
}
