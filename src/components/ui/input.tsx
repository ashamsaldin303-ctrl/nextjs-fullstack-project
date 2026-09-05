import * as React from "react"

import { cn } from "@/lib/utils"

// G2-3 P3-6 (fix 8): h-9 (36px) → h-11 (44px) — the touch-target floor.
// Text inputs were the SHORTEST interactive elements in both lead forms
// while the secondary project-type chips and the submit button already
// sat at 44px (min-h-11 / h-11); only two consumers exist in the repo
// (pages/contact-form + home/calculator lead forms) so the systemic fix
// lands in the primitive. Height stays forced by the utility (content
// never grows the box), visual density is preserved by py-1.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-11 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
