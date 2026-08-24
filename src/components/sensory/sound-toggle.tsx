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

/**
 * Global sound toggle — Phase 2 Audio UX (prompt §5).
 *
 * - Muted by default; the preference lives in localStorage (`elyra:sound`)
 *   read through useSyncExternalStore so hydration stays deterministic
 *   (server snapshot is always "off" until the user opts in).
 * - Mounting this component also installs the app-wide delegated
 *   pointer-only listeners that produce hover/click sounds.
 * - Positioned at the logical start corner (`start-4 bottom-4`) so it
 *   flips correctly between LTR and RTL.
 */
export function SoundToggle() {
  const t = useTranslations('common')
  const enabled = useSyncExternalStore(subscribeSound, getSoundSnapshot, getSoundServerSnapshot)

  // App-wide hover/click delegation — attached once per mount.
  useEffect(() => attachSoundDelegation(), [])

  const onToggle = () => {
    const next = enabled !== 'on'
    setSoundEnabled(next)
    if (next) playSuccess() // audible confirmation that sound now works
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled === 'on'}
      aria-label={enabled === 'on' ? t('sound.disable') : t('sound.enable')}
      data-cursor="magnet"
      className="fixed bottom-4 start-4 z-[180] inline-flex size-11 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-md backdrop-blur-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:size-10"
    >
      {enabled === 'on' ? (
        <Volume2 className="size-5" aria-hidden="true" />
      ) : (
        <VolumeX className="size-5" aria-hidden="true" />
      )}
    </button>
  )
}
