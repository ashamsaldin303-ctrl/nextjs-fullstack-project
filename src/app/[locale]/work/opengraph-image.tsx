import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/brand-colors'
import { RouteOgCard, cairoFontPromise, ogContentType, ogFonts, ogSize } from '@/components/og/route-card'

/** F-S10-04 (audit r2): route-specific OG card — deep /work shares are no
 * longer indistinguishable from the homepage card. Motif: the three-card
 * work montage (the WorkGrid rhythm) in the brand quads. */
export const alt = 'إيليرا — أعمالنا: معرض المشاريع | Elyra — Our Work: project gallery'
export const size = ogSize
export const contentType = ogContentType

const COPY = {
  ar: { title: 'أعمالنا', subtitle: 'معرض المشاريع — قبل وبعد، بجميع التفاصيل', dir: 'rtl' as const },
  en: { title: 'Our Work', subtitle: 'The project gallery — before & after, in full detail', dir: 'ltr' as const },
}

export default async function WorkOgImage({ params }: { params: Promise<{ locale?: string }> }) {
  const { locale } = await params
  const copy = locale === 'en' ? COPY.en : COPY.ar
  const card = (color: string, w: number) => (
    <div
      style={{
        width: w,
        height: 118,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: color,
        background: 'rgba(241, 245, 249, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        gap: 10,
      }}
    >
      <div style={{ width: '55%', height: 12, borderRadius: 6, background: color, opacity: 0.9 }} />
      <div style={{ width: '82%', height: 8, borderRadius: 4, background: '#A3AEC2', opacity: 0.5 }} />
      <div style={{ width: '68%', height: 8, borderRadius: 4, background: '#A3AEC2', opacity: 0.35 }} />
    </div>
  )
  return new ImageResponse(
    <RouteOgCard
      copy={copy}
      motif={
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {card(BRAND.gBlue, 168)}
          {card(BRAND.gRed, 148)}
          {card(BRAND.gGreen, 168)}
        </div>
      }
    />,
    { ...size, fonts: ogFonts(await cairoFontPromise) }
  )
}
