'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

const subscribeNoop = () => () => {}
// Quick win (prompt §8.2): dynamic year — hydration stays safe because
// useSyncExternalStore renders the server snapshot during hydration,
// then re-renders with the client value if it differs.
const getYear = () => new Date().getFullYear()

/**
 * Client island for the server-rendered footer (L6-R6 P3): the ~220
 * lines of footer markup are static and now render on the server —
 * only this one sentence needs the runtime clock. useSyncExternalStore
 * keeps the server snapshot constant (no hydration mismatch) while the
 * client reads the real year — and avoids setState-in-effect cascading
 * renders. Everything else in the footer that needs interactivity
 * (LiveClock) is already its own client component.
 */
export function CopyrightYear() {
  const t = useTranslations('footer')
  const year = useSyncExternalStore(subscribeNoop, getYear, getYear)
  return <>{t('rights', { year })}</>
}
