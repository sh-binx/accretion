// P4 verification — surge ability + tier visual zones.
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
  await page.waitForFunction(() => window.__acc && window.__acc.doSurge, { timeout:15000 })
  ok('boot: P4 hooks present', true)

  // surge gauge shows during play
  await page.evaluate(() => window.__acc.begin())
  // HUD는 rAF에서 갱신되므로 고정 대기 대신 수렴할 때까지 폴링(간헐 실패 제거)
  let surgeOn=false
  for (let i=0;i<20 && !surgeOn;i++){ await sleep(60)
    surgeOn = await page.evaluate(() => document.getElementById('surge').classList.contains('on')) }
  ok('surge gauge visible during play', surgeOn===true)

  // charge → ready
  await page.evaluate(() => window.__acc.setEnergy(1))
  await sleep(120)
  const ready = await page.evaluate(() => window.__acc.surgeReady())
  ok('full energy → SURGE READY', ready===true)

  // gate: energy < 1 must NOT trigger
  await page.evaluate(() => window.__acc.setEnergy(0.5))
  await page.evaluate(() => window.__acc.doSurge())
  const gated = await page.evaluate(() => window.__acc.state.surging)
  ok('surge gated below full energy', gated===false)

  // trigger consumes energy + enters surging
  await page.evaluate(() => window.__acc.setEnergy(1))
  await page.evaluate(() => window.__acc.doSurge())
  const st = await page.evaluate(() => window.__acc.state)
  ok('surge triggers (surging=true, energy spent)', st.surging===true && st.energy<0.1, `surging=${st.surging} energy=${st.energy}`)

  // functional: surge covers more distance than a normal glide over same time
  const dist = await page.evaluate(async () => {
    const A = window.__acc
    A.begin(); A.setTarget(80,0)            // steer +x
    A.step(0.6)                              // reach steady glide
    const p0 = A.pos(); A.step(0.4); const p1 = A.pos()
    const dNormal = Math.hypot(p1.x-p0.x, p1.z-p0.z)
    A.setEnergy(1); A.doSurge()
    const q0 = A.pos(); A.step(0.4); const q1 = A.pos()
    const dSurge = Math.hypot(q1.x-q0.x, q1.z-q0.z)
    return { dNormal, dSurge }
  })
  ok('surge accelerates (dSurge > 1.4× glide)', dist.dSurge > dist.dNormal*1.4, `glide=${dist.dNormal.toFixed(1)} surge=${dist.dSurge.toFixed(1)}`)

  // tier zone: growing into INTERMEDIATE shifts fog + lensing
  const zone = await page.evaluate(async () => {
    const A = window.__acc
    A.begin()
    const fog0 = A.fogHex(), lens0 = A.zoneLens()
    A.setMass(60)        // → tier 1 (INTERMEDIATE · 진화 아크로 임계 상향)
    A.step(2.2)          // let zone lerp toward violet
    return { fog0, lens0, fog1: A.fogHex(), lens1: A.zoneLens(), tier: A.state.tier }
  })
  ok('reaches INTERMEDIATE tier', zone.tier==='INTERMEDIATE', zone.tier)
  ok('tier zone shifts fog color', zone.fog0!==zone.fog1, `${zone.fog0} → ${zone.fog1}`)
  ok('tier zone strengthens lensing', zone.lens1 > zone.lens0+0.05, `${zone.lens0} → ${zone.lens1}`)

  // regression: growth still works (eat → mass up)
  const grew = await page.evaluate(async () => {
    const A = window.__acc; A.begin(); const m0 = A.state.mass
    for (let k=0;k<12;k++){ A.eatNearest(); A.step(0.4) }
    return { m0, m1: A.state.mass }
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
