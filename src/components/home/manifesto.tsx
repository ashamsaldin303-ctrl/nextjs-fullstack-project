'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/**
 * Manifesto (R7) — the scroll-linked word-by-word statement.
 *
 * A quiet, editorial "breath" section: one large statement whose words
 * light up sequentially as the visitor scrolls through it — the classic
 * award-site reading-lamp effect. The signature line is the last thing
 * to appear.
 *
 * Engineering notes:
 *   · Zero framer-motion — one rAF-coalesced scroll handler, armed by an
 *     IntersectionObserver (25% margins) so nothing runs while the
 *     section is away from the viewport.
 *   · Scripting-safe: words render at full opacity from the SERVER; the
 *     effect dims them in its first paint after mount (below the fold,
 *     so no flash is ever visible). No-JS and reduced-motion users
 *     simply read a fully-lit statement.
 *   · Arabic-safe: each word is one inline-block shaping run (joining
 *     never crosses spans); no letter-spacing.
 */

/** Words each fade in over this many "word units" of scroll progress. */
const WORD_WINDOW = 1.8
/** Extra progress head-room so the last word + signature fully land. */
const PROGRESS_TAIL = 2.5

export function Manifesto() {
  const t = useTranslations('manifesto')
  const reduced = usePrefersReducedMotion()

  const sectionRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const sigRef = useRef<HTMLParagraphElement>(null)

  const words = useMemo(
    () => t('body').split(/\s+/).filter((w) => w.length > 0),
    [t]
  )

  useEffect(() => {
    if (reduced) return
    const section = sectionRef.current
    const title = titleRef.current
    if (!section || !title || words.length === 0) return

    const wordEls = wordRefs.current
    const sig = sigRef.current
    const n = words.length
    const span = n + PROGRESS_TAIL

    let raf = 0
    let armed = false

    const paint = () => {
      raf = 0
      // Progress is measured on the STATEMENT (h2), not the section —
      // the section's py-28 padding + kicker would otherwise complete
      // the effect while the statement still sits low in the viewport.
      const rect = title.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // Progress 0 → 1 as the section's top travels from 85% to 32% of
      // the viewport height (a comfortable reading scroll distance).
      const start = vh * 0.85
      const end = vh * 0.32
      const p = Math.min(Math.max((start - rect.top) / (start - end), 0), 1)

      for (let i = 0; i < n; i++) {
        const el = wordEls[i]
        if (!el) continue
        const lit = Math.min(Math.max((p * span - i) / WORD_WINDOW, 0), 1)
        // Direct style writes — the codebase convention for per-frame
        // work (never setState in a scroll-driven rAF loop).
        el.style.opacity = (0.13 + 0.87 * lit).toFixed(3)
      }
      if (sig) {
        const lit = Math.min(Math.max((p * span - n - 0.4) / 1.6, 0), 1)
        sig.style.opacity = (0.13 + 0.87 * lit).toFixed(3)
      }
    }

    const onScroll = () => {
      if (raf || !armed) return
      raf = requestAnimationFrame(paint)
    }

    // Dim everything for the effect's start state (SSR painted full
    // opacity — the no-JS / reduced-motion resting state).
    armed = true
    paint()

    const io = new IntersectionObserver(
      ([entry]) => {
        armed = entry?.isIntersecting ?? false
        if (armed) onScroll()
      },
      { rootMargin: '25% 0px 25% 0px' }
    )
    io.observe(section)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced, words.length])

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-background py-28 sm:py-36"
      aria-labelledby="manifesto-title"
    >
      <div className="elyra-container max-w-container">
        <RevealKicker>{t('kicker')}</RevealKicker>

        <h2
          id="manifesto-title"
          ref={titleRef}
          className="mt-8 max-w-4xl text-3xl font-bold leading-[1.45] text-foreground sm:text-4xl lg:text-[2.8rem] lg:leading-[1.4]"
        >
          {words.map((word, i) => (
            <span key={i}>
              <span
                ref={(el) => {
                  wordRefs.current[i] = el
                }}
                className="manifesto-word"
              >
                {word}
              </span>{' '}
            </span>
          ))}
        </h2>

        <p
          ref={sigRef}
          className="manifesto-sig mt-10 text-lg font-semibold text-primary-strong"
        >
          {t('signature')}
        </p>
      </div>
    </section>
  )
}

/** Kicker with a gentle one-shot entrance — reuses the global .kicker
 *  style (small tracked label with the leading rule). */
function RevealKicker({ children }: { children: React.ReactNode }) {
  return <span className="kicker">{children}</span>
}
