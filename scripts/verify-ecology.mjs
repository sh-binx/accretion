// Owner: (1) 후반 성장이 너무 힘들다 (2) 적들끼리도 상호작용해야 (3) 블랙홀 아닐 땐 더 큰 천체에 부딪히면 부서져야
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
  await page.waitForFunction(() => window.__acc && window.__acc.objInfo, { timeout:15000 })
  ok('boot', true)

  // ── (3) size hierarchy: as a rock/star, bigger bodies are NOT food ──
  const hier = await page.evaluate(() => {
    const A=window.__acc, out={}
    for (const m of [2, 8]) {                       // planetesimal, star
      A.begin(); A.setMass(m); A.step(0.1)
      let big=0, bigEdible=0
      for (let r=0;r<6;r++){ A.clearObjs(); A.setMass(m); A.step(0.1)
        for (const o of A.objInfo()){ if(o.t!=='rival'&&o.bigger){ big++; if(o.edible)bigEdible++ } } }
      out[m] = { big, bigEdible }
    }
    return out
  })
  ok('bigger bodies now spawn in the rock stage', hier[2].big>0, `${hier[2].big} found`)
  ok('rock cannot eat bigger bodies', hier[2].bigEdible===0, `${hier[2].bigEdible} edible`)
  ok('star cannot eat bigger bodies', hier[8].bigEdible===0, `${hier[8].bigEdible} edible`)

  // colliding with one shatters both (not instant death)
  const coll = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(6); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(); A.spawn('planet', 14, q.x+2.0, q.z)   // heavier than us, right next to us
    const m0=A.state.mass; A.step(0.06)
    const after=A.objInfo().filter(o=>o.t==='planet')
    return { m0, m1:A.state.mass, alive:A.state.alive, codex:A.codex().seen.includes('collision'),
             theirMass: after.length?after[0].mass:null }
  })
  ok('collision costs the player mass', coll.m1<coll.m0, `${coll.m0} → ${coll.m1.toFixed(1)}`)
  ok('collision is not instant death', coll.alive===true)
  ok('the other body shatters too', coll.theirMass!==null && coll.theirMass<14, `14 → ${coll.theirMass}`)
  ok('collision records its codex fact', coll.codex===true)

  // ── black holes swallow anything (the payoff for evolving) ──
  const bh = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats()
    A.spawn('planet', 220); A.step(0.05)
    return A.objInfo().filter(o=>o.t==='planet').map(o=>o.edible)
  })
  ok('black hole can eat bodies bigger than itself', bh.length>0 && bh.every(Boolean), JSON.stringify(bh))

  // ── (2) rivals eat other objects (field self-regulates) ──
  const eco = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats()
    // 화면 안(컬링 밖)에 라이벌을 태그해 두고, 그 주위에 작은 천체를 깔아 '그 라이벌'의 질량 변화를 본다
    const q=A.pos()
    A.spawnTagged(300, q.x+55, q.z+10, 'rival')
    const m0=A.tagMass()
    for (let i=0;i<8;i++) A.spawnTagged ? A.spawn('rock', 18, q.x+55+(i-4)*2.2, q.z+12) : 0
    for (let i=0;i<8;i++) A.step(0.12)
    return { m0, m1:A.tagMass() }
  })
  ok('rivals consume nearby bodies', eco.m1>eco.m0, `rival ${eco.m0} → ${eco.m1}`)

  // ── (1) late-game growth is materially better ──
  const grow = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(12); A.step(0.05)
    let t=0
    for (let i=0;i<200 && A.state.alive;i++){
      A.eatNearest(); A.step(0.4); t+=0.4
      if (t>=60) break
    }
    return { t:Math.round(t), mass:Math.round(A.state.peak), alive:A.state.alive }
  })
  ok('60s of real play reaches a decent size', grow.mass>200, `peak ${grow.mass.toLocaleString()}`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
