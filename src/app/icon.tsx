import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png' as const

/**
 * Elyra favicon — the distinctive E mark with a 4-color quad dot
 * on a dark rounded square. Rendered via ImageResponse on the Node
 * runtime (edge-runtime metadata routes 404 under Turbopack dev).
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
          background: '#0F172A',
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
            background: '#4285F4',
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
            background: '#DC2626',
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
            background: '#60A5FA',
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
            background: '#34A853',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
