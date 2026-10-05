// The first rendered frame reports readiness once, including when the SDK arrives late.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const { chromium } = createRequire(new URL('../../keep-watching/package.json', import.meta.url))('playwright')
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })
try {
 for (const delay of [0, 1500]) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  await ctx.route('https://sdk.crazygames.com/**', async route => {
   if (delay) await new Promise(resolve => setTimeout(resolve, delay))
   await route.fulfill({ contentType: 'application/javascript', body: `
    window.__signals=[];
    const game={loadingStop(){if(this!==game)throw Error('SDK receiver lost');__signals.push('ready')},gameplayStart(){__signals.push('start')},gameplayStop(){__signals.push('stop')}};
    window.CrazyGames={SDK:{init:async()=>{},game,user:{systemInfo:{locale:'en-US'}}}};
   ` })
  })
  const page = await ctx.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto((process.env.BASE_URL || 'http://localhost:3040') + '/?portal=cg')
  await page.waitForFunction(() => window.__signals?.includes('ready'))
  await page.click('#startBtn')
  await page.waitForTimeout(1600)
  const signals = await page.evaluate(() => __signals)
  assert.equal(signals.filter(x => x === 'ready').length, 1, `SDK delay ${delay}ms: loadingStop must not repeat each frame`)
  assert.ok(signals.includes('start'), 'game can start after readiness')
  assert.deepEqual(errors, [])
  console.log(`PASS SDK delay ${delay}ms: one readiness signal, gameplay start, no JS errors`)
  await ctx.close()
 }
} finally { await browser.close() }
