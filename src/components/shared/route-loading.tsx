'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * RouteLoading — the shared per-route loading skeleton
 * (gold-standard audit round 2: F-S4-01 + F-S6-05 + F-S5-04).
 *
 * WHY THIS EXISTS: the five route loading.tsx files used to call
 * `getTranslations()` on the server, which opts every inner route into
 * DYNAMIC rendering (headers()/cookies() fallback in the loading render
 * pass) — 10 of 12 routes shipped `Cache-Control: no-store` with no CDN
 * caching (F-S4-01, HIGH). This component is a CLIENT component: its
 * `useTranslations` reads the layout's NextIntlClientProvider (messages
 * are already in the RSC payload), so the loading segment contains ZERO
 * server-side request APIs and the routes stay statically prerendered.
 *
 * The five byte-identical copies (F-S6-05) collapse into this one file;
 * each route gets a 1:1 skeleton (F-S5-04) that mimics its destination's
 * geometry — dark PageHero band (kicker pill + two heading lines +
 * subtitle + CTA) followed by the route's content rhythm — while keeping
 * the full-viewport CLS guard (the streamed page replaces same-height
 * whitespace instead of pushing the footer down).
 *
 * Locale-neutral by design (shapes only — no text to translate except the
 * sr-only status label); RTL-safe (centered hero + gap-based grids).
 * Pulse groups use Tailwind's opacity keyframes with a motion-reduce
 * opt-out.
 */

export type RouteLoadingVariant = 'about' | 'work' | 'contact' | 'websites' | 'automation'

/** Dark hero band skeleton — mirrors PageHero's authored rhythm
 * (pt-32 pb-20 sm:pt-40 sm:pb-28, elyra-container, centered stack). */
function HeroSkeleton() {
  return (
    <section className="relative isolate overflow-hidden bg-elyra-dark pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="elyra-container max-w-4xl flex flex-col items-center gap-6 animate-pulse motion-reduce:animate-none">
        {/* kicker pill */}
        <span className="block h-7 w-28 rounded-full bg-white/10" aria-hidden="true" />
        {/* h1: two centered lines */}
        <span className="block h-10 sm:h-14 w-4/5 rounded-xl bg-white/10" aria-hidden="true" />
        <span className="block h-10 sm:h-14 w-1/2 rounded-xl bg-white/10" aria-hidden="true" />
        {/* subtitle line */}
        <span className="block h-4 w-2/3 rounded-md bg-white/10" aria-hidden="true" />
        {/* CTA pill */}
        <span className="mt-2 block h-11 w-44 rounded-full bg-white/10" aria-hidden="true" />
      </div>
    </section>
  )
}

/** Light body section wrapper — the destination pages' content rhythm. */
function BodySkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="elyra-container py-16 sm:py-24 animate-pulse motion-reduce:animate-none">
      {children}
    </div>
  )
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-2xl border border-foreground/10 bg-foreground/5', className)}
      aria-hidden="true"
    />
  )
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <span
      className={cn('block h-4 rounded-md bg-foreground/10', className)}
      aria-hidden="true"
    />
  )
}

/** about: values card row → prose heading + lines → numbers row. */
function AboutSkeleton() {
  return (
    <BodySkeleton>
      <div className="flex flex-col items-center gap-8">
        <div className="grid w-full gap-6 sm:grid-cols-3">
          <SkeletonCard className="h-36" />
          <SkeletonCard className="h-36" />
          <SkeletonCard className="h-36" />
        </div>
        <div className="flex w-full max-w-3xl flex-col items-center gap-5">
          <span className="block h-8 w-1/3 rounded-lg bg-foreground/10" aria-hidden="true" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-11/12" />
          <SkeletonLine className="w-4/5" />
        </div>
        <div className="grid w-full gap-6 sm:grid-cols-4">
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
        </div>
      </div>
    </BodySkeleton>
  )
}

/** work: filter pills row + the project image-card grid. */
function WorkSkeleton() {
  return (
    <BodySkeleton>
      <div className="flex flex-col gap-10">
        <div className="flex items-center justify-center gap-3">
          <span className="h-9 w-20 rounded-full bg-foreground/10" aria-hidden="true" />
          <span className="h-9 w-24 rounded-full bg-foreground/10" aria-hidden="true" />
          <span className="h-9 w-16 rounded-full bg-foreground/10" aria-hidden="true" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} className="h-64" />
          ))}
        </div>
      </div>
    </BodySkeleton>
  )
}

/** contact: two-column — form card (input rows + submit) + info cards. */
function ContactSkeleton() {
  return (
    <BodySkeleton>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-6">
          <SkeletonLine className="w-1/3" />
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} className="h-11 rounded-lg" />
          ))}
          <SkeletonLine className="w-1/4" />
          <div className="h-24 rounded-lg bg-foreground/5" aria-hidden="true" />
          <span className="mt-2 block h-11 w-36 self-end rounded-full bg-foreground/10" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-4">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
      </div>
    </BodySkeleton>
  )
}

/** services (websites / automation): prose heading + lines + feature cards. */
function ServiceSkeleton() {
  return (
    <BodySkeleton>
      <div className="flex flex-col items-center gap-10">
        <div className="flex w-full max-w-3xl flex-col items-center gap-5">
          <span className="block h-8 w-2/5 rounded-lg bg-foreground/10" aria-hidden="true" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-5/6" />
          <SkeletonLine className="w-2/3" />
        </div>
        <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-40" />
        </div>
      </div>
    </BodySkeleton>
  )
}

const VARIANTS: Record<RouteLoadingVariant, () => React.JSX.Element> = {
  about: AboutSkeleton,
  work: WorkSkeleton,
  contact: ContactSkeleton,
  websites: ServiceSkeleton,
  automation: ServiceSkeleton,
}

export function RouteLoading({ variant }: { variant: RouteLoadingVariant }) {
  const t = useTranslations('common')
  const Body = VARIANTS[variant]

  return (
    <div
      role="status"
      aria-live="polite"
      // Full-viewport fallback keeps the footer OUT of the visible frame
      // during React streaming — the streamed content then replaces
      // same-height whitespace instead of pushing the footer down
      // (measured CLS 0.424 on AR pages with a 60vh fallback).
      className="min-h-[100svh]"
    >
      <HeroSkeleton />
      <Body />
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}
