export interface SampledColor {
  rgb: [number, number, number]
  hex: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

export function sampleCanvasColor(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  size = 5,
): SampledColor {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Unable to acquire 2D canvas context')
  }

  const half = Math.floor(size / 2)
  const sampleX = clamp(Math.round(x) - half, 0, canvas.width - size)
  const sampleY = clamp(Math.round(y) - half, 0, canvas.height - size)
  const { data } = ctx.getImageData(sampleX, sampleY, size, size)

  let r = 0
  let g = 0
  let b = 0
  let count = 0

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha === 0) continue

    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count += 1
  }

  if (count === 0) {
    return { rgb: [0, 0, 0], hex: '#000000' }
  }

  const rgb: [number, number, number] = [
    Math.round(r / count),
    Math.round(g / count),
    Math.round(b / count),
  ]

  return {
    rgb,
    hex: rgbToHex(...rgb),
  }
}

export async function sampleImageColor(
  image: HTMLImageElement,
  x: number,
  y: number,
  size = 5,
): Promise<SampledColor> {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Unable to acquire 2D canvas context')
  }

  ctx.drawImage(image, 0, 0)
  return sampleCanvasColor(canvas, x, y, size)
}
