import { useState } from 'react'
import { cn } from '@/lib/utils'
import { COLOR_FAMILIES } from '@/lib/color/classify'
import type { ColorFamily } from '@/lib/color/classify'

const SPECTRUM_SWATCHES: Record<ColorFamily, string> = {
  black: '#1F1B17',
  white: '#F2EEE6',
  gray: '#8C8881',
  beige: '#D4C4A8',
  brown: '#6B4423',
  red: '#B5382A',
  orange: '#DA5B33',
  yellow: '#E0B43A',
  green: '#3E7A4E',
  blue: '#33628F',
  purple: '#71518F',
  pink: '#C75D8C',
}

export interface ColorSpectrumProps {
  /** Published-fabric count per colour family; families at 0 are hidden. */
  counts: Partial<Record<ColorFamily, number>>
  selected: ColorFamily[]
  onToggle: (family: ColorFamily) => void
  className?: string
}

/**
 * The inventory itself as a spectrum: one band per colour family, width
 * proportional to how many fabrics carry it. Click a band to filter.
 */
export function ColorSpectrum({ counts, selected, onToggle, className }: ColorSpectrumProps) {
  const [hovered, setHovered] = useState<ColorFamily | null>(null)

  const families = COLOR_FAMILIES.filter((family) => (counts[family] ?? 0) > 0)
  if (families.length === 0) return null

  const hasSelection = selected.length > 0

  return (
    <div className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#2C1A0E]">
          Browse by colour
        </p>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#3C2A1A]/45">
          {hovered
            ? `${hovered} — ${counts[hovered]} fabric${counts[hovered] === 1 ? '' : 's'}`
            : `${families.length} families in stock`}
        </p>
      </div>

      <div
        className="flex h-16 w-full overflow-hidden border border-[#2C1A0E]/15 clip-corner-sm sm:h-20"
        role="group"
        aria-label="Filter by colour family"
        onMouseLeave={() => setHovered(null)}
      >
        {families.map((family) => {
          const count = counts[family] ?? 0
          const isSelected = selected.includes(family)
          const dimmed = (hasSelection && !isSelected) || (hovered != null && hovered !== family)
          const isLight = family === 'white' || family === 'beige' || family === 'yellow'

          return (
            <button
              key={family}
              type="button"
              onClick={() => onToggle(family)}
              onMouseEnter={() => setHovered(family)}
              onFocus={() => setHovered(family)}
              aria-pressed={isSelected}
              aria-label={`${family} — ${count} fabrics`}
              title={`${family} · ${count}`}
              className={cn(
                'group relative min-w-[28px] outline-none transition-all duration-300 ease-out',
                'hover:!opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E8A070]',
                dimmed ? 'opacity-35' : 'opacity-100',
              )}
              style={{
                backgroundColor: SPECTRUM_SWATCHES[family],
                flexGrow: hovered === family ? count * 1.6 + 4 : count,
                flexBasis: 0,
              }}
            >
              {/* Selected notch */}
              {isSelected && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-1 bg-[#E8A070]"
                />
              )}
              {/* Label appears when there's room (hover/selected) */}
              <span
                className={cn(
                  'pointer-events-none absolute inset-0 flex flex-col items-center justify-center font-mono text-[9px] uppercase tracking-[0.18em] transition-opacity duration-200',
                  hovered === family || isSelected ? 'opacity-100' : 'opacity-0',
                  isLight ? 'text-[#2C1A0E]' : 'text-[#F5EDE4]',
                )}
              >
                {family}
                <span className={cn('mt-0.5', isLight ? 'text-[#2C1A0E]/55' : 'text-[#F5EDE4]/55')}>
                  {count}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ColorSpectrum
