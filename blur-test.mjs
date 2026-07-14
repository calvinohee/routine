import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: undefined, headless: true })
const page = await browser.newPage({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
})
await page.emulateMedia({ colorScheme: 'dark' })
await page.goto('http://localhost:4173/routine/')
await page.waitForSelector('.large-title', { timeout: 15000 })
// Simulate the iPhone 16 Pro top inset (island bottom at 59pt).
await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
// Make the page scrollable, then push the title under the strip.
await page.evaluate(() => {
  document.body.style.minHeight = '3000px'
  window.scrollTo(0, 60)
})
await page.waitForTimeout(300)
console.log('scrollY:', await page.evaluate(() => window.scrollY))

const probe = await page.evaluate(() => {
  const el = document.querySelector('.top-safe')
  const rect = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  return {
    safeTopVar: getComputedStyle(document.documentElement).getPropertyValue('--safe-top'),
    rectHeight: rect.height,
    blur: cs.webkitBackdropFilter || cs.backdropFilter,
    mask: cs.webkitMaskImage || cs.maskImage,
  }
})
console.log(JSON.stringify(probe, null, 1))
await page.screenshot({ path: '/tmp/blur-shot-dark.png', clip: { x: 0, y: 0, width: 402, height: 170 } })
await browser.close()
