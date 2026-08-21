import type { ColorFamily } from '@/lib/color/classify'

/**
 * The one colour-family palette.
 *
 * This existed three times with three different sets of values: `FilterDock`,
 * `FilterSidebar` (dead code) and `ColorSpectrum`, plus a fourth partial copy in
 * `ColorRibbon`. The spectrum's muted warm values are canonical -- FilterDock's `#E91E8C`
 * pink and `#F1C40F` yellow are flat-UI primaries that clash with the cream palette, and
 * they were what the marketplace filter actually rendered.
 */
export const COLOR_SWATCH_HEX: Record<ColorFamily, string> = {
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

/** Room tints for the home-page colour ribbon hover state. Not used for swatches. */
export const COLOR_SWATCH_TINT: Record<ColorFamily, string> = {
  black: '#E7E2DA',
  white: '#F8F5EE',
  gray: '#EFEBE3',
  beige: '#F4ECDC',
  brown: '#EFE2D2',
  red: '#F4DFD8',
  orange: '#F8E4DA',
  yellow: '#F7EDD2',
  green: '#DFEBDD',
  blue: '#DDE7EE',
  purple: '#E9E0EE',
  pink: '#F6DFE9',
}
