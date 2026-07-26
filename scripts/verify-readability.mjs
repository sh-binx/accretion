// Owner: "블랙홀이 되면 나보다 큰 적을 구별하기 어렵고, 성장이 멈춘다"
// (1) rival threat must be color-coded (size alone can't tell — radius is mass^(1/3))
// (2) growth must keep going at high mass, while still staying sub-exponential
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

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.rivalColors, { timeout:15000 })
  ok('boot', true)

  // ── (1) colour coding: deadly rival vs edible rival must be clearly different ──
  const cols = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats()
    A.spawn('rival', 220)          // heavier than us → deadly
    A.spawn('rival', 40)           // lighter than us → food
    A.step(0.05)
    return A.rivalColors()
  })
  const deadly = cols.find(c=>!c.edible), food = cols.find(c=>c.edible)
  ok('both rivals present', !!deadly && !!food, JSON.stringify(cols))
  ok('deadly rival is red', deadly && deadly.disk.startsWith('ff'), deadly&&`#${deadly.disk}`)
  ok('edible rival is green', food && /^6/.test(food.disk), food&&`#${food.disk}`)
  ok('the two are clearly different colours', deadly && food && deadly.disk!==food.disk)

  // size alone genuinely cannot distinguish them (documents WHY colour is needed)
  const rr = await page.evaluate(() => { const A=window.__acc
    return { deadly: Math.cbrt(220/100).toFixed(2), food: Math.cbrt(40/100).toFixed(2) } })
  ok('size cue is weak (radius = mass^1/3)', parseFloat(rr.deadly)<1.35, `deadly is only ${rr.deadly}× your radius`)

  // ── (2) growth keeps going at high mass ──
  const grow = await page.evaluate(() => {
    const A=window.__acc, out={}
    for (const m of [200,1000,3000]) {
      A.begin(); A.setMass(m); A.step(0.1); A.clearObjs(); A.clearFeats()
      const m0=A.state.mass
      for (let k=0;k<6;k++){ const q=A.pos(), r=Math.cbrt(A.state.mass)
        A.spawnTagged(A.state.mass*0.5, q.x+r*1.2, q.z); A.step(0.4) }
      out[m] = { gain: A.state.mass-m0, pct: (A.state.mass-m0)/m0*100 }
    }
    return out
  })
  ok('growth continues at mass 200', grow[200].gain>60, `+${grow[200].gain.toFixed(0)} (${grow[200].pct.toFixed(0)}%)`)
  ok('growth continues at mass 1000', grow[1000].gain>60, `+${grow[1000].gain.toFixed(0)} (${grow[1000].pct.toFixed(0)}%)`)
  ok('growth continues at mass 3000', grow[3000].gain>60, `+${grow[3000].gain.toFixed(0)} (${grow[3000].pct.toFixed(0)}%)`)

  // ── still bounded: no runaway back to billions ──
  const bound = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(12); A.step(0.05)
    let t=0
    for (let i=0;i<300 && A.state.alive;i++){
      A.clearObjs(); A.clearFeats()
      const q=A.pos(), r=Math.cbrt(A.state.mass)
      A.spawnTagged(A.state.mass*0.5, q.x+r*1.2, q.z); A.step(0.5); t+=0.5
      if (t>=90) break
    }
    return { t, mass:A.state.mass, score:A.state.score }
  })
  ok('90s ideal-feed stays in a sane range', bound.mass<60000, `mass ${Math.round(bound.mass).toLocaleString()}`)
  ok('score stays submittable (<1e8)', bound.score<1e8, bound.score.toLocaleString())

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
