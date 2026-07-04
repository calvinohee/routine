import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const svg = await readFile(new URL('./icon.svg', import.meta.url))

// Standard icons.
for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(`public/pwa-${size}.png`)
}

// Apple touch icon (opaque, 180pt).
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png')

// Maskable: glyph shrunk into the 80% safe zone on a full-bleed background.
const inner = await sharp(svg).resize(410, 410).png().toBuffer()
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#00A8B5' },
})
  .composite([{ input: inner, gravity: 'centre' }])
  .png()
  .toFile('public/pwa-maskable-512.png')

// Favicon: the SVG itself.
await writeFile('public/favicon.svg', svg)

console.log('icons written')
