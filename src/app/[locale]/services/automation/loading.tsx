// Client-side skeleton (RouteLoading) — ZERO server-side request APIs, so
// this segment no longer opts the route into dynamic rendering (audit
// F-S4-01). See about/loading.tsx for the segment-placement rationale.
import { RouteLoading } from '@/components/shared/route-loading'

export default function Loading() {
  return <RouteLoading variant="automation" />
}
