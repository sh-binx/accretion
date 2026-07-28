// STEP 4 — loop depth (two abilities, graze chain) + first-run onboarding.
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
  await page.waitForFunction(() => window.__acc && window.__acc.doPulse, { timeout:15000 })
  ok('boot: depth hooks present', true)

  // both abilities are offered in the HUD
  await page.evaluate(() => window.__acc.begin())
  await sleep(200)
  const hud = await page.evaluate(() => ({ dash:!!document.getElementById('actDash'), pulse:!!document.getElementById('actPulse') }))
  ok('HUD offers two abilities', hud.dash && hud.pulse)

  // PULSE: pulls food in and shoves threats away, costs energy, no dash speed
  const pulse = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos()
    A.spawnTagged(30, q.x+34, q.z, 'planet')       // food, some way off
    const before = A.tagDist ? A.tagDist() : null
    A.setEnergy(1); A.doPulse()
    return { moved: before!==null, energy:A.state.energy, surging:A.state.surging, pulses:A.pulseCount() }
  })
  ok('PULSE consumes the charge', pulse.energy<0.1, `energy=${pulse.energy}`)
  ok('PULSE is not a dash (no speed boost)', pulse.surging===false)
  ok('PULSE counted', pulse.pulses===1, `${pulse.pulses}`)

  // pulse actually drags edible bodies toward the player
  const drag = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(); A.spawnTagged(30, q.x+30, q.z, 'planet')
    const d0 = A.tagDist()
    A.setEnergy(1); A.doPulse()
    return { d0, d1:A.tagDist() }
  })
  ok('PULSE drags food toward you', drag.d1 < drag.d0*0.5, `${drag.d0} → ${drag.d1}`)

  // gated like the dash
  const gate = await page.evaluate(() => { const A=window.__acc; A.begin(); A.setEnergy(0.4); const n0=A.pulseCount(); A.doPulse(); return A.pulseCount()-n0 })
  ok('PULSE gated below full charge', gate===0)

  // ── graze chain ──
  const chain = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(), om=Math.cbrt(240)*1.55
    // repeatedly place a lethal rival in the near-miss ring to build a chain
    for (let i=0;i<4;i++){ A.clearObjs(); A.spawn('rival', 240, A.pos().x+om*1.45, A.pos().z); A.step(0.05) }
    return { chain:A.grazeChain(), max:A.grazeMax(), score:A.state.score, alive:A.state.alive }
  })
  ok('graze builds a chain', chain.max>=2, `max ×${chain.max}`)
  ok('graze chain pays score', chain.score>0, `${chain.score}`)
  ok('grazing does not kill', chain.alive===true)

  // ── onboarding ──
  const onb = await page.evaluate(() => {
    const A=window.__acc; A.resetOnboard(); location.reload()
  }).catch(()=>{})
  await page.waitForFunction(() => window.__acc && window.__acc.hintIdx, { timeout:15000 }).catch(()=>{})
  const hints = await page.evaluate(() => {
    const A=window.__acc; A.begin()
    // 힌트는 살아있는 동안만 진행된다(죽으면 다음 런에 이어서 표시) → 위협을 비워 생존시킨 뒤 측정
    const seen=[]
    for (let i=0;i<32;i++){ A.setMass(3); A.clearObjs(); A.step(0.5); seen.push(A.hintIdx()) } // 굶어 죽지 않게 질량 유지
    return { first:seen[0], last:seen[seen.length-1], alive:A.state.alive }
  })
  ok('first run shows all onboarding hints', hints.last>=4, `${hints.last} shown · alive=${hints.alive}`)

  const second = await page.evaluate(() => { const A=window.__acc; A.begin(); for(let i=0;i<32;i++){A.setMass(3);A.clearObjs();A.step(0.5)} return A.hintIdx() })
  // 2026-07-28(오너 요청): 조작 안내는 매판 보여야 한다 → 첫 줄(◆ MOVE)만 반복,
  // 나머지 온보딩 힌트는 첫 플레이에만. 따라서 재플레이 시 idx는 정확히 1에서 멈춘다.
  ok('재플레이 시 이동 안내만 반복(나머지는 안 나옴)', second===1, `idx=${second}`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
