import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-accent text-white hover:bg-accent/90 clip-corner-sm px-6 py-2.5 text-sm uppercase tracking-wider',
        ghost:
          'text-text-primary hover:bg-elevated hover:text-accent px-4 py-2 text-sm',
        outline:
          'border border-border-strong bg-transparent text-text-primary hover:border-accent hover:text-accent px-6 py-2.5 text-sm uppercase tracking-wider clip-corner-sm',
        destructive:
          'bg-danger text-white hover:bg-danger/90 clip-corner-sm px-6 py-2.5 text-sm uppercase tracking-wider',
      },
      size: {
        default: 'h-10',
        sm: 'h-8 px-4 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
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
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
