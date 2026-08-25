'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Search, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { playSuccess } from '@/lib/sound'

const ConsoleScene = dynamic(
  () => import('./console-scene').then((m) => m.ConsoleScene),
  { ssr: false, loading: () => null }
)

type PresetId = 'store' | 'booking' | 'ai' | 'dashboard' | 'custom'

const PRESETS: { id: PresetId; key: string }[] = [
  { id: 'store', key: 'presets.store' },
  { id: 'booking', key: 'presets.booking' },
  { id: 'ai', key: 'presets.ai' },
  { id: 'dashboard', key: 'presets.dashboard' },
]

/**
 * Hero interactive console (Phase 4 WS-1, prompt §4).
 *
 * Transforms the hero from an ad into an experience: the visitor picks a
 * preset (or types a keyword) and a WebGL scene assembles the system's
 * architecture before their eyes.
 *
 * LCP protection: the command bar (input + chips) is pure HTML/CSS — it
 * renders instantly from the server. The R3F scene mounts ONLY after the
 * user selects a preset or presses Enter (dynamic import ssr:false).
 *
 * Mobile (<768px): WebGL is forbidden (§9.3) — an SVG node diagram replaces
 * the scene. Reduced-motion: static SVG diagram + text description.
 */
export function HeroConsole() {
  const t = useTranslations('hero.console')
  const reduced = usePrefersReducedMotion()
  const [selected, setSelected] = useState<PresetId | null>(null)
  const [input, setInput] = useState('')
  const [mounted, setMounted] = useState(false)

  const select = useCallback((id: PresetId) => {
    setSelected(id)
    setMounted(true)
    playSuccess() // WS-1 §4: "takeoff" sound via existing system
  }, [])

  const on_submit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    // Free text that doesn't match a preset → "custom" scene
    setSelected('custom')
    setMounted(true)
    playSuccess()
  }, [input])

  // Detect mobile for SVG fallback (no WebGL on touch — §9.3)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const showSvg = mounted && (isMobile || reduced || !('WebGLRenderingContext' in window))

  return (
    <div className="hero-enter hero-enter-2 mt-8 w-full max-w-2xl">
      {/* Command bar — instant HTML/CSS, protects LCP */}
      <form onSubmit={on_submit} className="group relative">
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur-md transition-colors focus-within:border-primary/50">
          <Search className="size-5 shrink-0 text-white/50" aria-hidden="true" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('placeholder')}
            className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
            aria-label={t('placeholder')}
          />
          <span className="hidden shrink-0 text-xs text-white/40 sm:inline">
            {t('enterHint')}
          </span>
        </div>
      </form>

      {/* Preset chips */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {PRESETS.map(({ id, key }) => (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            data-cursor="magnet"
            aria-pressed={selected === id}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
              selected === id
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t(key)}
          </button>
        ))}
      </div>

      {/* Scene layer — mounts ONLY after interaction */}
      {mounted && selected ? (
        <div className="relative mt-6 min-h-[280px] overflow-hidden rounded-2xl border border-white/10 bg-elyra-deep">
          {showSvg ? (
            <ConsoleSvgDiagram preset={selected} reduced={reduced} labels={{
              store: t('presets.store'),
              booking: t('presets.booking'),
              ai: t('presets.ai'),
              dashboard: t('presets.dashboard'),
              custom: t('custom'),
            }} customDesc={t('customDesc')} />
          ) : (
            <>
              <ConsoleScene preset={selected} />
              <div
                className="pointer-events-none absolute bottom-3 start-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm"
                data-cursor="rotate"
                data-cursor-label={t('placeholder')}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                {selected === 'custom' ? t('custom') : t(`presets.${selected}` as 'presets.store' | 'presets.booking' | 'presets.ai' | 'presets.dashboard')}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* --- Mobile / reduced-motion SVG node diagram --- */
function ConsoleSvgDiagram({
  preset,
  reduced,
  labels,
  customDesc,
}: {
  preset: PresetId
  reduced: boolean
  labels: Record<string, string>
  customDesc: string
}) {
  const nodes = preset === 'custom' ? 5 : 6
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-6">
      <svg viewBox="0 0 300 200" className="w-full max-w-sm" aria-hidden="true">
        {Array.from({ length: nodes }).map((_, i) => {
          const angle = (i / nodes) * Math.PI * 2
          const x = 150 + Math.cos(angle) * 70
          const y = 100 + Math.sin(angle) * 50
          return (
            <g key={i}>
              {i < nodes - 1 ? (
                <line
                  x1={x}
                  y1={y}
                  x2={150 + Math.cos(((i + 1) / nodes) * Math.PI * 2) * 70}
                  y2={100 + Math.sin(((i + 1) / nodes) * Math.PI * 2) * 50}
                  stroke="rgba(0,113,227,0.3)"
                  strokeWidth="1.5"
                />
              ) : null}
              <circle
                cx={x}
                cy={y}
                r="12"
                fill="rgba(0,113,227,0.15)"
                stroke="rgba(0,113,227,0.6)"
                strokeWidth="1.5"
              >
                {!reduced ? (
                  <animate
                    attributeName="r"
                    values="10;14;10"
                    dur="2s"
                    begin={`${i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                ) : null}
              </circle>
            </g>
          )
        })}
        {/* Center node */}
        <circle cx="150" cy="100" r="16" fill="rgba(52,168,83,0.2)" stroke="rgba(52,168,83,0.7)" strokeWidth="2" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-semibold text-white">
          {labels[preset] ?? labels.custom}
        </p>
        {preset === 'custom' ? (
          <p className="mt-1 text-xs text-white/60">{customDesc}</p>
        ) : null}
      </div>
    </div>
  )
}
