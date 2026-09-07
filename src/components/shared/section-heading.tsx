'use client'

import { KineticWords, Reveal } from './reveal'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  kicker?: string
  title: string
  titleAccent?: string
  subtitle?: string
  variant?: 'on-light' | 'on-dark'
  align?: 'center' | 'start'
  kinetic?: boolean
  /** Optional id for the h2 (lets parents wire aria-labelledby). */
  titleId?: string
  className?: string
}

export function SectionHeading({
  kicker,
  title,
  titleAccent,
  subtitle,
  variant = 'on-light',
  align = 'center',
  kinetic = true,
  titleId,
  className,
}: SectionHeadingProps) {
  const onDark = variant === 'on-dark'
  const centered = align === 'center'

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        centered ? 'items-center text-center' : 'items-start text-start',
        className
      )}
    >
      {kicker ? (
        <Reveal>
          <span className={cn('kicker', onDark && 'kicker-on-dark')}>
            {kicker}
          </span>
        </Reveal>
      ) : null}
      <Reveal delay={0.05}>
        <h2
          id={titleId}
          className={cn(
          /* REF-2 Phase D: one notch of typographic authority (award refs
             sit at 4.5–5vw+): 3xl → 4xl floor keeps mobile safe while
             md grows 5xl → 6xl for the editorial dominance the gap
             analysis called for. */
          'max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-6xl',
            onDark ? 'text-white' : 'text-foreground',
            centered && 'mx-auto'
          )}
        >
          {kinetic ? (
            <KineticWords text={title} />
          ) : (
            <span>{title}</span>
          )}
          {titleAccent ? (
            <span className="text-primary">
              {' '}
              {kinetic ? <KineticWords text={titleAccent} /> : titleAccent}
            </span>
          ) : null}
        </h2>
      </Reveal>
      {subtitle ? (
        <Reveal delay={0.1}>
          <p
            className={cn(
              'max-w-2xl text-base leading-relaxed sm:text-lg',
              onDark ? 'text-white/70' : 'text-muted-foreground',
              centered && 'mx-auto'
            )}
          >
            {subtitle}
          </p>
        </Reveal>
      ) : null}
    </div>
  )
}
