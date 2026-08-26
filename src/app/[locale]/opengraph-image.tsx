import { ImageResponse } from 'next/og'

export const alt =
  'Elyra — Stunning Websites & n8n Automation Systems'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Shared OG/Twitter card for every page under [locale] (file-convention
 * bubbling: pages without their own opengraph-image inherit this one).
 * Mirrors the icon.tsx E-mark + quad-dot brand language on the dark
 * hero surface (#0F172A + primary glow).
 *
 * FONT DECISION: text is English-only on purpose. ImageResponse's default
 * font has no Arabic glyphs (renders tofu), and the repo ships no font
 * files (both Inter and Cairo load via next/font/google at build time).
 * When an Arabic-capable font file lands in the repo, load it via
 * fs/promises + `fonts: [{ name, data, style: 'normal' }]` and switch the
 * copy to the per-locale tagline. A clean English card beats tofu boxes.
 */
export default function OpengraphImage() {
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
          background: '#0F172A',
        }}
      >
        {/* Primary glow — same radial treatment as the page heroes */}
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
              color: '#0F172A',
              marginLeft: -8,
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
              background: '#4285F4',
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
              background: '#EA4335',
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
              background: '#FBBC05',
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
              background: '#34A853',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 48,
            fontSize: 120,
            fontWeight: 800,
            letterSpacing: 20,
            color: '#F1F5F9',
          }}
        >
          ELYRA
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 20,
            fontSize: 38,
            color: '#A3AEC2',
          }}
        >
          Stunning Websites · n8n Automation · Digital Studio
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
              background: '#4285F4',
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#EA4335',
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#FBBC05',
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#34A853',
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  )
}
