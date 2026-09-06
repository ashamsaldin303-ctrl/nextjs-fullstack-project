import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/brand-colors'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png' as const

/**
 * Elyra favicon — the distinctive E mark with a 4-color quad dot
 * on a dark rounded square. Rendered via ImageResponse on the Node
 * runtime (edge-runtime metadata routes 404 under Turbopack dev).
 * Hexes import from the single owner src/lib/brand-colors.ts (W3-03);
 * #F1F5F9 stays local — it is --elyra-on-dark, deliberately NOT the
 * paper #F5F5F7, so BRAND must not absorb it (zero-change rule).
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND.dark,
          borderRadius: '28%',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            fontWeight: 800,
            color: '#F1F5F9',
            marginLeft: -2,
          }}
        >
          E
        </div>
        <div
          style={{
            position: 'absolute',
            right: 5,
            top: 9,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: BRAND.gBlue,
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 18,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: BRAND.gRed,
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 5,
            top: 19,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: BRAND.gYellow,
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 5,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: BRAND.gGreen,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
