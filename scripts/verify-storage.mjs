// Regression: blocked storage must not abort boot or lose this session's best score.
// NODE_PATH can point to a workspace Playwright installation.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })
try {
 for (const mode of ['normal','blocked','quota']) {
  const page = await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true})
  const errors=[]; page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(mode=>{
   if(mode==='blocked')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}})
   if(mode==='quota')Storage.prototype.setItem=function(){throw new DOMException('Storage full','QuotaExceededError')}
  },mode)
  await page.goto(process.env.BASE_URL||'http://localhost:3040')
  await page.waitForTimeout(800)
  assert.deepEqual(errors,[],`${mode}: boot errors`)
  await page.locator('#startBtn').click()
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction(()=>S.t>0)
  assert.equal(await page.evaluate(()=>{STATS.best=12345;return STATS.best}),12345,`${mode}: session best`)
  assert.equal(await page.evaluate(()=>{STATS.rank='42';return STATS.rank}),'42',`${mode}: session rank`)
  assert.equal(await page.evaluate(()=>{LB.name='Pilot';return LB.name}),'Pilot',`${mode}: session name`)
  assert.deepEqual(errors,[],`${mode}: play errors`)
  if(mode==='normal'){
   await page.reload();await page.waitForTimeout(500)
   assert.equal(await page.evaluate(()=>STATS.best),12345,'persistent best after reload')
  }
  console.log(`PASS ${mode}: boot, play, session records`)
  await page.close()
 }
} finally { await browser.close() }
