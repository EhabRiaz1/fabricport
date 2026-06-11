import { cn } from '@/lib/utils'
import { usePreferencesStore } from '@/stores/preferences'

export interface UnitToggleProps {
  className?: string
  showCurrency?: boolean
  showUnit?: boolean
  variant?: 'default' | 'dark' | 'warm'
}

export function UnitToggle({
  className,
  showCurrency = true,
  showUnit = true,
  variant = 'default',
}: UnitToggleProps) {
  const isDark = variant === 'dark'
  const isWarm = variant === 'warm'
  const { currency, unit, setCurrency, setUnit } = usePreferencesStore()

  const borderClass = isDark
    ? 'border-white/20'
    : isWarm
      ? 'border-[#C8C4BC]'
      : 'border-border'

  function buttonClass(active: boolean) {
    if (active) {
      if (isDark) return 'bg-white text-[#0a0a0a]'
      if (isWarm) return 'bg-[#2C1A0E] text-[#F5EDE4]'
      return 'bg-accent text-white'
    }
    if (isDark) return 'bg-transparent text-white/50 hover:text-white'
    if (isWarm) return 'bg-[#F0ECE4] text-[#3C2A1A]/55 hover:text-[#2C1A0E]'
    return 'bg-surface text-text-secondary hover:text-text-primary'
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {showCurrency && (
        <div className={cn('inline-flex border', borderClass)}>
          {(['PKR', 'USD'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={cn(
                'px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors',
                buttonClass(currency === c),
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {showUnit && (
        <div className={cn('inline-flex border', borderClass)}>
          {([
            { value: 'meters' as const, label: 'M' },
            { value: 'yards' as const, label: 'Y' },
          ]).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setUnit(value)}
              className={cn(
                'px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors',
                buttonClass(unit === value),
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default UnitToggle
