import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { BRAND } from '@/lib/brand-colors'

/**
 * Shared OG card factory (F-S10-04, audit r2): route-specific
 * opengraph-image files reuse this scaffold — the dark hero surface +
 * brand-blue glow + the E-mark chip + wordmark row + quad-dot accent —
 * with a per-route TITLE/SUBTITLE and a small route MOTIF (plain satori
 * divs) in the middle. The Cairo font buffer is loaded once per process
 * (read-once module cache — the same discipline as the root card).
 */

export const ogSize = { width: 1200, height: 630 }
export const ogContentType = 'image/png'

const CAIRO_FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'cairo-800.ttf')

export const cairoFontPromise = readFile(CAIRO_FONT_PATH).then((buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)

export function ogFonts(data: ArrayBuffer) {
  return [{ name: 'Cairo', data, style: 'normal' as const, weight: 800 as const }]
}

export interface OgCopy {
  /** Route title + subtitle; AR/EN versions supplied by the route file. */
  title: string
  subtitle: string
  dir: 'rtl' | 'ltr'
}

/** Inks stay local (on-dark paper — deliberately not the light-surface
 * tokens), mirroring the root card's convention. */
const ON_DARK = '#F1F5F9'
const MUTED = '#A3AEC2'

export function RouteOgCard({ copy, motif }: { copy: OgCopy; motif: React.ReactNode }) {
  const rtl = copy.dir === 'rtl'
  return (
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
      {/* Primary glow — the page heroes' radial treatment (brand blue) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle 700px at 50% 0%, rgba(0, 113, 227, 0.35), rgba(15, 23, 42, 0) 100%)',
        }}
      />

      {/* Wordmark row — E-mark chip (icon.tsx motif) + ELYRA lockup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: 20,
            background: '#F1F5F9',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 52,
              fontWeight: 800,
              color: BRAND.dark,
              marginLeft: -5,
              fontFamily: 'Cairo',
            }}
          >
            E
          </div>
          <div
            style={{
              position: 'absolute',
              right: 10,
              top: 20,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: BRAND.gBlue,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 20,
              top: 38,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: BRAND.gRed,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 10,
              top: 40,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: BRAND.gYellow,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 20,
              top: 10,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: BRAND.gGreen,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: rtl ? 0 : 12,
            color: ON_DARK,
            fontFamily: 'Cairo',
          }}
        >
          {rtl ? 'إيليرا' : 'ELYRA'}
        </div>
      </div>

      {/* Route motif — supplied by the route file */}
      <div style={{ display: 'flex', marginTop: 44 }}>{motif}</div>

      {/* Route title */}
      <div
        style={{
          display: 'flex',
          marginTop: 40,
          fontSize: 64,
          fontWeight: 800,
          color: ON_DARK,
          fontFamily: 'Cairo',
        }}
      >
        {copy.title}
      </div>

      {/* Route subtitle */}
      <div
        style={{
          display: 'flex',
          marginTop: 16,
          fontSize: 32,
          color: MUTED,
          fontFamily: 'Cairo',
        }}
      >
        {copy.subtitle}
      </div>

      {/* Brand quad-dot baseline accent */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 40 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: BRAND.gBlue }} />
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: BRAND.gRed }} />
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: BRAND.gYellow }} />
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: BRAND.gGreen }} />
      </div>
    </div>
  )
}
