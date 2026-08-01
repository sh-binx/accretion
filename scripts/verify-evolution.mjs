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

  // ── 진화 선택(EVO_BOONS) ──
  const ch = await page.evaluate(async () => {
    const A=window.__acc, R={}
    A.choiceReal(true); A.begin(); A.hideOnboard()
    R.idle = A.choiceOn()                                   // 시작 직후엔 닫혀 있다
    A.setMass(A.tierMass(1))                                // 첫 티어 승격 → 열림
    A.step(0.2)
    R.opened = A.choiceOn(); R.opts = A.choiceOpts()
    // 열려 있는 동안 게임은 멈춘다 — frame() 게이트
    const p0=A.pos(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))
    const p1=A.pos(); R.frozen = Math.hypot(p1.x-p0.x,p1.z-p0.z) < 0.01
    A.takeBoon(0)
    R.taken = A.boons(); R.closed = !A.choiceOn()
    // 남은 승격마다 다시 열리고, 이미 고른 보온은 후보로 재등장하지 않는다
    let dup=false, reopened=0
    for(let t=2;t<=4;t++){ A.setMass(A.tierMass(t)); A.step(0.2)
      if(A.choiceOn()){ reopened++
        if(A.choiceOpts().some(id=>A.boons().includes(id))) dup=true
        A.takeBoon(0) } }
    R.noDup = !dup; R.reopened = reopened; R.boonCount = A.boons().length
    return R
  })
  ok('choice: closed at run start', ch.idle===false, String(ch.idle))
  ok('choice: opens on tier-up with 3 options', ch.opened===true&&ch.opts.length===3, `${ch.opened} ${JSON.stringify(ch.opts)}`)
  ok('choice: game frozen while open', ch.frozen===true, String(ch.frozen))
  ok('choice: pick applies and closes', ch.taken.length===1&&ch.closed, `${JSON.stringify(ch.taken)} closed=${ch.closed}`)
  ok('choice: reopens on every later tier-up', ch.reopened===3, `${ch.reopened}/3 · 보유 ${ch.boonCount}`)
  ok('choice: taken boon never re-offered', ch.noDup===true, `보유 ${ch.boonCount}`)

  // 보온 효과가 실제 수치에 반영된다 — 선언만이 아니라 계산에
  const eff = await page.evaluate(async () => {
    const A=window.__acc
    A.begin(); A.hideOnboard(); A.setMass(60)
    const base=A.pullRadius()
    A.giveBoon('wide')                                       // reach +14%
    return { base, after:A.pullRadius() }
  })
  // 위조 질량이 아니라 '실제로 먹어서' 오른 티어에서도 뜬다 — 스킵 플래그가 기능을 가리지 않는지
  const real = await page.evaluate(async () => {
    const A=window.__acc; A.begin(); A.hideOnboard()      // choiceReal 없이 — 순수 프로덕션 경로
    for(let i=0;i<400;i++){ const c=A.pos()
      A.spawn('giant',Math.max(1.5,A.state.mass*0.9),c.x+6,c.z)
      A.eatNearest(); A.step(0.3)
      if(A.choiceOn()) return { opened:true, mass:Math.round(A.state.mass), tier:A.state.tier } }
    return { opened:false, mass:Math.round(A.state.mass) }
  })
  ok('choice: opens on growth-driven tier-up (no setMass)', real.opened===true,
     `${real.mass} · ${real.tier||''}`)

  // 선택 중엔 능력이 잠긴다 — 정지 화면에서 에너지·쿨다운을 잃으면 안 된다
  const lock = await page.evaluate(async () => {
    const A=window.__acc
    A.choiceReal(true); A.begin(); A.hideOnboard(); A.setEnergy(3)
    A.setMass(A.tierMass(1)); A.step(0.2)
    const e0=A.state.energy
    A.doSurge(); A.doPulse()
    const e1=A.state.energy, surging=A.state.surging
    A.takeBoon(0); A.doSurge()                              // 닫힌 뒤엔 정상 발동
    return { open:A.choiceOn(), e0, e1, surging, after:A.state.surging }
  })
  ok('choice: abilities locked while open', lock.e1===lock.e0&&lock.surging===false,
     `energy ${lock.e0}→${lock.e1} · surging ${lock.surging}`)
  ok('choice: abilities work again after picking', lock.after===true, String(lock.after))

  ok('boon changes the real number (pull radius)', eff.after>eff.base*1.10,
     `${eff.base.toFixed(2)} → ${eff.after.toFixed(2)}`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
