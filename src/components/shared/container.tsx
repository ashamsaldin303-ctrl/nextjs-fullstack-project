import { cn } from '@/lib/utils'

/**
 * Elyra unified container (Phase 4 WS-0 — prompt §3.1).
 *
 * Replaces every hand-rolled `elyra-container max-w-container`
 * with a single responsive definition so the layout breathes correctly
 * on wide screens (the #1 complaint in the visual review):
 *
 *   max-width:  1152px base → 1280px ≥1280 → 1440px ≥1536 → 1568px ≥1920
 *   padding:    24px base → 40px ≥768 → 64px ≥1280
 *
 * The CSS lives in globals.css (`.elyra-container`); this component is a
 * thin typed wrapper so every call site stays consistent.
 */
export function Container({
  children,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'section' | 'header' | 'footer' | 'nav' | 'main' | 'article'
}) {
  return (
    <Tag className={cn('elyra-container max-w-container', className)}>
      {children}
    </Tag>
  )
}
