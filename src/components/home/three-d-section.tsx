'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useReducedMotion } from 'framer-motion'
import { MousePointer2 } from 'lucide-react'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'

const CapabilityScene = dynamic(
  () => import('@/components/three/capability-scene').then((m) => m.CapabilityScene),
  {
    ssr: false,
    loading: () => <div className="hero-fallback absolute inset-0" />,
  }
)

export function ThreeDSection() {
  const t = useTranslations('pages.websites.threeD')
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry) setActive(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )
    io.observe(el)
    const onVis = () => setActive(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <section className="bg-elyra-dark py-20 text-elyra-on-dark sm:py-28" aria-labelledby="threeD-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          variant="on-dark"
        />

        <Reveal className="mt-12">
          <div
            ref={ref}
            className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/10 sm:aspect-[16/8]"
            aria-label={t('hint')}
          >
            {!reduced ? <CapabilityScene active={active} /> : null}
            <div className="hero-fallback absolute inset-0 -z-10" aria-hidden="true" />
            <div className="pointer-events-none absolute bottom-4 start-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
              <MousePointer2 className="size-3.5" aria-hidden="true" />
              {t('hint')}
            </div>
            {reduced ? (
              <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
                {t('fallback')}
              </p>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
