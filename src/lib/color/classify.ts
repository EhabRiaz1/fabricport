export const COLOR_FAMILIES = [
  'black',
  'white',
  'gray',
  'beige',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const

export type ColorFamily = (typeof COLOR_FAMILIES)[number]

export interface RgbColor {
  r: number
  g: number
  b: number
}

function normalizeRgb(rgb: RgbColor | [number, number, number]): RgbColor {
  if (Array.isArray(rgb)) {
    return { r: rgb[0], g: rgb[1], b: rgb[2] }
  }
  return rgb
}

function toHslValues(rgb: RgbColor) {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  const l = ((max + min) / 2) * 100
  let s = 0

  if (delta !== 0) {
    s = l < 50 ? (delta / (max + min)) * 100 : (delta / (2 - max - min)) * 100

    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) * 60
        break
      case g:
        h = ((b - r) / delta + 2) * 60
        break
      default:
        h = ((r - g) / delta + 4) * 60
        break
    }
  }

  return { h: Number.isNaN(h) ? 0 : h, s, l }
}

export function classifyColorFamily(input: RgbColor | [number, number, number]): ColorFamily {
  const rgb = normalizeRgb(input)
  const { h, s, l } = toHslValues(rgb)

  if (s < 12) {
    if (l < 15) return 'black'
    if (l > 85) return 'white'
    return 'gray'
  }

  if (h >= 15 && h < 45 && l < 55 && s < 40) {
    return 'brown'
  }

  if (h >= 35 && h < 55 && l > 70 && s < 35) {
    return 'beige'
  }

  if (h >= 345 || h < 15) return 'red'
  if (h >= 15 && h < 45) return 'orange'
  if (h >= 45 && h < 70) return 'yellow'
  if (h >= 70 && h < 160) return 'green'
  if (h >= 160 && h < 280) return 'blue'
  if (h >= 280 && h < 320) return 'purple'
  return 'pink'
}

export function isColorFamily(value: string): value is ColorFamily {
  return (COLOR_FAMILIES as readonly string[]).includes(value)
}
