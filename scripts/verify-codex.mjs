// Codex collection + meta-unlock verification (P#1 addictiveness).
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const URL = 'http://localhost:3040/?dev=1'
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }
const sleep = ms => new Promise(r=>setTimeout(r,ms))

const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: '+m.text()) })

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.codex, { timeout:15000 })
  ok('boot: codex hooks present', true)

  // clean slate
  await page.evaluate(() => window.__acc.resetCodex())
  const c0 = await page.evaluate(() => window.__acc.codex())
  ok('codex resets to 0/39', c0.count===0 && c0.total===39, JSON.stringify(c0))

  // discover 6 → SOLAR unlocks
  await page.evaluate(() => ['rock','planet','star','neutron','pulsar','surge','tidal','rival'].forEach(t => window.__acc.discover(t)))
  const c6 = await page.evaluate(() => ({ count: window.__acc.codex().count, solar: window.__acc.skinUnlocked('solar'), aurora: window.__acc.skinUnlocked('aurora') }))
  ok('8 discoveries → count 8', c6.count===8, `count=${c6.count}`)
  ok('SOLAR skin unlocks at 8', c6.solar===true)
  ok('AURORA still locked (<20)', c6.aurora===false)

  // select unlocked skin sticks; locked skin does not
  const s1 = await page.evaluate(() => window.__acc.setSkin('solar'))
  ok('select unlocked skin (solar)', s1==='solar', s1)
  const s2 = await page.evaluate(() => window.__acc.setSkin('aurora'))
  ok('locked skin refused (falls to void)', s2!=='aurora', `got ${s2}`)
  await page.evaluate(() => window.__acc.setSkin('solar'))

  // persists across reload
  await page.reload({ waitUntil:'networkidle' })
  await page.waitForFunction(() => window.__acc && window.__acc.codex, { timeout:15000 })
  const cP = await page.evaluate(() => ({ count: window.__acc.codex().count, skin: window.__acc.curSkin() }))
  ok('codex persists across reload', cP.count===8, `count=${cP.count}`)
  ok('selected skin persists', cP.skin==='solar', cP.skin)

  // codex screen opens + renders entries (discovered vs locked)
  await page.evaluate(() => window.__acc.openCodex())
  await sleep(300)
  const grid = await page.evaluate(() => ({ open: window.__acc.codexOpen(), total: document.querySelectorAll('#codexGrid .cdx').length, got: document.querySelectorAll('#codexGrid .cdx.got').length, locked: document.querySelectorAll('#codexGrid .cdx:not(.got)').length, skins: document.querySelectorAll('#skinRow .skin').length }))
  ok('codex screen opens', grid.open===true)
  ok('grid shows all 39 entries', grid.total===39, `${grid.total}`)
  ok('8 discovered + 31 locked shown', grid.got===8 && grid.locked===31, `got=${grid.got} locked=${grid.locked}`)
  ok('3 skins listed', grid.skins===3, `${grid.skins}`)
  await page.evaluate(() => window.__acc.closeCodex())

  // event triggers discover the right entries
  const ev = await page.evaluate(async () => {
    const A = window.__acc; A.resetCodex()
    A.begin(); A.setEnergy(1); A.doSurge()                 // → surge
    A.setMass(400); A.step(0.3)                             // → intermediate(5단계 티어)
    A.setMass(5000); A.step(0.3)                            // → supermassive
    A.setMass(0.1); A.step(0.1)                             // force evaporate → evaporate
    return window.__acc.codex().seen
  })
  ok('SURGE discovered by using surge', ev.includes('surge'))
  ok('INTERMEDIATE discovered by tier-up', ev.includes('intermediate'))
  ok('SUPERMASSIVE discovered by tier-up', ev.includes('supermassive'))
  ok('HAWKING discovered by evaporating', ev.includes('evaporate'), ev.join(','))

  // regression: growth + eating still works
  const grew = await page.evaluate(async () => {
    const A = window.__acc, runs=[]
    for (let r=0;r<5;r++){ A.begin(); const m0=A.state.mass
      for (let k=0;k<12;k++){ A.eatNearest(); A.step(0.4) }
      runs.push({ m0, m1:A.state.mass }) }
    runs.sort((a,b)=>(a.m1-a.m0)-(b.m1-b.m0))
    return runs[2]  // 초반 고분산 → 5회 중앙값(lategame·p4와 동일 처리)
  })
  ok('regression: growth intact', grew.m1 > grew.m0, `${grew.m0} → ${grew.m1}`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
