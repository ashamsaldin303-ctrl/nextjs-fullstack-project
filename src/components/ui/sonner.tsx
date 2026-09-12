"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"

/**
 * F-S9-01 (gold-standard audit): next-themes was a dependency used ONLY
 * here (shadcn's stock wrapper syncs the toaster theme with the app theme
 * provider). The site is a deliberate light design with dark sections and
 * no dark-mode toggle — the next-themes context never existed, so
 * useTheme() always fell back to "system". The dependency is removed and
 * the toaster is pinned to the site's actual appearance ("light"): one
 * less package in the bundle and zero behavioral change.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
