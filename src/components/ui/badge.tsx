import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Base variants
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        
        // Status variants - consistent across the app
        success:
          "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
        warning:
          "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-200",
        error:
          "border-transparent bg-red-100 text-red-800 hover:bg-red-200",
        info:
          "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200",
        neutral:
          "border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200",
          
        // Phase variants - matching workflow colors
        designConcept:
          "border-transparent bg-[#a657f0]/15 text-[#7c3aed] hover:bg-[#a657f0]/25",
        threeD:
          "border-transparent bg-[#f6762e]/15 text-[#ea580c] hover:bg-[#f6762e]/25",
        clientApproval:
          "border-transparent bg-[#14b8a6]/15 text-[#0d9488] hover:bg-[#14b8a6]/25",
        drawings:
          "border-transparent bg-[#6366ea]/15 text-[#4f46e5] hover:bg-[#6366ea]/25",
        ffe:
          "border-transparent bg-[#e94d97]/15 text-[#db2777] hover:bg-[#e94d97]/25",
          
        // Project status variants
        active:
          "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
        onHold:
          "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-200",
        completed:
          "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200",
        cancelled:
          "border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
