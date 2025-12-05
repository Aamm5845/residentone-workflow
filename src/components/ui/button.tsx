import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Base variants
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        
        // Semantic variants - for clear action hierarchy
        success:
          'bg-green-600 text-white shadow-sm hover:bg-green-700 focus-visible:ring-green-500',
        warning:
          'bg-amber-500 text-white shadow-sm hover:bg-amber-600 focus-visible:ring-amber-500',
        info:
          'bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500',
          
        // Phase variants - matching workflow phase colors
        designConcept:
          'bg-[#a657f0] text-white shadow-sm hover:bg-[#9333ea] focus-visible:ring-[#a657f0]',
        threeD:
          'bg-[#f6762e] text-white shadow-sm hover:bg-[#ea580c] focus-visible:ring-[#f6762e]',
        clientApproval:
          'bg-[#14b8a6] text-white shadow-sm hover:bg-[#0d9488] focus-visible:ring-[#14b8a6]',
        drawings:
          'bg-[#6366ea] text-white shadow-sm hover:bg-[#4f46e5] focus-visible:ring-[#6366ea]',
        ffe:
          'bg-[#e94d97] text-white shadow-sm hover:bg-[#db2777] focus-visible:ring-[#e94d97]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        xl: 'h-12 rounded-md px-10 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
        'icon-lg': 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
