// Spawn-distribution verification — planets must appear AND be edible (owner:
// "small meteors get eaten but planets don't"). Non-rivals should be food.
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

// Aggregate the spawn field across a few masses (fresh topUp each time).
async function survey(mass) {
  return await page.evaluate((m) => {
    const A = window.__acc; A.begin(); A.setMass(m); A.step(0.1)
    // 필드를 비우고 이 질량 기준으로 3회 리필해 합산 — 라이벌 비중이 낮아 단발 표본은 흔들림
    let info = []
    for (let r=0;r<3;r++){ A.clearObjs(); A.setMass(m); A.step(0.1); info = info.concat(A.objInfo()) }
    const planets = info.filter(o => o.t==='planet')
    const nonRival = info.filter(o => o.t!=='rival')
    return {
      n: info.length,
      planets: planets.length,
      ediblePlanets: planets.filter(o=>o.edible).length,
      nonRivalEdibleFrac: nonRival.length ? nonRival.filter(o=>o.edible).length/nonRival.length : 0,
      rivals: info.filter(o=>o.t==='rival').length
    }
  }, mass)
}

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.objInfo, { timeout:15000 })
  ok('boot: spawn hooks present', true)

  const early = await survey(1.2)
  const mid   = await survey(5)
  ok('early game spawns planets', early.planets>=3, `planets=${early.planets}/${early.n}`)
  ok('early planets are edible', early.ediblePlanets>=3, `ediblePlanets=${early.ediblePlanets}`)
  ok('mid game spawns planets', mid.planets>=3, `planets=${mid.planets}/${mid.n}`)
  ok('mid planets are edible', mid.ediblePlanets>=3, `ediblePlanets=${mid.ediblePlanets}`)
  ok('non-rivals are (almost) all food', early.nonRivalEdibleFrac>0.95 && mid.nonRivalEdibleFrac>0.95, `early=${early.nonRivalEdibleFrac.toFixed(2)} mid=${mid.nonRivalEdibleFrac.toFixed(2)}`)
  ok('rivals still present (threat axis)', early.rivals>=1 && mid.rivals>=1, `early=${early.rivals} mid=${mid.rivals}`)

  // a planted planet near-miss gets eaten (planet-specific capture)
  const eaten = await page.evaluate(async () => {
    const A = window.__acc; A.begin(); A.setMass(2.5); A.setTarget(600,0); A.step(0.6)
    const p = A.pos(); A.spawnTagged(1.0, p.x+8, p.z+3.0)   // an edible PLANET, near-miss
    for (let k=0;k<10 && !A.tagEaten();k++){ A.setTarget(A.pos().x+600,0); A.step(0.2) }
    return A.tagEaten()
  })
  ok('edible planet near-miss gets eaten', eaten===true)

  // regression: growth intact
  const grew = await page.evaluate(async () => {
    const A = window.__acc; A.begin(); const m0=A.state.mass
    for (let k=0;k<14;k++){ A.eatNearest(); A.step(0.4) }
    return { m0, m1:A.state.mass }
  })
  ok('regression: growth intact', grew.m1>grew.m0, `${grew.m0} → ${grew.m1}`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
