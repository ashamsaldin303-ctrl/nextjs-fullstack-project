'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/**
 * IntroOverlay — cinematic first-visit entry animation (R3, user request:
 * "an Entry Animation for the homepage — smooth and very distinctive").
 *
 * Sequence (once per browser session, ~2.55s + build, skippable by ANY intent):
 *   0.0s  deep stage + radial blue glow fades in
 *   0.1s  the Elyra quad-dot mark scales up with a soft glow
 *   0.4s  the wordmark wipes in via clip-path (Arabic-safe — no per-letter
 *         animation, so letter joining is never broken)
 *   0.85s tagline rises · 1.05s gradient line draws
 *   1.7s  the curtain LIFTS (clip-path wipe upward, 0.85s expo ease) — the
 *         hero entrance stays parked underneath until the lift is DONE
 *   2.55s curtain fully up → `data-intro` is removed HERE (R9: the user
 *         asked for the build animation to start strictly AFTER the entry
 *         animation finishes — previously the hero/build FX were released
 *         the moment the lift began and played half-hidden behind the
 *         rising curtain). The Assembly build sequence now starts from
 *         time 0 on a fully-revealed stage.
 *
 * Architecture (LCP/no-JS/hydration discipline):
 *   - The overlay markup is server-rendered so the very first paint is
 *     already the intro (no hero→overlay flash). A tiny BEFORE-INTERACTIVE
 *     script in the root layout (runs pre-paint, see [locale]/layout.tsx)
 *     arms `data-intro` on <html> for genuine first visits — CSS pauses the
 *     hero entrance animations while the attribute is present, so NOTHING
 *     under the curtain plays early; the whole choreography waits for the
 *     reveal (R9: release happens only after the lift completes).
 *   - Repeat visits in the same session: the same script sets
 *     `data-intro-off` pre-paint → CSS `display:none` (zero flash), and this
 *     component unmounts itself after hydration.
 *   - Reduced motion: the script never arms the intro and CSS hides the
 *     overlay outright — reduced users go straight to the hero.
 *   - No-JS first visit: pure-CSS animations still run and a CSS failsafe
 *     hides the overlay at 4.5s — nothing can ever trap the user.
 *   - Skip intents (pointerdown / wheel / keydown) collapse the hold phase
 *     to "now" — the curtain always obeys the user.
 */

/** sessionStorage flag — one play per tab session. */
const INTRO_SESSION_KEY = 'elyra-intro'
/** How long the wordmark holds before the curtain lifts. */
const HOLD_MS = 1700
/** Duration of the lift animation (matches the CSS transition). */
const LIFT_MS = 850

export function IntroOverlay() {
  const t = useTranslations('meta')
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<'hold' | 'exit' | 'done'>('hold')

  const startExit = useCallback(() => {
    setPhase((prev) => (prev === 'hold' ? 'exit' : prev))
  }, [])

  useEffect(() => {
    // Dismiss silently for repeat visits (pre-paint gate already hid it)
    // and for reduced-motion users (CSS hid it; never armed).
    if (reduced || document.documentElement.hasAttribute('data-intro-off')) {
      document.documentElement.removeAttribute('data-intro')
      // rAF-wrapped — never setState synchronously inside the effect body
      // (react-hooks/set-state-in-effect).
      const id = window.requestAnimationFrame(() => setPhase('done'))
      return () => window.cancelAnimationFrame(id)
    }

    // Any real interaction collapses the hold phase immediately.
    let holdId = 0
    const onSkip = () => {
      window.clearTimeout(holdId)
      startExit()
    }
    window.addEventListener('pointerdown', onSkip)
    window.addEventListener('wheel', onSkip, { passive: true })
    window.addEventListener('keydown', onSkip)

    holdId = window.setTimeout(startExit, HOLD_MS)

    return () => {
      window.removeEventListener('pointerdown', onSkip)
      window.removeEventListener('wheel', onSkip)
      window.removeEventListener('keydown', onSkip)
      window.clearTimeout(holdId)
    }
  }, [reduced, startExit])

  useEffect(() => {
    if (phase !== 'exit') return
    // R9 SEQUENTIAL RELEASE: `data-intro` stays armed for the ENTIRE lift
    // (0.85s) — the hero entrance + Assembly build FX are held at their
    // start frames behind the rising curtain. The attribute is removed
    // only once the clip-path transition has fully completed, so the build
    // sequence begins from time 0 on a fully-revealed stage (user request:
    // "make the build animation start after the entry animation ends").
    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, '1')
    } catch {
      // Private mode / storage disabled — the intro simply replays next load.
    }
    const id = window.setTimeout(() => {
      document.documentElement.removeAttribute('data-intro')
      setPhase('done')
    }, LIFT_MS)
    return () => window.clearTimeout(id)
  }, [phase])

  // R9 safety net: the release now happens 0.85s AFTER the exit starts. If
  // the overlay unmounts inside that window (client navigation via
  // keyboard, route change, error boundary), the pending timeout is
  // cancelled by the effect cleanup above and `data-intro` would stay
  // armed FOREVER — pausing every .hero-enter animation site-wide (inner
  // pages included) behind opacity:0. Removing the attribute on unmount is
  // idempotent and costs nothing.
  useEffect(
    () => () => {
      document.documentElement.removeAttribute('data-intro')
    },
    []
  )

  if (phase === 'done') return null

  return (
    <div
      className={phase === 'exit' ? 'intro-overlay intro-exit' : 'intro-overlay'}
      aria-hidden="true"
      role="presentation"
    >
      <div className="intro-inner">
        {/* Radial stage glow behind the mark (decorative) */}
        <div className="intro-glow" />
        {/* Enlarged Elyra mark — same quad-dot geometry as logo.tsx */}
        <svg className="intro-mark" viewBox="0 0 36 36" role="presentation">
          <rect width="36" height="36" rx="9" fill="#F1F5F9" />
          <path
            d="M11 9 H22 V12.4 H14.6 V16.4 H20.6 V19.8 H14.6 V24 H22 V27.4 H11 Z"
            fill="#0F172A"
          />
          <circle cx="27" cy="20.4" r="2.6" fill="#4285F4" />
          <circle cx="27" cy="14.8" r="1.5" fill="#EA4335" />
          <circle cx="22.6" cy="20.4" r="1.5" fill="#FBBC05" />
          <circle cx="27" cy="25.9" r="1.5" fill="#34A853" />
        </svg>
        {/* Wordmark — clip-path wipe keeps Arabic letter joining intact */}
        <div className="intro-word">{t('siteName')}</div>
        <div className="intro-tag">{t('tagline')}</div>
        <div className="intro-line" />
      </div>
    </div>
  )
}
