// Mid/late-game pressure tuning (owner: "거대 블랙홀이 되면 적이 너무 많고 다음 단계로 가기 어렵다")
// Checks: smooth threat ramp (no cliff at tier borders), capped late threat, graze charges surge.
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
  await page.waitForFunction(() => window.__acc && window.__acc.accEff, { timeout:15000 })
  ok('boot', true)

  // threat share across the black-hole climb
  const t = await page.evaluate(() => {
    const A=window.__acc, out={}
    for (const m of [20,50,100,200,5000]) { // 5티어 확장으로 400은 20과 너무 가까워 노이즈 → 간격 확대
      A.begin(); A.setMass(m); A.step(0.1)
      let tot=0, threat=0
      for (let r=0;r<12;r++){ A.clearObjs(); A.setMass(m); A.step(0.1)   // 표본 확대 — 위협 비율은 분산이 커서 4회로는 흔들림
        for (const o of A.objInfo()){ tot++; if(o.t==='rival'&&!o.edible)threat++ } }
      out[m] = Math.round(threat/tot*100)
    }
    return out
  })
  ok('early game stays gentle', t[20]<=16, `mass20 = ${t[20]}%`)
  ok('no cliff at the INTERMEDIATE border', (t[50]-t[20])<=8, `20→50: ${t[20]}% → ${t[50]}%`)
  ok('late threat share capped', t[5000]<=22, `mass5000 = ${t[5000]}%`)
  ok('threat still rises with size (not flat)', t[5000]>t[20], `${t[20]}% → ${t[5000]}%`)

  // grazing a lethal black hole charges surge — the escape valve when surrounded
  const graze = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1)
    A.clearObjs(); A.setEnergy(0)
    const q=A.pos(), omouth=Math.cbrt(200)*1.55       // rival's kill radius
    A.spawn('rival', 200, q.x+omouth*1.45, q.z)        // inside near-miss ring, outside kill ring
    A.step(0.05)
    return { energy:A.state.energy, alive:A.state.alive }
  })
  ok('graze charges surge', graze.energy>0.1, `energy=${graze.energy}`)
  ok('graze does not kill (near-miss ring)', graze.alive===true)

  // Eddington still bounds growth (no runaway) but eases the mid climb
  const eff = await page.evaluate(() => { const A=window.__acc, o={}
    for (const m of [50,100,400,5000]){ A.begin(); A.setMass(m); A.step(0.05); o[m]=A.accEff() } return o })
  ok('no damping during the early black-hole climb', eff[50]===1, `mass50 eff=${eff[50]}`)
  ok('damping still active at high mass', eff[5000]<0.05, `mass5000 eff=${eff[5000].toFixed(4)}`)

  // regression: still reaches the tiers under steady feeding
  const climb = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(12); A.step(0.05)
    let t=0, t160=null
    for (let i=0;i<200 && A.state.alive && !t160;i++){
      A.clearObjs(); const q=A.pos(), r=Math.cbrt(A.state.mass)
      A.spawnTagged(A.state.mass*0.5, q.x+r*1.2, q.z); A.step(0.5); t+=0.5
      if (A.state.mass>=160) t160=t
    }
    return { t160, mass:Math.round(A.state.mass) }
  })
  ok('SUPERMASSIVE reachable under steady feeding', climb.t160!==null && climb.t160<20, `${climb.t160}s`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
