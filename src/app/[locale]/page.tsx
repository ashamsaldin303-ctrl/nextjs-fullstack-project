import { Hero } from '@/components/home/hero'
import { TrustBar } from '@/components/home/trust-bar'
import { ServicesBento } from '@/components/home/bento'
import { SimulatorLazy } from '@/components/home/simulator-lazy'
import { FeaturedWork } from '@/components/home/featured-work'
import { MethodologyLazy } from '@/components/home/methodology-lazy'
import { Testimonials } from '@/components/home/testimonials'
import { CalculatorLazy } from '@/components/home/calculator-lazy'
import { HomeJsonLd } from '@/components/seo/home-json-ld'

export default function HomePage() {
  return (
    <>
      <HomeJsonLd />
      <Hero />
      <TrustBar />
      <ServicesBento />
      {/* Hotfix H-4: simulator loads/hydrates only near the viewport —
          cuts homepage TBT (was 690ms prod) without touching LCP. */}
      <SimulatorLazy />
      <FeaturedWork />
      {/* Phase 5 WS-8: Methodology + Calculator lazy-loaded too — both
          use framer-motion, both sit well below the fold. Deferring
          their chunks cuts the initial JS bundle on / by ~30KB
          minified+gzipped (framer-motion + AnimatePresence + motion
          runtime) without losing any functionality. */}
      <MethodologyLazy />
      <Testimonials />
      <CalculatorLazy />
    </>
  )
}
