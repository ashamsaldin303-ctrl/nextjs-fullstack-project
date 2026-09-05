'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight, ArrowUpLeft, MapPin, Play } from 'lucide-react'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { useCursorVelocity } from '@/lib/use-cursor-velocity'
import { useMagnetic } from '@/lib/use-magnetic'
import { KineticHeading } from './kinetic-heading'

const HeroCanvas = dynamic(
  () => import('./hero-canvas').then((m) => m.HeroCanvas),
  {
    ssr: false,
    loading: () => <div className="hero-fallback absolute inset-0" />,
  }
)

/* ------------------------------------------------------------------ */
/* Live Damascus clock — editorial "we are here" detail.               */
/* Server renders a neutral placeholder; the real time arrives after  */
/* mount (setState-in-effect), so hydration never mismatches.         */
/* ------------------------------------------------------------------ */
function DamascusClock({ locale }: { locale: string }) {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    // L6-R4 (fix 4): ar → LATIN digits via ar-SY-u-nu-latn. The mono face
    // is loaded latin-subset-only, so the default ar-SY Arabic-Indic
    // numerals fell through to a system font (fallback glyphs + a
    // post-hydration font-swap) and clashed with the footer clock /
    // trust-bar counters that already render Latin — three numeral
    // presentations on one page. Latin digits in ar is the site's runtime
    // numeral convention (see trust-bar.tsx). en → plain Latin digits.
    const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB', {
      timeZone: 'Asia/Damascus',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const tick = () => setTime(fmt.format(new Date()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [locale])

  return (
    <span dir="ltr" className="font-mono text-xs tabular-nums text-white/55">
      {time ?? '--:--:--'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Rotating circular-text badge — an editorial seal that links to the  */
/* work page. Latin-only textPath (shaping-safe), slow spin, magnet.   */
/* ------------------------------------------------------------------ */
function OrbitBadge({ label }: { label: string }) {
  // R7-b: magnetic pull on the badge Link (fine pointers, motion allowed).
  const badgeRef = useRef<HTMLAnchorElement>(null)
  useMagnetic(badgeRef)
  return (
    <Link
      ref={badgeRef}
      href="/work"
      aria-label={label}
      data-cursor="magnet"
      /* G2-4 F7: --color-elyra-deep now exists in the @theme block
         (globals.css) — the offset ring matches the hero's exact
         #08080A surface instead of the #0F172A elyra-dark approximation
         (was the documented L1-C workaround when the token was absent). */
      className="group relative hidden size-28 shrink-0 items-center justify-center rounded-full sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-deep"
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full motion-safe:animate-[spin_22s_linear_infinite]"
        aria-hidden="true"
      >
        <defs>
          <path
            id="elyra-orbit-path"
            d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"
            fill="none"
          />
        </defs>
        <text
          /* G2-1 F1: lang="en" islands the Latin chrome — the universal
             :lang(ar) letter-spacing reset exempts this element so the
             inline 0.16em tracking applies in AR too (same fix class as
             the simulator NODE_TYPE badges, G3F-A fix 8d). SVG text has
             no dir attribute — the textPath already renders LTR. */
          lang="en"
          className="fill-white/55 font-mono uppercase"
          style={{ fontSize: '7.6px', letterSpacing: '0.16em' }}
        >
          <textPath
            href="#elyra-orbit-path"
            textLength="236"
            lengthAdjust="spacingAndGlyphs"
          >
            ELYRA · DIGITAL CRAFT · EST 2024 ·
          </textPath>
        </text>
      </svg>
      <span className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/5 transition-all duration-300 group-hover:scale-110 group-hover:border-g-blue/50 group-hover:bg-g-blue/15">
        <ArrowUpLeft
          className="size-4 text-white/85 transition-transform duration-300 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Infinite marquee ticker — the hero's bottom edge. The track runs    */
/* LTR (transform loop), every item keeps its own direction so Arabic  */
/* shaping stays intact. Items duplicate ×2 for the seamless -50% lap. */
/* ------------------------------------------------------------------ */
function HeroMarquee({ items }: { items: string[] }) {
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <span key={i} className="flex shrink-0 items-center">
          <span className="whitespace-nowrap px-6 text-sm font-medium text-white/60 md:text-base">
            {item}
          </span>
          <Spark aria-hidden="true" />
        </span>
      ))}
    </div>
  )
  return (
    <div
      className="hero-marquee absolute inset-x-0 bottom-0 z-10"
      dir="ltr"
      data-bg-layer=""
      aria-hidden="true"
    >
      <div className="hero-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}

function Spark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-3.5 ${className ?? ''}`} fill="currentColor">
      <path d="M12 0c.9 6.9 4.2 10.2 12 12-7.8 1.8-11.1 5.1-12 12-.9-6.9-4.2-10.2-12-12C7.8 10.2 11.1 6.9 12 0Z" />
    </svg>
  )
}

/**
 * Elyra hero — R7 editorial-cinematic rework + R8 "Assembly" build sequence.
 *
 * Layout: asymmetric, start-aligned (right on RTL), giant masked-reveal
 * display type (KineticHeading), kicker row with a live Damascus clock,
 * outlined ELYRA watermark bleeding off the bottom corner, vertical
 * scroll rail on the empty edge, rotating orbit badge beside the CTAs,
 * and an infinite service marquee as the section's bottom edge.
 *
 * R8 build sequence: AFTER the intro curtain has fully lifted (R9 — the
 * release is strictly sequential now), a blueprint layer draws itself
 * (guides + brackets + crosshairs + mono spec labels), a scan line sweeps
 * the hero top→bottom "printing" the content into place (each block's
 * inline animationDelay is tuned to the line's position), the marquee edge
 * powers on and a closing diagonal sheen sweeps across — the agency's
 * "we build" narrative made literal.
 *
 * Preserved performance architecture: above-the-fold content renders
 * from the SERVER with CSS-only entrances (no framer-motion, LCP-safe);
 * the Three.js canvas stays deferred until idle/first interaction; the
 * frameloop pauses offscreen/hidden; spotlight grid follows the pointer.
 */
export function Hero() {
  const t = useTranslations('hero')
  const locale = useLocale()
  const reduced = usePrefersReducedMotion()

  const heroRef = useRef<HTMLElement>(null)
  const ctaPrimaryRef = useRef<HTMLAnchorElement>(null)
  const ctaSecondaryRef = useRef<HTMLAnchorElement>(null)
  const [active, setActive] = useState(true)
  const [load3D, setLoad3D] = useState(false)
  const intersectingRef = useRef(true)

  const marqueeItems = useMemo(() => {
    const raw = t.raw('marquee')
    return Array.isArray(raw) ? (raw as string[]) : []
  }, [t])

  useCursorVelocity(ctaPrimaryRef, {
    minWght: 600,
    maxWght: 700,
    idleWght: 700,
    saturationVelocity: 3,
    idleMs: 200,
  })

  // R7-b sensory layer — magnetic pull on both CTAs. ctaPrimaryRef is
  // shared with useCursorVelocity above (it writes the --wght CSS var,
  // this writes transform — no conflict). The hook clears its inline
  // transform at rest, so the Tailwind hover:scale / transition classes
  // keep governing the resting state.
  useMagnetic(ctaPrimaryRef)
  useMagnetic(ctaSecondaryRef)

  // R8.1 — Replay the "Assembly" choreography when the user RETURNS to
  // the homepage by history navigation (browser back / forward). Link
  // navigations remount the page and restart the CSS animations for free,
  // but history restores reuse the cached DOM (Next 16 router cache /
  // bfcache) with every one-shot animation already parked at its end
  // state — without a manual re-arm the sequence would silently not
  // replay. Re-arming is the class-toggle + forced-reflow idiom: while
  // `.hero-fx-restart` is present every hero animation computes to
  // `none`; the synchronous reflow commits that reset; removing the class
  // restarts each animation from time 0 (no intermediate frame is ever
  // painted). Two complementary signals cover both restore paths:
  //   · pageshow (persisted) → bfcache thaw of the whole document
  //   · currententrychange   → same-document history swap (covers the
  //     Next router cache; Chromium — harmless no-op elsewhere)
  const restartHeroFx = useCallback(() => {
    const el = heroRef.current
    if (!el) return
    el.classList.add('hero-fx-restart')
    void el.offsetWidth // flush the reset before the class comes off
    el.classList.remove('hero-fx-restart')
  }, [])

  useEffect(() => {
    if (reduced) return
    const isHomepage = () =>
      window.location.hash === '' &&
      (window.location.pathname === '/' || window.location.pathname === '/en')
    const onPageshow = (e: PageTransitionEvent) => {
      if (e.persisted && isHomepage()) restartHeroFx()
    }
    // The entry swap may still be mid-commit when the event fires (the
    // pathname can read as the OLD route) — settle it before deciding.
    const onEntryChange = () => {
      window.setTimeout(() => {
        if (isHomepage()) restartHeroFx()
      }, 0)
    }
    window.addEventListener('pageshow', onPageshow)
    const nav = (
      window as Window & { navigation?: EventTarget }
    ).navigation
    if (nav) nav.addEventListener('currententrychange', onEntryChange)
    return () => {
      window.removeEventListener('pageshow', onPageshow)
      if (nav) nav.removeEventListener('currententrychange', onEntryChange)
    }
  }, [reduced, restartHeroFx])

  // Pause rendering when the hero scrolls offscreen or the tab is hidden.
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          intersectingRef.current = entry.isIntersecting
          setActive(entry.isIntersecting && !document.hidden)
        }
      },
      { threshold: 0.05 }
    )
    io.observe(el)
    const onVisibility = () => setActive(!document.hidden && intersectingRef.current)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Spotlight Blueprint grid — rAF-coalesced pointer tracking.
  // G2-4 F2: tracking is gated to FINE POINTERS with motion allowed.
  // Touch visitors keep the designed static dim grid (their mask is
  // none — the --mx/--my writes + rect reads were pure waste), and
  // reduced-motion visitors keep the 0.3 static state; before this
  // gate the class was added on ANY pointermove and the old compound
  // .spotlight-active selector then beat the dim fallbacks in the
  // cascade. (pointer:fine is static per device — safe to cache.)
  const spotlightActivated = useRef(false)
  const finePointer = useRef(false)
  const latestPointer = useRef<React.PointerEvent<HTMLElement> | null>(null)
  const spotlightRaf = useRef(0)
  const onHeroPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (reduced) return
    if (!finePointer.current) {
      finePointer.current = window.matchMedia('(pointer: fine)').matches
    }
    if (!finePointer.current) return
    latestPointer.current = e
    if (spotlightRaf.current) return
    spotlightRaf.current = requestAnimationFrame(() => {
      spotlightRaf.current = 0
      const el = heroRef.current
      const ev = latestPointer.current
      if (!el || !ev) return
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${ev.clientX - rect.left}px`)
      el.style.setProperty('--my', `${ev.clientY - rect.top}px`)
      if (!spotlightActivated.current) {
        spotlightActivated.current = true
        el.classList.add('spotlight-active')
      }
    })
  }, [reduced])
  useEffect(() => () => {
    if (spotlightRaf.current) cancelAnimationFrame(spotlightRaf.current)
  }, [])

  // Defer the Three.js chunk until after LCP (idle or first interaction).
  useEffect(() => {
    if (reduced) return
    let started = false
    const start = () => {
      if (started) return
      started = true
      setLoad3D(true)
    }
    let cancel: (() => void) | undefined
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 2500 })
      cancel = () => window.cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(start, 1500)
      cancel = () => window.clearTimeout(id)
    }
    window.addEventListener('pointermove', start, { once: true, passive: true })
    window.addEventListener('keydown', start, { once: true, passive: true })
    return () => {
      cancel?.()
      window.removeEventListener('pointermove', start)
      window.removeEventListener('keydown', start)
    }
  }, [reduced])

  const show3D = !reduced && load3D

  return (
    <section
      ref={heroRef}
      onPointerMove={onHeroPointerMove}
      className="elyra-spotlight relative min-h-[100svh] overflow-hidden bg-elyra-deep text-elyra-on-dark"
      aria-labelledby="hero-title"
    >
      {/* Background — data-bg-layer opts out of .elyra-spotlight's
          content-lifting rule (see globals.css). */}
      <div className="absolute inset-0" data-bg-layer="">
        {show3D ? <HeroCanvas active={active} /> : null}
        <div className="hero-fallback absolute inset-0 -z-10" aria-hidden="true" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 30%, transparent, rgba(15,23,42,0.55) 80%)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* R8 — "The Assembly" build sequence (plays right after the entry
          intro lifts): blueprint guides draw, a scan line sweeps the hero
          top→bottom printing the content into place, the marquee edge
          powers on and a closing sheen sweeps across. Decorative only —
          every child animation is paused under html[data-intro] (see the
          globals.css R8 block for the full choreography). */}
      <div className="hero-build-fx" data-bg-layer="" aria-hidden="true">
        <div className="hero-blueprint">
          <span className="hb-line hb-v hb-v1" />
          <span className="hb-line hb-v hb-v2" />
          <span className="hb-line hb-h hb-h1" />
          <span className="hb-bracket hb-tl" />
          <span className="hb-bracket hb-tr" />
          <span className="hb-bracket hb-bl" />
          <span className="hb-bracket hb-br" />
          <span className="hb-cross hb-c1" />
          <span className="hb-cross hb-c2" />
          <span className="hb-cross hb-c3" />
          {/* G2-1 F1: lang="en" dir="ltr" islands the Latin spec labels —
              .hero-blueprint's CSS direction:ltr does NOT exempt them
              from the universal :lang(ar) letter-spacing reset (the
              selector tests the ATTRIBUTE, not computed style), so the
              .hb-label 0.14em tracking was lost in AR. NODE_TYPE-badge
              precedent (G3F-A fix 8d). */}
          <span lang="en" dir="ltr" className="hb-label hb-l1">FIG. 01 — HOMEPAGE ASSEMBLY</span>
          <span lang="en" dir="ltr" className="hb-label hb-l2">33.51°N · 36.29°E — DAMASCUS</span>
          <span lang="en" dir="ltr" className="hb-label hb-l3">GRID 12 × 8 · BUILD v2.5</span>
        </div>
        {/* L6-F1 (P2): the scan bar now rides inside a size-contained track
            (.hero-build-scan-track) so its sweep animates a compositor-only
            translateY in cqh units — the old `top` animation forced layout
            + paint every frame over the LCP hero. The whole layer stays
            decorative (aria-hidden on .hero-build-fx above). */}
        <div className="hero-build-scan-track">
          <span className="hero-build-scan" />
        </div>
        <span className="hero-build-sheen" />
      </div>

      {/* Outlined ELYRA watermark — bleeds off the far corner (the empty
          side of the asymmetric composition). Latin glyphs, stroke-only.
          data-bg-layer: exempt from .elyra-spotlight's content-lift rule
          (which would force position:relative and push the column down). */}
      <div className="hero-watermark" data-bg-layer="" aria-hidden="true">
        {t('watermark')}
      </div>

      {/* Vertical scroll rail on the empty edge (desktop only).
          data-bg-layer: same spotlight content-lift exemption. R9: inline
          build-sequence delay (synced to the tightened scan line reaching
          this edge). */}
      <div
        className="hero-enter pointer-events-none absolute bottom-36 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-4 ltr:right-7 rtl:left-7 lg:flex"
        style={{ animationDelay: '1.45s' }}
        data-bg-layer=""
        aria-hidden="true"
      >
        {/* L6-R4 (fix 8b): white/50 (~5.2:1) replaces white/45 (4.47:1 —
            marginal under WCAG AA for the small rail text). */}
        <span className="hero-rail-text text-[11px] font-medium uppercase text-white/50 ltr:tracking-[0.35em]">
          {t('scroll')}
        </span>
        <span className="hero-rail-line relative block w-px overflow-hidden">
          <span className="hero-rail-dot absolute inset-x-0 top-0 block h-10" aria-hidden="true" />
        </span>
      </div>

      {/* Content — start-aligned editorial column, CSS-only entrance.
          G2-1 F3: the pre-WS-0 hand-rolled container (mx-auto max-w-7xl
          px-4/6/8) is ported to the site's unified elyra-container /
          max-w-container system (globals.css §3.1) — 24/40/64px gutters
          and a fluid 1152→1440px cap on wide screens instead of the
          fixed 1280px clamp. (navbar.tsx:55 carries the same legacy
          pattern — OUT of this wave's file set, noted for a later round.) */}
      <div className="relative z-10 elyra-container max-w-container flex min-h-[100svh] flex-col justify-center pb-32 pt-24 text-start lg:pb-28">
        {/* Kicker row — pulse dot, agency line, place + live time.
            R9: inline delay synced to the tightened build scan line (~25%
            hero height — the line reaches the kicker ~0.65s into the sweep). */}
        <div
          className="hero-enter flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/70"
          style={{ animationDelay: '0.65s' }}
        >
          <span className="flex items-center gap-2.5">
            {/* L6-R3 (fix 7a): `relative` anchors the .elyra-pulse ::after
                ring (the pulse is a compositor-only pseudo-element now — see
                globals.css; the class itself must NOT set position or its
                unlayered rule would override the MiniFlow node's layered
                `absolute` utility). */}
            <span className="size-1.5 relative rounded-full bg-g-green elyra-pulse" aria-hidden="true" />
            <span className="font-medium">{t('badge')}</span>
          </span>
          <span className="hidden h-4 w-px bg-white/20 sm:block" aria-hidden="true" />
          <span className="hidden items-center gap-1.5 text-white/55 sm:flex">
            <MapPin className="size-3.5 text-g-blue/80" aria-hidden="true" />
            {t('location')}
            <DamascusClock locale={locale} />
          </span>
        </div>

        <KineticHeading
          id="hero-title"
          titleTopKey="titleTop"
          titleAccentKey="titleAccent"
          titleBottomKey="titleBottom"
        />

        <p
          className="hero-enter mt-7 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg"
          style={{ animationDelay: '1.25s' }}
        >
          {t('subtitle')}
        </p>

        <div
          className="hero-enter mt-9 flex w-full items-center gap-4 sm:gap-6"
          style={{ animationDelay: '1.45s' }}
        >
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              ref={ctaPrimaryRef}
              href="/contact"
              data-cursor="magnet"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-deep"
              style={reduced ? undefined : { fontVariationSettings: '"wght" var(--wght, 700)' }}
            >
              {t('ctaPrimary')}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link
              ref={ctaSecondaryRef}
              href="/work"
              data-cursor="magnet"
              /* G2-4 F8: no backdrop-filter — this pill sits directly
                 over the animating WebGL canvas, the exact software-GPU
                 hazard the marquee's own rule documents (globals.css
                 .hero-marquee comment); a more opaque white/10 fill
                 replaces the glass blur. Ring offset: exact elyra-deep
                 surface token (G2-4 F7). */
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 text-base font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-deep"
            >
              <Play className="size-4" aria-hidden="true" />
              {t('ctaSecondary')}
            </Link>
          </div>
          <span className="mx-2 hidden h-10 w-px bg-white/10 sm:block" aria-hidden="true" />
          <OrbitBadge label={t('ctaSecondary')} />
        </div>
      </div>

      {/* Service marquee — the hero's bottom edge. */}
      {marqueeItems.length > 0 ? <HeroMarquee items={marqueeItems} /> : null}
    </section>
  )
}
