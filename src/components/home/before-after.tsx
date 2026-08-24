'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MoveHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsRtl } from '@/lib/use-rtl'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

type SceneVariant = 'site-old' | 'site-new' | 'dashboard-old' | 'dashboard-new'

function Scene({ variant, accent }: { variant: SceneVariant; accent: string }) {
  const isOld = variant.includes('old')
  const isDashboard = variant.includes('dashboard')

  if (isDashboard) {
    return (
      <div className={cn('size-full p-3', isOld ? 'bg-stone-100' : 'bg-elyra-dark')}>
        {/* dashboard rows */}
        <div className="flex items-center justify-between">
          <div className={cn('h-2 w-16 rounded-full', isOld ? 'bg-stone-400' : 'bg-white/30')} />
          <div className={cn('h-4 w-10 rounded-full', isOld ? 'bg-stone-300' : 'bg-white/15')} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'rounded-md p-2',
                isOld ? 'border border-stone-300 bg-white' : 'border border-white/10 bg-white/5'
              )}
            >
              <div className={cn('h-1.5 w-8 rounded-full', isOld ? 'bg-stone-300' : 'bg-white/20')} />
              <div
                className="mt-1 h-3 w-full rounded-full"
                style={{ background: isOld ? '#a8a29e' : accent }}
              />
            </div>
          ))}
        </div>
        {/* chart */}
        <div className="mt-3 flex h-16 items-end gap-1">
          {[5, 8, 4, 9, 6, 11, 7].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${(h / 11) * 100}%`,
                background: isOld ? '#a8a29e' : `linear-gradient(180deg, ${accent}, ${accent}66)`,
                opacity: isOld ? 0.5 : 0.85,
              }}
            />
          ))}
        </div>
        {isOld ? (
          <div className="mt-2 text-[8px] text-stone-500">sheet_v2_FINAL_really_final.xlsx</div>
        ) : (
          <div className="mt-2 h-1.5 w-20 rounded-full bg-white/20" />
        )}
      </div>
    )
  }

  // site scenes
  return (
    <div className={cn('size-full p-3', isOld ? 'bg-stone-200' : 'bg-gradient-to-br from-elyra-dark to-[#0a1120]')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className={cn('size-1.5 rounded-full', isOld ? 'bg-stone-400' : 'bg-white/40')} />
          <div className={cn('size-1.5 rounded-full', isOld ? 'bg-stone-400' : 'bg-white/40')} />
          <div className={cn('size-1.5 rounded-full', isOld ? 'bg-stone-400' : 'bg-white/40')} />
        </div>
        <div className={cn('h-1.5 w-8 rounded-full', isOld ? 'bg-stone-400' : 'bg-white/30')} />
      </div>
      {/* hero block */}
      <div
        className="mt-3 rounded-md p-2"
        style={{
          background: isOld ? '#d6d3d1' : `linear-gradient(135deg, ${accent}, ${accent}55)`,
        }}
      >
        <div className={cn('h-2 w-12 rounded-full', isOld ? 'bg-stone-500' : 'bg-white/80')} />
        <div className="mt-1 h-1.5 w-8 rounded-full bg-white/40" />
        <div className="mt-2 inline-block rounded-sm px-1.5 py-0.5 text-[7px] font-bold text-white" style={{ background: isOld ? '#78716c' : '#fff', color: isOld ? '#fff' : accent }}>
          {isOld ? 'CLICK HERE' : 'SHOP NOW'}
        </div>
      </div>
      {/* product grid */}
      <div className="mt-2 grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded p-1',
              isOld ? 'border border-stone-300 bg-white' : 'border border-white/10 bg-white/5'
            )}
          >
            <div className={cn('aspect-square rounded-sm', isOld ? 'bg-stone-200' : '')} style={{ background: isOld ? '#e7e5e4' : `${accent}33` }} />
            <div className="mt-1 h-1 w-full rounded-full bg-current opacity-30" />
          </div>
        ))}
      </div>
    </div>
  )
}

interface BeforeAfterProps {
  variant: SceneVariant
  accent?: string
  className?: string
  /** aria label prefix */
  label?: string
}

export function BeforeAfter({
  variant,
  accent = '#0071E3',
  className,
  label = 'Project',
}: BeforeAfterProps) {
  const t = useTranslations('workSection')
  const reduced = usePrefersReducedMotion()
  const isRtl = useIsRtl()
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50) // 0-100
  const dragging = useRef(false)

  const beforeVariant: SceneVariant = variant.includes('site') ? 'site-old' : 'dashboard-old'
  const afterVariant = variant

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // pos is measured from the START edge (left in LTR, right in RTL) so the
    // reveal direction follows the reading direction (audit P1-13).
    const x = isRtl ? rect.right - clientX : clientX - rect.left
    const pct = (x / rect.width) * 100
    setPos(Math.max(2, Math.min(98, pct)))
  }, [isRtl])

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    setFromClientX(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    setFromClientX(e.clientX)
  }
  const onPointerUp = () => { dragging.current = false }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 5
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPos((p) => Math.max(2, p - (isRtl ? -step : step)))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPos((p) => Math.min(98, p + (isRtl ? -step : step)))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setPos(2)
    } else if (e.key === 'End') {
      e.preventDefault()
      setPos(98)
    }
  }

  // Clip is mirrored in RTL: pos counts from the START edge (right), so the
  // "after" layer reveals from the LEFT — matching RTL reading order where
  // "before" sits on the right and "after" on the left (audit P1-13).
  const clipAfter = isRtl ? `inset(0 ${pos}% 0 0)` : `inset(0 0 0 ${pos}%)`

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative aspect-[16/10] w-full select-none overflow-hidden rounded-2xl border border-border bg-card touch-none',
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* before layer (bottom) */}
      <div className="absolute inset-0">
        <Scene variant={beforeVariant} accent={accent} />
        <span className="absolute start-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {t('before')}
        </span>
      </div>

      {/* after layer (top, clipped) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: clipAfter, WebkitClipPath: clipAfter }}
      >
        <Scene variant={afterVariant} accent={accent} />
        <span className="absolute end-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground backdrop-blur-sm">
          {t('after')}
        </span>
      </div>

      {/* handle — anchored to the START edge (right in RTL) */}
      <div
        className="absolute inset-y-0 z-10 w-0.5 bg-white/80"
        style={isRtl ? { right: `${pos}%` } : { left: `${pos}%` }}
        aria-hidden="true"
      >
        <div className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/90 text-elyra-dark shadow-lg">
          <MoveHorizontal className="size-4" />
        </div>
      </div>

      {/* accessible slider control (invisible but focusable) */}
      <div
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-label={`${label}: ${t('dragHint')}`}
        aria-valuetext={`${Math.round(pos)}%`}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 z-20 w-2 cursor-ew-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{
          ...(isRtl ? { right: `calc(${pos}% - 4px)` } : { left: `calc(${pos}% - 4px)` }),
          touchAction: 'none',
        }}
      />

      {/* hint — CSS keyframes cycle (.ba-hint), framer-free (§4.3) */}
      {reduced ? null : (
        <div className="ba-hint pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white/90 backdrop-blur-sm">
          {t('dragHint')}
        </div>
      )}
    </div>
  )
}
