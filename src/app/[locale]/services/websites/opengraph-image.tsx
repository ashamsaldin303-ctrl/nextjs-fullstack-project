import { ImageResponse } from 'next/og'
import { RouteOgCard, cairoFontPromise, ogContentType, ogFonts, ogSize } from '@/components/og/route-card'

/** F-S10-04 (audit r2): route-specific OG card for the websites service.
 * Motif: a browser window frame with a hero band + content grid — the
 * website-building promise in one glyph. */
export const alt = 'إيليرا — بناء المواقع | Elyra — Website Building'
export const size = ogSize
export const contentType = ogContentType

const COPY = {
  ar: {
    title: 'بناء المواقع',
    subtitle: 'مواقع فائقة الجمال — هوية، أداء، وتجربة تُذكر',
    dir: 'rtl' as const,
  },
  en: {
    title: 'Website Building',
    subtitle: 'Stunning websites — identity, performance, and a memorable experience',
    dir: 'ltr' as const,
  },
}

export default async function WebsitesOgImage({ params }: { params: Promise<{ locale?: string }> }) {
  const { locale } = await params
  const copy = locale === 'en' ? COPY.en : COPY.ar
  return new ImageResponse(
    <RouteOgCard
      copy={copy}
      motif={
        <div
          style={{
            width: 300,
            height: 190,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: 'rgba(241, 245, 249, 0.35)',
            background: 'rgba(241, 245, 249, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* browser chrome bar */}
          <div
            style={{
              height: 30,
              background: 'rgba(241, 245, 249, 0.1)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 14,
              gap: 8,
            }}
          >
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#EA4335' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FBBC05' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#34A853' }} />
            <div
              style={{
                marginLeft: 12,
                width: 110,
                height: 12,
                borderRadius: 6,
                background: 'rgba(241, 245, 249, 0.14)',
              }}
            />
          </div>
          {/* hero band */}
          <div
            style={{
              height: 58,
              margin: 12,
              borderRadius: 10,
              background: 'rgba(0, 113, 227, 0.45)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 14,
            }}
          >
            <div style={{ width: 90, height: 12, borderRadius: 6, background: 'rgba(241,245,249,0.85)' }} />
          </div>
          {/* content grid */}
          <div style={{ display: 'flex', gap: 10, margin: '0 12px 12px 12px', flex: 1 }}>
            <div style={{ flex: 1, borderRadius: 8, background: 'rgba(241, 245, 249, 0.1)' }} />
            <div style={{ flex: 1, borderRadius: 8, background: 'rgba(241, 245, 249, 0.07)' }} />
            <div style={{ flex: 1, borderRadius: 8, background: 'rgba(241, 245, 249, 0.1)' }} />
          </div>
        </div>
      }
    />,
    { ...size, fonts: ogFonts(await cairoFontPromise) }
  )
}
