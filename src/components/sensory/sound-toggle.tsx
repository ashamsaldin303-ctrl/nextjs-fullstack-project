'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { Volume2, VolumeX } from 'lucide-react'
import {
  subscribeSound,
  getSoundSnapshot,
  getSoundServerSnapshot,
  setSoundEnabled,
  attachSoundDelegation,
  playSuccess,
} from '@/lib/sound'
import { cn } from '@/lib/utils'

/**
 * Global sound toggle — Phase 2 Audio UX + Phase 4 WS-2 placement.
 *
 * - Muted by default; the preference lives in localStorage (`elyra:sound`)
 *   read through useSyncExternalStore so hydration stays deterministic.
 * - Mounting this component also installs the app-wide delegated
 *   pointer-only listeners that produce hover/click sounds.
 * - Phase 4 WS-2: moved from a fixed floating button to the Navbar
 *   (className prop overrides styling; the layout no longer renders a
 *   separate fixed instance — exactly ONE mount for the delegation).
 */
export function SoundToggle({ className }: { className?: string }) {
  const t = useTranslations('common')
  const enabled = useSyncExternalStore(subscribeSound, getSoundSnapshot, getSoundServerSnapshot)

  // App-wide hover/click delegation — attached once per mount.
  useEffect(() => attachSoundDelegation(), [])

  const onToggle = () => {
    const next = enabled !== 'on'
    setSoundEnabled(next)
    if (next) playSuccess()
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled === 'on'}
      aria-label={enabled === 'on' ? t('sound.disable') : t('sound.enable')}
      data-cursor="magnet"
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      {enabled === 'on' ? (
        <Volume2 className="size-4" aria-hidden="true" />
      ) : (
        <VolumeX className="size-4" aria-hidden="true" />
      )}
    </button>
  )
}
