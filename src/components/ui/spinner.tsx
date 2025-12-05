import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const spinnerVariants = cva(
  "animate-spin",
  {
    variants: {
      size: {
        xs: "w-3 h-3",
        sm: "w-4 h-4",
        default: "w-6 h-6",
        lg: "w-8 h-8",
        xl: "w-12 h-12",
      },
      variant: {
        default: "text-primary",
        muted: "text-muted-foreground",
        white: "text-white",
        // Phase colors for loading states in specific phases
        designConcept: "text-[#a657f0]",
        threeD: "text-[#f6762e]",
        clientApproval: "text-[#14b8a6]",
        drawings: "text-[#6366ea]",
        ffe: "text-[#e94d97]",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string
  showLabel?: boolean
}

function Spinner({ 
  className, 
  size, 
  variant, 
  label = "Loading...",
  showLabel = false,
  ...props 
}: SpinnerProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <Loader2 className={cn(spinnerVariants({ size, variant }))} />
      {showLabel && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  )
}

// Convenience component for full-page loading states
function PageLoader({ 
  label = "Loading...",
  variant = "default",
}: {
  label?: string
  variant?: VariantProps<typeof spinnerVariants>["variant"]
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="xl" variant={variant} />
      <p className="text-muted-foreground animate-pulse">{label}</p>
    </div>
  )
}

// Convenience component for inline loading states
function InlineLoader({ 
  label = "Loading...",
  size = "sm",
  variant = "muted",
}: {
  label?: string
  size?: VariantProps<typeof spinnerVariants>["size"]
  variant?: VariantProps<typeof spinnerVariants>["variant"]
}) {
  return (
    <div className="flex items-center gap-2 py-2">
      <Spinner size={size} variant={variant} />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

// Convenience component for button loading states
function ButtonLoader({ 
  size = "sm",
}: {
  size?: VariantProps<typeof spinnerVariants>["size"]
}) {
  return <Spinner size={size} variant="white" />
}

export { Spinner, PageLoader, InlineLoader, ButtonLoader, spinnerVariants }
