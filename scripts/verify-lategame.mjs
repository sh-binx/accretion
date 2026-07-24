// Late-game verification — movement no longer collapses at high mass,
// and threat (rivals) escalates as you grow. (owner: "커질수록 멈추는 느낌 + 커지면 안 무섭다")
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const URL = 'http://localhost:3040/?dev=1'
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }

const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: '+m.text()) })

// distance traveled over 0.5s at steady glide, mass pinned to M
async function travel(M) {
  return await page.evaluate((M) => {
    const A = window.__acc
    A.begin(); A.setTarget(600, 0)
    for (let i=0;i<8;i++){ A.setMass(M); A.step(0.1) }      // reach steady glide (mass pinned)
    const p0 = A.pos()
    for (let i=0;i<5;i++){ A.setMass(M); A.step(0.1) }      // 0.5s travel
    const p1 = A.pos()
    return Math.hypot(p1.x-p0.x, p1.z-p0.z)
  }, M)
}
// rival share of a FRESH field at this tier — averaged over 3 refills (low variance)
async function rivalShare(M) {
  return await page.evaluate((M) => {
    const A = window.__acc
    A.begin()
    for (let i=0;i<3;i++){ A.setMass(M); A.step(0.05) }     // settle tierIdx to tier(M)
    let total=0, rivals=0, threats=0
    for (let r=0;r<3;r++){
      A.clearObjs(); A.setMass(M); A.step(0.1)              // refill field fresh at this tier
      const info = A.objInfo()
      total += info.length
      rivals += info.filter(o => o.t==='rival').length
      threats += info.filter(o => o.t==='rival' && !o.edible).length
    }
    return { total, rivals, threats, share: total? rivals/total : 0, tier: A.state.tier }
  }, M)
}

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.objInfo, { timeout:15000 })
  ok('boot', true)

  // 1) movement no longer collapses — big mass travels AT LEAST as far as small (here: farther)
  const dSmall = await travel(1.2)
  const dBig   = await travel(120)
  ok('movement does NOT collapse at high mass', dBig > dSmall * 1.3, `small=${dSmall.toFixed(1)} big=${dBig.toFixed(1)} (×${(dBig/dSmall).toFixed(2)})`)

  // 2) threat escalates — rivals are a larger share of the field when big
  const rSmall = await rivalShare(1.2)
  const rBig   = await rivalShare(120)
  ok('rival share grows with size', rBig.share > rSmall.share * 1.5, `small=${(rSmall.share*100).toFixed(0)}%(${rSmall.tier}) big=${(rBig.share*100).toFixed(0)}%(${rBig.tier})`)
  ok('most big-tier rivals are deadly (bigger than you)', rBig.threats > rBig.rivals * 0.5, `threats=${rBig.threats}/${rBig.rivals} rivals`)

  // 3) regression — early game still spawns edible planets, growth works, no errors
  const early = await rivalShare(1.2)
  ok('early game still mostly food (rivals < 30%)', early.share < 0.30, `${(early.share*100).toFixed(0)}%`)
  const grew = await page.evaluate(async () => {
    const A = window.__acc; A.begin(); const m0=A.state.mass
    for (let k=0;k<14;k++){ A.eatNearest(); A.step(0.4) }
    return { m0, m1:A.state.mass }
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
