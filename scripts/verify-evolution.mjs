// Stellar evolution arc verification — planetesimal → star → SUPERNOVA → black hole.
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
  ok('boot: evolution hooks present', true)

  // starts as a planetesimal — black hole parts hidden, lensing essentially off
  const start = await page.evaluate(() => { const A=window.__acc; A.begin(); A.step(0.05); return { f:A.form(), v:A.formVis() } })
  ok('starts as PROTOSTAR', start.f.name==='PROTOSTAR' && start.f.idx===0, start.f.name)
  ok('black hole parts hidden at start', start.v.bh===false && start.v.disk===false && start.v.rock===true)
  ok('lensing is off before the black hole', start.f.lens<0.2, `×${start.f.lens}`)

  // ignition → main sequence
  const star = await page.evaluate(() => { const A=window.__acc; A.setMass(6); A.step(0.06); return { f:A.form(), v:A.formVis() } })
  ok('mass 6 → MAIN SEQUENCE (star mesh)', star.f.name==='MAIN SEQUENCE' && star.v.star===true && star.v.rock===false)

  // SUPERNOVA: crossing 12 from star form must fire the event
  const nova = await page.evaluate(() => {
    const A = window.__acc
    A.resetCodex(); A.begin(); A.setMass(11.5); A.step(0.06)   // settle as a star
    const before = A.state.score
    A.setMass(21); A.step(0.02)                                  // cross the collapse threshold
    return { shock:A.shockOn(), inv:A.form().inv, form:A.form().name, lens:A.form().lens,
             codex:A.codex().seen.includes('supernova'), gain:A.state.score-before, vis:A.formVis() }
  })
  ok('SUPERNOVA fires a shockwave', nova.shock===true)
  ok('SUPERNOVA grants brief invulnerability', nova.inv>0, `${nova.inv}s`)
  ok('SUPERNOVA sweeps nearby bodies for score', nova.gain>0, `+${nova.gain}`)
  ok('SUPERNOVA discovers its codex fact', nova.codex===true)
  ok('after collapse → BLACK HOLE form', nova.form==='BLACK HOLE' && nova.vis.bh===true && nova.vis.star===false)
  ok('lensing switches on at black hole', nova.lens===1, `×${nova.lens}`)

  // 블랙홀 구간 안에서 질량이 더 늘어도 초신성은 다시 터지지 않는다.
  // (충격파 표시 여부는 프록시라 부정확 — 실제 폭발 횟수를 센다)
  const noDouble = await page.evaluate(() => { const A=window.__acc; A.begin()
    A.setMass(60); A.step(0.05); const first=A.novaCount()
    A.setMass(90); A.step(0.05); A.setMass(400); A.step(0.05)
    return { first, after:A.novaCount(), form:A.form().name } })
  ok('no repeat supernova inside black-hole range', noDouble.first===1 && noDouble.after===1, `${noDouble.first}회 → ${noDouble.after}회`)

  // nemesis only after the black hole exists
  const nem = await page.evaluate(() => {
    const A = window.__acc; A.begin()
    A.setMass(6); for(let i=0;i<6;i++)A.step(0.15)      // star form, well past spawn checks
    const asStar = A.nemesis()
    A.setMass(200); for(let i=0;i<6;i++)A.step(0.15)     // black hole, intermediate+
    return { asStar, asBH: A.nemesis() }
  })
  ok('no apex predator before the black hole', nem.asStar===null)
  ok('apex predator appears once a black hole', nem.asBH!==null, JSON.stringify(nem.asBH))

  // threat density: low early, capped later (owner: 고질량 45% was too dense)
  const dens = await page.evaluate(() => {
    const A=window.__acc, out={}
    for (const m of [1.5, 200]) {
      A.begin(); A.setMass(m); A.step(0.1)
      let riv=0, tot=0
      for (let r=0;r<3;r++){ A.clearObjs(); A.setMass(m); A.step(0.1)
        for (const o of A.objInfo()){ tot++; if(o.t==='rival')riv++ } }
      out[m] = Math.round(riv/tot*100)
    }
    return out
  })
  ok('early threat density is low', dens[1.5]<=14, `${dens[1.5]}%`)
  ok('late threat density capped (<=32%)', dens[200]<=32, `${dens[200]}%`)

  // regression: growth through the whole arc still works
  const grew = await page.evaluate(async () => {
    const A = window.__acc, runs=[]
    for (let r=0;r<5;r++){ A.begin(); const m0=A.state.mass
      for (let k=0;k<12;k++){ A.eatNearest(); A.step(0.4) }
      runs.push({ m0, m1:A.state.mass, f:A.form().name }) }
    runs.sort((a,b)=>(a.m1-a.m0)-(b.m1-b.m0))
    return runs[2]  // 초반 고분산 → 5회 중앙값(lategame·p4·codex·eat과 동일 처리)
  })
  ok('regression: can grow across forms', grew.m1>grew.m0, `${grew.m0} → ${grew.m1} (${grew.form})`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
