import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // F-S7-11 (audit r2): transition-all → enumerated property list (only
  // color/bg/border/shadow/transform ever change on this component —
  // transform is needed for the F-S7-10 active:scale-[0.97] press state,
  // the idiom already established in cta.tsx / contact-form.tsx).
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-300 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // F-S5-03 (audit r2): hover:bg-primary/90 (4.02:1 white-on-tint on
        // light surfaces) → hover:bg-primary-strong (#0066CC = 5.57:1 on
        // white) — darkening on hover also reads as a conventional press
        // affordance.
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary-strong",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        // F-S5-10 (audit r2): ghost/outline hover text was accent-foreground
        // (#0071E3 = 4.15:1 over the pale-blue wash) → primary-strong
        // (#0066CC ≈ 4.9:1) per the token's own documented role.
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-primary-strong dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-primary-strong dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        // F-S5-10 (audit r2): sm h-8 (32px, sub-44px touch target) → h-9.
        sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
