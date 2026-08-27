import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png' as const

/**
 * Apple touch icon — the same E-mark + quad-dot motif as icon.tsx,
 * scaled 32→180 (×5.625, values rounded). Dark rounded square on the
 * Node runtime (edge-runtime metadata routes 404 under Turbopack dev).
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F172A',
          borderRadius: '28%',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 124,
            fontWeight: 800,
            color: '#F1F5F9',
            marginLeft: -11,
          }}
        >
          E
        </div>
        <div
          style={{
            position: 'absolute',
            right: 28,
            top: 51,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#F59E0B',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 56,
            top: 101,
            width: 17,
            height: 17,
            borderRadius: '50%',
            background: '#DC2626',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 28,
            top: 107,
            width: 17,
            height: 17,
            borderRadius: '50%',
            background: '#FBBF24',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 56,
            top: 28,
            width: 17,
            height: 17,
            borderRadius: '50%',
            background: '#34A853',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
