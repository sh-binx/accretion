// Eat-forgiveness verification — a moving hole must capture near-miss objects
// (owner: "planets only get eaten when they line up too precisely").
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

// Sweep the hole in +x at full speed; plant a stationary edible object `ahead` in front,
// offset `off` perpendicular. Returns whether that specific object got eaten.
async function sweep(off, ahead=8) {
  return await page.evaluate(({off,ahead}) => {
    const A = window.__acc
    A.begin(); A.setMass(2.5)
    A.setTarget(600, 0)          // steer +x
    A.step(0.6)                  // reach steady glide
    const p = A.pos()
    A.spawnTagged(0.5, p.x+ahead, p.z+off)   // plant near-miss ahead
    for (let k=0;k<10 && !A.tagEaten();k++) { A.setTarget(A.pos().x+600, 0); A.step(0.2) }
    return A.tagEaten()
  }, {off, ahead})
}

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.spawnTagged, { timeout:15000 })
  ok('boot: eat-test hooks present', true)

  // perpendicular offsets — mass 2.5 → pull radius ≈ 9.8 world units
  const off1 = await sweep(1.5)   // near-center → must eat
  ok('captures near pass (offset 1.5)', off1===true)
  const off3 = await sweep(3.0)   // clear near-miss → must eat (the reported problem)
  ok('captures near-miss (offset 3.0)', off3===true)
  const off5 = await sweep(5.0)   // wider graze → should still get pulled in
  ok('captures graze (offset 5.0)', off5===true)
  const off14 = await sweep(14.0) // far outside pull → must NOT eat (not a screen-vacuum)
  ok('does NOT vacuum far object (offset 14)', off14===false, `eaten=${off14}`)

  // regression: normal growth still works
  const grew = await page.evaluate(async () => {
    const A = window.__acc; A.begin(); const m0 = A.state.mass
    for (let k=0;k<14;k++){ A.eatNearest(); A.step(0.4) }
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
