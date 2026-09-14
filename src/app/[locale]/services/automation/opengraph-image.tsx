import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/brand-colors'
import { RouteOgCard, cairoFontPromise, ogContentType, ogFonts, ogSize } from '@/components/og/route-card'

/** F-S10-04 (audit r2): route-specific OG card for the automation service.
 * Motif: an n8n-style node flow — three nodes wired left-to-right (the
 * flow direction reads the same in both card directions; purely
 * decorative glyph, not copy). */
export const alt = 'إيليرا — الأتمتة بأنظمة n8n | Elyra — n8n Automation Systems'
export const size = ogSize
export const contentType = ogContentType

const COPY = {
  ar: {
    title: 'أنظمة الأتمتة',
    subtitle: 'تدفقات عمل n8n تُنجز العمل عنك — بدقة وبدون تعب',
    dir: 'rtl' as const,
  },
  en: {
    title: 'Automation Systems',
    subtitle: 'n8n workflows that do the work for you — precisely, tirelessly',
    dir: 'ltr' as const,
  },
}

function FlowNode({ color }: { color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 96,
        height: 96,
        borderRadius: 26,
        borderWidth: 2,
        borderColor: color,
        background: 'rgba(241, 245, 249, 0.06)',
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: color,
        }}
      />
    </div>
  )
}

const WIRE = (color: string) => (
  <div style={{ width: 56, height: 3, borderRadius: 2, background: color, opacity: 0.7 }} />
)

export default async function AutomationOgImage({ params }: { params: Promise<{ locale?: string }> }) {
  const { locale } = await params
  const copy = locale === 'en' ? COPY.en : COPY.ar
  return new ImageResponse(
    <RouteOgCard
      copy={copy}
      motif={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FlowNode color={BRAND.gBlue} />
          {WIRE(BRAND.gBlue)}
          <FlowNode color={BRAND.primary} />
          {WIRE(BRAND.gGreen)}
          <FlowNode color={BRAND.gGreen} />
        </div>
      }
    />,
    { ...size, fonts: ogFonts(await cairoFontPromise) }
  )
}
