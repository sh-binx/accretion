// Owner-reported logic bugs: (1) a rock must never eat a black hole,
// (2) form must not flicker back and forth (nor re-fire the supernova).
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
  await page.waitForFunction(() => window.__acc && window.__acc.form, { timeout:15000 })
  ok('boot', true)

  // ── (1) as a planetesimal/star, EVERY black hole is lethal — never food ──
  const asRock = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(2.3); A.step(0.1)   // owner's exact situation
    A.clearObjs(); A.spawn('rival', 1.0); A.step(0.05)              // a rival much SMALLER than us
    const info = A.objInfo().filter(o=>o.t==='rival')
    return { form:A.form().name, edible: info.some(o=>o.edible), n:info.length }
  })
  ok('planetesimal: smaller black hole is NOT edible', asRock.edible===false, `form=${asRock.form} rivals=${asRock.n}`)

  const asStar = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(8); A.step(0.1)
    A.clearObjs(); A.spawn('rival', 2.0); A.step(0.05)
    return { form:A.form().name, edible:A.objInfo().filter(o=>o.t==='rival').some(o=>o.edible) }
  })
  ok('star: smaller black hole is NOT edible', asStar.edible===false, asStar.form)

  // once YOU are a black hole, mass decides again (fair fight)
  const asBH = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1)
    A.clearObjs(); A.spawn('rival', 20); A.step(0.05)
    return { form:A.form().name, edible:A.objInfo().filter(o=>o.t==='rival').some(o=>o.edible) }
  })
  ok('black hole: smaller black hole IS edible again', asBH.edible===true, asBH.form)

  // a small black hole kills a planetesimal on contact
  const lethal = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(2.3); A.step(0.1); A.clearObjs()
    const p=A.pos(); A.spawn('rival', 1.0, p.x+1.2, p.z)            // right on top of us
    for(let i=0;i<10 && A.state.alive;i++)A.step(0.1)
    return A.state.alive
  })
  ok('small black hole kills a planetesimal on contact', lethal===false)

  // ── (2) form never regresses; supernova fires exactly once ──
  const mono = await page.evaluate(() => {
    const A=window.__acc; A.resetCodex(); A.begin()
    A.setMass(20.5); A.step(0.05)                                   // cross into black hole (supernova #1)
    const f1=A.form().idx
    let minForm=f1
    for(let i=0;i<14;i++){                                          // hover across the 12 threshold repeatedly
      A.setMass(19.4); A.step(0.06); minForm=Math.min(minForm,A.form().idx)
      A.setMass(20.6); A.step(0.06)
    }
    return { f1, minForm, finalForm:A.form().idx, novas:A.novaCount() }
  })
  ok('form never regresses below black hole', mono.minForm===2, `min=${mono.minForm}`)
  ok('supernova does not re-fire on threshold hover', mono.novas===1, `초신성 ${mono.novas}회`)

  // dropping mass hard keeps you a black hole (physically one-way)
  const oneWay = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(20); A.step(0.06); const a=A.form().name
    A.setMass(1.0); A.step(0.06); return { a, b:A.form().name }
  })
  ok('mass loss does not turn a black hole back into a rock', oneWay.a==='BLACK HOLE' && oneWay.b==='BLACK HOLE', `${oneWay.a} → ${oneWay.b}`)

  // regression: forward evolution still works end to end
  const fwd = await page.evaluate(() => {
    const A=window.__acc; A.begin(); const seq=[A.form().name]
    A.setMass(5); A.step(0.05); seq.push(A.form().name)
    A.setMass(21); A.step(0.05); seq.push(A.form().name)
    return { seq, shock:A.shockOn() }
  })
  ok('forward arc intact (protostar → star → black hole + nova)', fwd.seq.join('>')==='PROTOSTAR>MAIN SEQUENCE>BLACK HOLE' && fwd.shock===true, fwd.seq.join(' → '))

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
