import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  variant?: 'on-dark' | 'on-light'
  withWordmark?: boolean
}

/**
 * Elyra wordmark — clean «Elyra» text with a distinctive E
 * and a 4-color brand dot in the amber/green family (palette law:
 * no blue). Pure SVG — zero asset weight.
 */
export function Logo({
  className,
  variant = 'on-dark',
  withWordmark = true,
}: LogoProps) {
  const t = useTranslations('meta')
  const onLight = variant === 'on-light'
  const text = onLight ? '#1D1D1F' : '#F1F5F9'

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 36 36"
        className="h-7 w-7 shrink-0"
        role="img"
        aria-label={t('siteName')}
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
