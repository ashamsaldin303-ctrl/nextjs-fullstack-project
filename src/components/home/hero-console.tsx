'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Search, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from '@/i18n/navigation'
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

/* ------------------------------------------------------------------ */
/* Batch 2 item 6 — hero intent → contact conversion                    */
/* ------------------------------------------------------------------ */

/** Preset id → `service` value of the /contact prefill URL contract
 *  (store|booking|agent|dashboard|automation|websites). The hero preset
 *  `ai` maps to the contract's `agent`. */
const SERVICE_PARAM: Record<Exclude<PresetId, 'custom'>, string> = {
  store: 'store',
  booking: 'booking',
  ai: 'agent',
  dashboard: 'dashboard',
}

/** Lightweight keyword best-guess for free-text submissions (bilingual,
 *  substring match, first hit wins — a miss simply omits `service`). */
const KEYWORD_HINTS: { preset: Exclude<PresetId, 'custom'>; words: string[] }[] = [
  { preset: 'store', words: ['متجر', 'تجار', 'منتج', 'shop', 'store', 'ecommerce'] },
  { preset: 'booking', words: ['حجز', 'حجوزات', 'مواعيد', 'booking', 'reserv'] },
  { preset: 'ai', words: ['ذكاء', 'وكيل', 'بوت', 'شات', 'agent', 'chatbot', 'assistant'] },
  { preset: 'dashboard', words: ['لوحة', 'تحليل', 'تقارير', 'dashboard', 'analytics'] },
]

function guessPreset(text: string): Exclude<PresetId, 'custom'> | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  for (const { preset, words } of KEYWORD_HINTS) {
    if (words.some((w) => t.includes(w))) return preset
  }
  return null
}

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
export function HeroConsole({
  /** FIX(2-c/2): while false (hero offscreen / tab hidden) the WebGL
   *  scene pauses its frameloop instead of rendering at 60fps forever. */
  active = true,
}: {
  active?: boolean
}) {
  const t = useTranslations('hero.console')
  const router = useRouter()
  const reduced = usePrefersReducedMotion()
  const [selected, setSelected] = useState<PresetId | null>(null)
  const [input, setInput] = useState('')
  const [mounted, setMounted] = useState(false)

  // Batch 2 item 6: the pending navigation timer (scene payoff beat).
  // Tracked in a ref so it is cancelled if the component unmounts first
  // (e.g. the user scrolls on before the beat ends) and so a second
  // submit while one is already scheduled can never double-push.
  const navTimer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      if (navTimer.current) window.clearTimeout(navTimer.current)
    },
    []
  )

  /** Hands the visitor's intent to the contact form — AFTER a short beat
   *  so the console scene still mounts and their words materialize (the
   *  scene is the payoff; the form is the destination). The scene mounts
   *  ONLY on submit, so navigating immediately would make it unreachable
   *  dead code. router comes from @/i18n/navigation → the locale prefix
   *  is correct (ar default: /contact, en: /en/contact). */
  const goToContact = useCallback(
    (service: string | null, idea: string) => {
      if (navTimer.current) return // first intent wins
      const params = new URLSearchParams()
      if (service) params.set('service', service)
      if (idea) params.set('idea', idea)
      const qs = params.toString()
      navTimer.current = window.setTimeout(
        () => {
          navTimer.current = undefined // allow a later intent (e.g. via Back)
          router.push(qs ? `/contact?${qs}` : '/contact')
        },
        // Reduced-motion visitors opted out of the show — near-immediate.
        reduced ? 250 : 800
      )
    },
    [router, reduced]
  )

  // FIX(2-c/5): track the one-shot scroll rAF so it can be cancelled on
  // unmount (a pending rAF firing after unmount is harmless, but leaving
  // it scheduled is a leak under rapid mount/unmount).
  const scrollRaf = useRef(0)
  useEffect(
    () => () => {
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current)
    },
    []
  )

  // Shared helper for both entry paths (preset chip + free-text submit):
  // after mounting the scene, scroll it into view if it landed offscreen.
  const scrollSceneIntoView = useCallback(() => {
    if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current)
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      const container = document.getElementById('hero-console-scene')
      if (container) {
        const rect = container.getBoundingClientRect()
        const inView = rect.top >= 0 && rect.top < window.innerHeight * 0.7
        if (!inView) {
          container.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    })
  }, [])

  const select = useCallback(
    (id: PresetId) => {
      setSelected(id)
      setMounted(true)
      playSuccess() // WS-1 §4: "takeoff" sound via existing system
      // Phase 5 P0-1 fix: ensure the dark scene container is visible —
      // the hero is min-h-[100svh], so the console mounts below the fold
      // on standard screens. Without this scroll, users click a preset
      // but never see the WebGL scene (the original P0-1 symptom).
      scrollSceneIntoView()
      // Batch 2 item 6: chip intent now continues into the contact form
      // (service from the chip; idea from anything typed in the prompt —
      // combining both is the natural behavior when a visitor types a
      // keyword then confirms with a chip instead of pressing Enter).
      goToContact(id === 'custom' ? null : SERVICE_PARAM[id], input.trim())
    },
    [scrollSceneIntoView, goToContact, input]
  )

  const on_submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const idea = input.trim()
      if (!idea) return
      // Free text: best-guess a preset by keyword (scene + service param
      // follow the guess); a miss → "custom" scene and no service param.
      const preset = guessPreset(idea)
      setSelected(preset ?? 'custom')
      setMounted(true)
      playSuccess()
      scrollSceneIntoView()
      goToContact(preset ? SERVICE_PARAM[preset] : null, idea)
    },
    [input, scrollSceneIntoView, goToContact]
  )

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
    <div className="hero-enter hero-enter-5 mt-8 w-full">
      {/* Command bar — instant HTML/CSS, protects LCP */}
      <form onSubmit={on_submit} className="group relative">
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur-md transition-colors focus-within:border-primary/50">
          <Search className="size-5 shrink-0 text-white/50" aria-hidden="true" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('placeholder')}
            className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/60 focus:outline-none"
            aria-label={t('placeholder')}
          />
          {/* MED-1: enterHint was white/40 (≈3.6:1 on the dark hero) —
              white/60 keeps the hint secondary but AA-compliant. */}
          <span className="hidden shrink-0 text-xs text-white/60 sm:inline">
            {t('enterHint')}
          </span>
        </div>
      </form>

      {/* Preset chips */}
      <div className="mt-3 flex flex-wrap justify-start gap-2">
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
                /* MED-2: the brand blue accent carried by the legacy g-blue
                   token (#4285F4) on the g-blue/15 tint over #08080A
                   measures ≈5.0:1 — AA for the 14px label. */
                ? 'border-g-blue bg-g-blue/15 text-g-blue'
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
        <div
          id="hero-console-scene"
          className="relative mt-6 min-h-[280px] overflow-hidden rounded-2xl border border-white/10 bg-elyra-deep"
        >
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
              <ConsoleScene preset={selected} active={active} />
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
                  stroke="rgba(217,119,6,0.3)"
                  strokeWidth="1.5"
                />
              ) : null}
              <circle
                cx={x}
                cy={y}
                r="12"
                fill="rgba(217,119,6,0.15)"
                stroke="rgba(217,119,6,0.6)"
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
