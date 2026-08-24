import { Hero } from '@/components/home/hero'
import { TrustBar } from '@/components/home/trust-bar'
import { ServicesBento } from '@/components/home/bento'
import { AutomationSimulator } from '@/components/home/automation-simulator'
import { FeaturedWork } from '@/components/home/featured-work'
import { Methodology } from '@/components/home/methodology'
import { Testimonials } from '@/components/home/testimonials'
import { Calculator } from '@/components/home/calculator'
import { HomeJsonLd } from '@/components/seo/home-json-ld'

export default function HomePage() {
  return (
    <>
      <HomeJsonLd />
      <Hero />
      <TrustBar />
      <ServicesBento />
      <AutomationSimulator />
      <FeaturedWork />
      <Methodology />
      <Testimonials />
      <Calculator />
    </>
  )
}
