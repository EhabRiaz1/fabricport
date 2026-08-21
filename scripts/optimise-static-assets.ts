/**
 * Generates responsive AVIF/WebP variants for the large bundled images.
 *
 * `src/assets/main-banner-bg.png` is a 1920x1080 photograph stored as PNG -- 3.83 MB, with
 * no srcset -- and it is pulled by both the marketplace hero (`ArchiveHero`) and the auth
 * screens (`AuthLayout`). It was, by a wide margin, the largest single asset on the
 * marketplace page.
 *
 * Output is committed alongside the source so the build stays a plain `vite build`, with no
 * image plugin in the dependency tree.
 *
 * Usage: npx tsx scripts/optimise-static-assets.ts
 */
import sharp from 'sharp'
import { statSync } from 'node:fs'

const WIDTHS = [960, 1600, 1920] as const

const SOURCES = ['src/assets/main-banner-bg.png']

const kb = (p: string) => `${(statSync(p).size / 1024).toFixed(0)} KB`

for (const src of SOURCES) {
  const base = src.replace(/\.[^.]+$/, '')
  console.log(`${src}  ${kb(src)}`)

  for (const width of WIDTHS) {
    // withoutEnlargement: a 1920-wide source must not be blown up to satisfy the list.
    const pipeline = sharp(src).resize({ width, withoutEnlargement: true })

    const avif = `${base}-${width}.avif`
    await pipeline.clone().avif({ quality: 55, effort: 6 }).toFile(avif)

    const webp = `${base}-${width}.webp`
    await pipeline.clone().webp({ quality: 78 }).toFile(webp)

    console.log(`  ${width}w  avif ${kb(avif)}   webp ${kb(webp)}`)
  }
}
