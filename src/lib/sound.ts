/**
 * Elyra Audio UX engine — Phase 2 "Sensory Polish Layer".
 *
 * Ultra-soft synthesized sounds via the Web Audio API (oscillators + gain
 * envelopes). Zero audio files, zero page weight. Everything fails silently:
 * any error path results in silence, never a console error (prompt §5.7).
 *
 * Sound is OPT-IN (muted by default) and persisted in localStorage under
 * `elyra:sound`. The AudioContext is created lazily on the first user
 * gesture AFTER sound is enabled — satisfying browser autoplay policies.
 *
 * Pointer events only (pointerover/pointerdown): keyboard navigation and
 * screen readers never trigger sounds (prompt §5.5).
 */

const STORAGE_KEY = 'elyra:sound'

export type SoundState = 'on' | 'off'

/* ------------------------------------------------------------------ */
/* External store (useSyncExternalStore-compatible)                    */
/* ------------------------------------------------------------------ */

type Listener = () => void
const listeners = new Set<Listener>()
const notify = () => listeners.forEach((l) => l())

/** Subscribes to sound-state changes (same tab + other tabs). */
export function subscribeSound(callback: Listener): () => void {
  listeners.add(callback)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

/** Client snapshot — reads localStorage (returns primitives → stable). */
export function getSoundSnapshot(): SoundState {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** Server snapshot — always muted before consent (hydration-safe). */
export function getSoundServerSnapshot(): SoundState {
  return 'off'
}

/** Persists the preference and wakes the AudioContext on enable. */
export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    /* private mode etc. — state still applies for this session */
  }
  notify()
  if (enabled) ensureContext()
}

/* ------------------------------------------------------------------ */
/* AudioContext + master gain                                          */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null
let master: GainNode | null = null
const MASTER_GAIN = 0.6

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = MASTER_GAIN
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Synth primitives                                                    */
/* ------------------------------------------------------------------ */

interface ToneOptions {
  /** Start frequency in Hz. */
  freq: number
  /** Optional end frequency (gentle glide). */
  endFreq?: number
  /** Duration in seconds. */
  duration: number
  /** Oscillator waveform. */
  type: OscillatorType
  /** Peak gain (0..1, pre-master). */
  peak: number
  /** Delay before the tone starts (seconds). */
  delay?: number
}

function playTone({ freq, endFreq, duration, type, peak, delay = 0 }: ToneOptions): void {
  if (getSoundSnapshot() !== 'on') return
  const c = ensureContext()
  if (!c || !master) return
  try {
    const t0 = c.currentTime + delay
    const osc = c.createOscillator()
    const gain = c.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration)
    }

    // Soft attack / release envelope (no clicks).
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

    osc.connect(gain)
    gain.connect(master)
    // Explicit node teardown (audit P2): onended fires when the oscillator
    // finishes (natural stop() included) — disconnect both nodes so stopped
    // tones don't linger until GC. Double-disconnect is a no-op.
    osc.onended = () => {
      gain.disconnect()
      osc.disconnect()
    }
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  } catch {
    /* silent failure */
  }
}

/* ------------------------------------------------------------------ */
/* Public sounds                                                       */
/* ------------------------------------------------------------------ */

const HOVER_THROTTLE_MS = 60
let lastHoverMs = 0

/** Very faint blip when hovering interactive elements (sine, ~30ms). */
export function playHover(): void {
  const now = Date.now()
  if (now - lastHoverMs < HOVER_THROTTLE_MS) return
  lastHoverMs = now
  playTone({ freq: 1180, duration: 0.03, type: 'sine', peak: 0.035 })
}

/** Soft short pulse on pointer press (triangle, ~60ms, falling pitch). */
export function playClick(): void {
  playTone({ freq: 620, endFreq: 380, duration: 0.06, type: 'triangle', peak: 0.09 })
}

/** Short ascending 3-note arpeggio for success events (90ms per note). */
export function playSuccess(): void {
  const notes = [523.25, 659.25, 783.99] // C5 · E5 · G5
  notes.forEach((freq, i) => {
    playTone({ freq, duration: 0.09, type: 'sine', peak: 0.08, delay: i * 0.09 })
  })
}

/* ------------------------------------------------------------------ */
/* Global pointer-effect delegation                                    */
/* ------------------------------------------------------------------ */

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest('a, button, [data-cursor="magnet"], [role="tab"]')
}

/**
 * Attaches delegated pointer-only listeners for hover/click sounds.
 * Returns a cleanup function. Mounted once at the app root.
 */
export function attachSoundDelegation(): () => void {
  const onOver = (e: PointerEvent) => {
    if (isInteractiveTarget(e.target)) playHover()
  }
  const onDown = (e: PointerEvent) => {
    if (isInteractiveTarget(e.target)) playClick()
  }
  document.addEventListener('pointerover', onOver, { passive: true })
  document.addEventListener('pointerdown', onDown, { passive: true })
  return () => {
    document.removeEventListener('pointerover', onOver)
    document.removeEventListener('pointerdown', onDown)
  }
}
