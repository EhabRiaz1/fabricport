import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToastStore, type ToastVariant } from '@/stores/toast'

const VARIANT_ICON: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
}

const VARIANT_ICON_CLASS: Record<ToastVariant, string> = {
  default: 'text-bronze',
  success: 'text-success',
  error: 'text-danger',
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore()

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={4500}>
      {toasts.map((item) => {
        const Icon = VARIANT_ICON[item.variant]
        return (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id)
            }}
            className={cn(
              'clip-corner-sm pointer-events-auto relative flex items-start gap-3 border border-border-strong bg-card px-4 py-3.5 shadow-lg shadow-ink/10',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-80',
              'data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full',
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', VARIANT_ICON_CLASS[item.variant])} />
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="font-display text-sm font-semibold tracking-tight text-text-dark">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="mt-0.5 text-xs leading-relaxed text-text-dark-secondary">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="shrink-0 text-text-dark-secondary/60 transition-colors hover:text-text-dark"
            >
              <X className="h-3.5 w-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed bottom-5 right-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  )
}

export default Toaster
