/**
 * Exports the brand logo for use in emails.
 *
 * src/assets/logo.png is white-on-transparent (the site flips it with CSS). Email
 * clients can't do that, and a transparent PNG goes invisible on dark-mode
 * backgrounds, so we recolour the glyph to the ink colour and flatten it onto
 * solid white. Output is opaque, small, and reads correctly everywhere.
 *
 *   npx tsx scripts/export-email-logo.ts
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { stat } from 'node:fs/promises'

const SOURCE = 'src/assets/logo.png'
const OUT_DIR = 'public/email'
const INK = { r: 0x2c, g: 0x1a, b: 0x0e, alpha: 1 } // --color-ink
const WHITE = { r: 255, g: 255, b: 255 }

async function exportLogo(width: number, height: number, file: string) {
  // Raw single-channel alpha of the resized glyph.
  const alphaMask = await sharp(SOURCE)
    .ensureAlpha()
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .extractChannel('alpha')
    .raw()
    .toBuffer()

  // Solid ink RGB with the glyph's alpha joined on as the 4th channel, then
  // flattened onto white. (A greyscale overlay with blend 'dest-in' does not
  // work: it has no alpha channel, so the result is a solid ink rectangle.)
  const out = `${OUT_DIR}/${file}`
  // Two pipelines: sharp applies flatten before joinChannel within one pipeline.
  const rgba = await sharp({ create: { width, height, channels: 3, background: INK } })
    .joinChannel(alphaMask, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer()
  await sharp(rgba)
    .flatten({ background: WHITE })
    .png({ compressionLevel: 9, palette: true, colours: 32 })
    .toFile(out)

  const { size } = await stat(out)
  console.log(`${out}: ${width}x${height}, ${(size / 1024).toFixed(1)} KB`)
}

await mkdir(OUT_DIR, { recursive: true })
await exportLogo(360, 79, 'logo@2x.png')
await exportLogo(180, 40, 'logo.png')
