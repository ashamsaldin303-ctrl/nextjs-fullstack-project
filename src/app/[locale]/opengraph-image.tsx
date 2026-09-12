import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { OG_IMAGE_ALT } from '@/lib/site-config'
import { BRAND } from '@/lib/brand-colors'

// Single source of truth (site-config.ts) — seo.ts, [locale]/layout.tsx and
// [locale]/page.tsx already use OG_IMAGE_ALT; the file-convention export
// must not carry its own divergent copy (L3 audit).
export const alt = OG_IMAGE_ALT
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Shared OG/Twitter card for every page under [locale] (file-convention
 * bubbling: pages without their own opengraph-image inherit this one).
 * Mirrors the icon.tsx E-mark + quad-dot brand language (blue/green/
 * red/yellow — Google-family palette; primary #0071E3, accent #4285F4)
 * on the dark hero surface (#0F172A + brand-blue glow). Brand hexes
 * import from the single owner src/lib/brand-colors.ts (W3-03);
 * #F1F5F9 / #A3AEC2 stay local (on-dark ink / muted — deliberately not
 * paper) and the rgba(0,113,227) glow stays an rgba literal (BRAND
 * exports hex strings only — zero-change rule).
 *
 * F-S10-03 (gold-standard audit): the card is now BILINGUAL. The full
 * Cairo variable-weight TTF ships in public/fonts/ (SIL OFL — one file,
 * Arabic + Latin coverage) and is loaded via fs/promises + the
 * ImageResponse `fonts` option, so the Arabic card renders shaped Arabic
 * glyphs (the default satori font has none — the old card was English-
 * only on purpose to avoid tofu). One family covers both scripts.
 *
 * Read-once module cache: the OG route re-renders per request/params, the
 * font buffer must not hit the disk on every render.
 */
const CAIRO_FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'cairo-800.ttf')

const cairoFontPromise = readFile(CAIRO_FONT_PATH)

/** Per-locale copy — mirrors the meta catalog's tagline (messages/*.json). */
const COPY = {
  ar: {
    wordmark: 'إيليرا',
    tagline: 'حيث تُولَد التجارب الرقمية الاستثنائية',
    subline: 'موقعات فائقة الجمال · أتمتة n8n · استوديو رقمي',
    dir: 'rtl' as const,
  },
  en: {
    wordmark: 'ELYRA',
    tagline: 'Where exceptional digital experiences are born',
    subline: 'Stunning Websites · n8n Automation · Digital Studio',
    dir: 'ltr' as const,
  },
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale?: string }>
}) {
  const { locale } = await params
  const copy = locale === 'en' ? COPY.en : COPY.ar

  const cairoFont = await cairoFontPromise

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: BRAND.dark,
          direction: copy.dir,
        }}
      >
        {/* Primary glow — same radial treatment as the page heroes
            (brand blue #0071E3) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle 700px at 50% 0%, rgba(0, 113, 227, 0.35), rgba(15, 23, 42, 0) 100%)',
          }}
        />

        {/* E mark — the icon.tsx motif scaled up (E + quad dot) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 128,
            height: 128,
            borderRadius: 36,
            background: '#F1F5F9',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 96,
              fontWeight: 800,
              color: BRAND.dark,
              marginLeft: -8,
              fontFamily: 'Cairo',
            }}
          >
            E
          </div>
          <div
            style={{
              position: 'absolute',
              right: 18,
              top: 34,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: BRAND.gBlue,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 36,
              top: 66,
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: BRAND.gRed,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 18,
              top: 70,
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: BRAND.gYellow,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 36,
              top: 16,
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: BRAND.gGreen,
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 48,
            fontSize: copy.dir === 'rtl' ? 110 : 120,
            fontWeight: 800,
            letterSpacing: copy.dir === 'rtl' ? 0 : 20,
            color: '#F1F5F9',
            fontFamily: 'Cairo',
          }}
        >
          {copy.wordmark}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 20,
            fontSize: 38,
            color: '#A3AEC2',
            fontFamily: 'Cairo',
          }}
        >
          {copy.tagline}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 12,
            fontSize: 30,
            color: '#A3AEC2',
            fontFamily: 'Cairo',
          }}
        >
          {copy.subline}
        </div>

        {/* Brand quad-dot baseline accent */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 44,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: BRAND.gBlue,
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: BRAND.gRed,
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: BRAND.gYellow,
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: BRAND.gGreen,
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Cairo', data: cairoFont, style: 'normal', weight: 800 },
      ],
    }
  )
}
