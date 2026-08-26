'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Globe, Workflow, Boxes, Bot, Sparkles,
  Check, Play, RotateCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHeading } from '@/components/shared/section-heading'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/** Bento card with cursor-following radial glow (works in RTL & LTR). */
function GlowCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // FIX(2-c/4): rAF-coalesced — the rect read + --mx/--my writes happen
  // ONCE per frame using the latest event, not once per pointermove.
  // With no new events the callback never reschedules (idle at zero cost).
  const latestPointer = useRef<React.PointerEvent<HTMLDivElement> | null>(null)
  const glowRaf = useRef(0)
  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    latestPointer.current = e
    if (glowRaf.current) return
    glowRaf.current = requestAnimationFrame(() => {
      glowRaf.current = 0
      const el = ref.current
      const ev = latestPointer.current
      if (!el || !ev) return
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${ev.clientX - rect.left}px`)
      el.style.setProperty('--my', `${ev.clientY - rect.top}px`)
    })
  }, [])
  useEffect(
    () => () => {
      if (glowRaf.current) cancelAnimationFrame(glowRaf.current)
    },
    []
  )

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={cn(
        'glow-cursor group relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8',
        className
      )}
    >
      {children}
    </div>
  )
}

/* ---------- Mini interactive: websites color switcher ---------- */
const SITE_PALETTE = ['#0071E3', '#34A853', '#EA4335', '#FBBC05'] as const
function MiniSite() {
  const t = useTranslations('bento.websites.mini')
  const [accent, setAccent] = useState<string>(SITE_PALETTE[0] ?? '#0071E3')
  return (
    <div className="mt-6">
      <p className="text-xs text-muted-foreground">{t('title')}</p>
      <p className="mt-1 text-[11px] text-muted-foreground/70">{t('hint')}</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-elyra-dark/95 p-3 text-elyra-on-dark">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-g-red/80" />
          <span className="size-2 rounded-full bg-g-yellow/80" />
          <span className="size-2 rounded-full bg-g-green/80" />
        </div>
        <div className="mt-3 h-1.5 w-12 rounded-full" style={{ background: accent }} />
        <div className="mt-2 space-y-1.5">
          <div className="h-1.5 w-3/4 rounded-full bg-white/15" />
          <div className="h-1.5 w-1/2 rounded-full bg-white/10" />
        </div>
        <div className="mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-white"
          style={{ background: accent }}
        >
          <Check className="size-2.5" aria-hidden="true" />
          <span className="text-[9px]">CTA</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SITE_PALETTE.map((c) => (
          // FIX(2-c/12): swatches are a decorative pointer toy — raw hex
          // aria-labels announce noise, so they are hidden from the a11y
          // tree and removed from tab order (selection still shows its
          // ring visually).
          <button
            key={c}
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setAccent(c)}
            className={cn(
              'size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              accent === c && 'ring-2 ring-ring ring-offset-2'
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}

/* ---------- Mini interactive: automation pulse ---------- */
function MiniFlow() {
  const t = useTranslations('bento.automation.mini')
  const reduced = usePrefersReducedMotion()
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')
  // FIX(2-c/5): keep the completion timeout cancellable — cleared before
  // re-arming and on unmount so a late `done` can never fire on a dead card.
  const timer = useRef(0)
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )

  const run = () => {
    if (state === 'running') return
    if (timer.current) window.clearTimeout(timer.current)
    setState('running')
    const total = reduced ? 1200 : 2100
    timer.current = window.setTimeout(() => {
      timer.current = 0
      setState('done')
    }, total)
  }

  return (
    <div className="mt-6">
      <p className="text-xs text-muted-foreground">{t('title')}</p>
      <p className="mt-1 text-[11px] text-muted-foreground/70">{t('hint')}</p>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-elyra-dark/95 p-4 text-elyra-on-dark">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'size-7 rounded-full border transition-colors',
                state === 'running'
                  ? 'border-primary/60 bg-primary/30'
                  : state === 'done'
                    ? 'border-g-green/60 bg-g-green/30'
                    : 'border-white/15 bg-white/5'
              )}
            >
              {/* Pulse via pure CSS (.elyra-pulse) — Phase 3 §4.3 */}
              <span
                className={cn(
                  'block size-full rounded-full',
                  state === 'running' && !reduced && 'elyra-pulse'
                )}
                style={state === 'running' && reduced ? { boxShadow: '0 0 0 4px rgba(0,113,227,0.35)' } : undefined}
              />
            </div>
            {i < 2 ? (
              <div className="relative h-px flex-1 bg-white/10">
                <span
                  className={cn(
                    'absolute inset-0 bg-primary transition-transform duration-500 ease-in-out',
                    state === 'running' ? 'scale-x-100' : 'scale-x-0'
                  )}
                  style={{
                    transformOrigin: 'start',
                    transitionDelay: `${i * 0.3 + 0.15}s`,
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        data-cursor="magnet"
        onClick={run}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {state === 'done' ? <RotateCw className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
        {state === 'done' ? t('done') : t('title')}
      </button>
    </div>
  )
}

/* ---------- Mini interactive: 3D draggable cube (CSS 3D) ---------- */
function MiniCube() {
  const t = useTranslations('bento.threeD.mini')
  // Reduced motion: skip the CSS easing between drag rotations — the cube
  // still rotates (user-driven, not autonomous) but with no transition.
  const reduced = usePrefersReducedMotion()
  const [rot, setRot] = useState({ x: -18, y: 28 })
  const [dragging, setDragging] = useState(false)
  const start = useRef({ x: 0, y: 0, rx: 0, ry: 0 })

  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y }
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    setRot({ x: start.current.rx - dy * 0.5, y: start.current.ry + dx * 0.5 })
  }
  const onUp = () => { setDragging(false) }

  const faces = [
    { tr: 'translateZ(28px)', bg: 'rgba(0,113,227,0.85)' },
    { tr: 'rotateY(180deg) translateZ(28px)', bg: 'rgba(66,133,244,0.85)' },
    { tr: 'rotateY(90deg) translateZ(28px)', bg: 'rgba(52,168,83,0.85)' },
    { tr: 'rotateY(-90deg) translateZ(28px)', bg: 'rgba(234,67,53,0.85)' },
    { tr: 'rotateX(90deg) translateZ(28px)', bg: 'rgba(251,188,5,0.85)' },
    { tr: 'rotateX(-90deg) translateZ(28px)', bg: 'rgba(241,245,249,0.85)' },
  ]

  return (
    <div className="mt-6">
      <p className="text-[11px] text-muted-foreground/70">{t('hint')}</p>
      <div
        className="mt-3 flex h-32 items-center justify-center rounded-xl border border-border bg-elyra-dark/95 touch-none select-none"
        style={{ perspective: '600px' }}
      >
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="size-14 cursor-grab touch-none active:cursor-grabbing"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
            transition: dragging || reduced ? 'none' : 'transform 0.2s ease-out',
          }}
          role="img"
          aria-label={t('hint')}
        >
          {faces.map((f, i) => (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white"
              style={{ transform: f.tr, background: f.bg, backfaceVisibility: 'hidden' }}
            >
              E
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- Mini interactive: AI prompt-response ---------- */
function MiniAgent() {
  const t = useTranslations('bento.ai.mini')
  // Typewriter is a JS-driven (setInterval) animation — the global CSS
  // reduced-motion override can't stop it, so we honor the hook directly:
  // reduced-motion users get the full response instantly (audit P1-6).
  const reduced = usePrefersReducedMotion()
  const [typed, setTyped] = useState(false)
  const [chars, setChars] = useState(0)
  const response = t('response')
  // FIX(2-c/5): hold the typewriter interval in a ref — cleared on reset
  // (prevents a second interval racing the first when re-triggered
  // mid-type) and on unmount.
  const typer = useRef(0)
  useEffect(
    () => () => {
      if (typer.current) window.clearInterval(typer.current)
    },
    []
  )

  const ask = () => {
    if (typed) {
      if (typer.current) {
        window.clearInterval(typer.current)
        typer.current = 0
      }
      setTyped(false)
      setChars(0)
      return
    }
    setTyped(true)
    if (reduced) {
      setChars(response.length)
      return
    }
    if (typer.current) window.clearInterval(typer.current)
    let i = 0
    typer.current = window.setInterval(() => {
      i += 2
      setChars(i)
      if (i >= response.length) {
        window.clearInterval(typer.current)
        typer.current = 0
      }
    }, 25)
  }

  return (
    <div className="mt-6">
      <p className="text-[11px] text-muted-foreground/70">{t('hint')}</p>
      <div className="mt-3 space-y-2 rounded-xl border border-border bg-elyra-dark/95 p-3 text-elyra-on-dark">
        <button
          type="button"
          data-cursor="magnet"
          onClick={ask}
          className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-start text-xs text-white/80 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bot className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{t('prompt')}</span>
        </button>
        {typed ? (
          <div className="flex items-start gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-xs text-white/90">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-g-yellow" aria-hidden="true" />
            <span>{response.slice(0, chars)}{reduced ? null : <span className="animate-pulse">▌</span>}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ---------- Mini interactive: orbiting integration initials ---------- */
// Orbit positions are static, so they're computed once at module scope.
// Offsets are pre-combined and rounded to 4 decimals and formatted to match
// the CSSOM canonical calc() form exactly — React 19's dev-mode hydration
// diff reads normalized CSSOM style values, so raw strings like
// `calc(50% + -24.00000000000002px - 14px)` would falsely "mismatch" against
// the browser-simplified `calc(50% - 38px)`.
const ORBIT_ITEMS = ['CRM', 'n8n', 'AI', 'SH', 'TG', '@'].map((label, i, arr) => {
  const angle = (i / arr.length) * Math.PI * 2
  const radius = 48
  const x = Math.round((Math.cos(angle) * radius - 14) * 1e4) / 1e4
  const y = Math.round((Math.sin(angle) * radius - 14) * 1e4) / 1e4
  return {
    label,
    left: `calc(50% ${x >= 0 ? `+ ${x}` : `- ${Math.abs(x)}`}px)`,
    top: `calc(50% ${y >= 0 ? `+ ${y}` : `- ${Math.abs(y)}`}px)`,
  }
})

function MiniOrbit() {
  const t = useTranslations('bento.integrations.mini')
  return (
    <div className="mt-6">
      <p className="text-[11px] text-muted-foreground/70">{t('hint')}</p>
      <div className="relative mt-3 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-border bg-elyra-dark/95">
        <div className="absolute size-2.5 rounded-full bg-primary" />
        <div
          className="absolute inset-0"
          style={{ animation: 'elyra-orbit 14s linear infinite' }}
        >
          {ORBIT_ITEMS.map((item) => (
            <span
              key={item.label}
              className="absolute flex size-7 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[9px] font-bold text-white"
              style={{ left: item.left, top: item.top }}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes elyra-orbit { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

/* ---------- Bento section ---------- */
export function ServicesBento() {
  const t = useTranslations('bento')

  return (
    <section className="bg-background py-20 sm:py-28" aria-labelledby="bento-title">
      <div className="elyra-container max-w-container">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          titleId="bento-title"
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
          {/* Big websites card — FIX(2-c/12): the icon eyebrow used to repeat
              the identical i18n string as the h3 below (catalog has no distinct
              per-card kicker key) — icon-only row preserves the rhythm. */}
          <GlowCard className="lg:col-span-2 lg:row-span-2">
            <div className="flex items-center gap-2 text-primary">
              <Globe className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('websites.title')}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
              {t('websites.desc')}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {(t.raw('websites.features') as string[]).map((f) => (
                <li
                  key={f}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-foreground/80"
                >
                  <Check className="size-3 text-g-green" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <MiniSite />
          </GlowCard>

          {/* Automation */}
          <GlowCard>
            <div className="flex items-center gap-2 text-primary">
              <Workflow className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              {t('automation.title')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('automation.desc')}
            </p>
            <MiniFlow />
          </GlowCard>

          {/* 3D */}
          <GlowCard>
            <div className="flex items-center gap-2 text-primary">
              <Boxes className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              {t('threeD.title')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('threeD.desc')}
            </p>
            <MiniCube />
          </GlowCard>

          {/* AI — wide */}
          <GlowCard className="lg:col-span-2">
            <div className="flex items-center gap-2 text-primary">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
              <div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                  {t('ai.title')}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('ai.desc')}
                </p>
              </div>
              <MiniAgent />
            </div>
          </GlowCard>

          {/* Integrations */}
          <GlowCard className="lg:col-span-1">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              {t('integrations.title')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('integrations.desc')}
            </p>
            <MiniOrbit />
          </GlowCard>
        </div>
      </div>
    </section>
  )
}
