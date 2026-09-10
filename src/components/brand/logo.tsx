import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  variant?: 'on-dark' | 'on-light'
  withWordmark?: boolean
  /**
   * AUDIT-A5 NIT (fix 8): hide the marks from assistive technology —
   * the outer span and the svg's img/label both go quiet, so the Logo
   * contributes nothing to its host's accessible name. Used inside the
   * navbar home link, which already carries its own sr-only name
   * (nav.home) — without this the link announced a TRIPLE name:
   * «الرئيسية، إيليرا، Elyra» (sr-only + svg aria-label + wordmark).
   * Naming consumers (the mobile sheet's SheetTitle, the footer brand
   * block) keep the default and still announce the logo.
   */
  'aria-hidden'?: boolean
}

/**
 * Elyra wordmark — clean «Elyra» text with a distinctive E
 * and the intentional Google quad-dot brand mark (blue/green/red/yellow:
 * #4285F4/#34A853/#EA4335/#FBBC05 — deliberately outside the token
 * system). Pure SVG — zero asset weight.
 */
export function Logo({
  className,
  variant = 'on-dark',
  withWordmark = true,
  'aria-hidden': ariaHidden,
}: LogoProps) {
  const t = useTranslations('meta')
  const onLight = variant === 'on-light'
  const text = onLight ? '#1D1D1F' : '#F1F5F9'

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      aria-hidden={ariaHidden || undefined}
    >
      <svg
        viewBox="0 0 36 36"
        className="h-7 w-7 shrink-0"
        // Hidden subtree has no role to play — the img/label pair is
        // dropped so the decorative mark carries no redundant name.
        role={ariaHidden ? undefined : 'img'}
        aria-label={ariaHidden ? undefined : t('siteName')}
      >
        {/* Mark — distinctive E with the four-color quad dot */}
        <rect width="36" height="36" rx="9" fill={onLight ? '#0F172A' : '#F1F5F9'} />
        <path
          d="M11 9 H22 V12.4 H14.6 V16.4 H20.6 V19.8 H14.6 V24 H22 V27.4 H11 Z"
          fill={onLight ? '#F1F5F9' : '#0F172A'}
        />
        <circle cx="27" cy="20.4" r="2.6" fill="#4285F4" />
        <circle cx="27" cy="14.8" r="1.5" fill="#EA4335" />
        <circle cx="22.6" cy="20.4" r="1.5" fill="#FBBC05" />
        <circle cx="27" cy="25.9" r="1.5" fill="#34A853" />
      </svg>
      {withWordmark && (
        <span
          className="text-xl font-semibold tracking-tight"
          style={{ color: text }}
        >
          Elyra
        </span>
      )}
    </span>
  )
}
