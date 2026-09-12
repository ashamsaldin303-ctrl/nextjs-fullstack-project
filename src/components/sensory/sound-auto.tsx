'use client'

import { useEffect } from 'react'
import { attachSoundDelegation } from '@/lib/sound'

/**
 * SOUND-2 — the always-on ambient sound engine mount.
 *
 * Renders NOTHING. Mounting this component installs the app-wide
 * delegated pointer listeners (hover/click sounds) AND arms the
 * AudioContext on the first user gesture, satisfying browser autoplay
 * policies while keeping the site's sound permanently live — the mute
 * toggle was removed by design (see lib/sound.ts).
 *
 * Exactly ONE mount for the delegation, at the app root (this replaces
 * the old SoundToggle mount in the navbar, which owned the delegation
 * as a side effect of its useEffect).
 */
export function AmbientSound() {
  useEffect(() => attachSoundDelegation(), [])
  return null
}
