import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

// Modern iPhone families (portrait): [label, points W, points H, dpr].
// Covers iPhone SE through the 16 Pro Max — Calvin's 16 Pro is 402×874 @3.
const DEVICES = [
  ['16-pro-max', 440, 956, 3],
  ['16-pro', 402, 874, 3],
  ['plus-promax', 430, 932, 3],
  ['16-15-14pro', 393, 852, 3],
  ['14-13-12-promax', 428, 926, 3],
  ['14-13-12', 390, 844, 3],
  ['mini-x-xs-11pro', 375, 812, 3],
  ['xr-11', 414, 896, 2],
  ['xsmax-11promax', 414, 896, 3],
  ['se-8-7', 375, 667, 2],
]

const face = await readFile(new URL('./glyph.svg', import.meta.url))

/** Full-bleed gradient with the face logo centred, sized to the shorter edge. */
async function splash(px, py) {
  const glyph = Math.round(Math.min(px, py) * 0.32)
  const logo = await sharp(face).resize(glyph, glyph).png().toBuffer()
  return sharp({
    create: {
      width: px,
      height: py,
      channels: 4,
      background: '#00b3bd', // mid-point of the icon gradient
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
}

const links = []
for (const [label, w, h, dpr] of DEVICES) {
  const px = w * dpr
  const py = h * dpr
  const file = `splash-${label}.png`
  await (await splash(px, py)).toFile(`public/${file}`)
  links.push(
    `    <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="/routine/${file}" />`,
  )
}

await writeFile(new URL('./splash-links.html', import.meta.url), links.join('\n') + '\n')
console.log(`${DEVICES.length} splash images written; link tags in scripts/splash-links.html`)
