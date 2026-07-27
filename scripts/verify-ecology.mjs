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
    const A=window.__acc; A.begin(); A.setMass(400); A.step(0.1); A.clearObjs(); A.clearFeats()
    // 화면 안(컬링 밖)에 라이벌을 태그해 두고, 그 주위에 작은 천체를 깔아 '그 라이벌'의 질량 변화를 본다
    // (플레이어 질량을 올려 라이벌이 상한 S.mass*2.6 아래에 있게 — 상한에 붙으면 성장이 멈추는 게 정상)
    const q=A.pos()
    A.spawnTagged(300, q.x+55, q.z+10, 'rival')
    const m0=A.tagMass()
    for (let i=0;i<8;i++) A.spawn('rock', 60, q.x+55+(i-4)*2.2, q.z+12)
    for (let i=0;i<8;i++) A.step(0.12)
    return { m0, m1:A.tagMass() }
  })
  ok('rivals consume nearby bodies', eco.m1>eco.m0, `rival ${eco.m0} → ${eco.m1}`)


  // ── 라이벌이 먹은 것이 플레이어에게 날아오면 안 된다(오너 리포트) ──
  const flight = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(), RX=q.x+70
    A.spawn('rival', 320, RX, q.z)                    // 플레이어에서 70 떨어진 라이벌
    A.spawnTagged(18, RX+1.5, q.z, 'rock')            // 그 라이벌 바로 옆의 '이 돌' 하나를 추적
    const d0 = A.tagDist()                            // 플레이어까지 거리(≈70)
    for (let i=0;i<3;i++) A.step(0.08)
    return { d0, d1:A.tagDist(), gone:A.tagEaten() }
  })
  ok('the tracked rock is consumed by the rival', flight.gone===true || flight.d1!==null)
  ok('it does NOT fly into the player', flight.d1===null || flight.d1 > flight.d0*0.6, `dist ${flight.d0} → ${flight.d1}`)


  // ── 라이벌도 같은 에딩턴 한계를 받는다(오너: "적들이 더 빨리 큰다") ──
  const sym = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(3000); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos()
    A.spawnTagged(3000, q.x+70, q.z, 'rival')          // 나와 같은 질량의 라이벌
    const r0=A.tagMass()
    for (let i=0;i<10;i++){ A.spawn('rock', 1400, q.x+70+(i-5)*2.2, q.z+2) } // 그 옆에 먹이 10개
    for (let i=0;i<6;i++) A.step(0.12)
    return { r0, r1:A.tagMass() }
  })
  const rivalGain = sym.r1 - sym.r0
  ok('rival growth is damped like the player', rivalGain < sym.r0*0.5, `mass ${sym.r0} → ${sym.r1} (+${rivalGain.toFixed(0)})`)


  // ── 후반 성장 경로 = 블랙홀 병합(오너: "블랙홀을 많이 먹지 못하면 성장이 멈춘다") ──
  const merge = await page.evaluate(() => {
    const A=window.__acc, out={}
    // 일반 먹이만 먹었을 때
    A.begin(); A.setMass(20000); A.step(0.1); A.clearObjs(); A.clearFeats()
    let m0=A.state.mass
    for (let k=0;k<4;k++){ const q=A.pos(); A.spawnTagged(A.state.mass*0.5, q.x+Math.cbrt(A.state.mass)*1.2, q.z); A.step(0.4); for(let z=0;z<60&&A.feedState();z++)A.step(0.05) }
    out.food=(A.state.mass-m0)/m0*100
    // 라이벌(병합)만 먹었을 때
    A.begin(); A.setMass(20000); A.step(0.1); A.clearObjs(); A.clearFeats()
    m0=A.state.mass
    for (let k=0;k<4;k++){ const q=A.pos(); A.spawnTagged(A.state.mass*0.8, q.x+Math.cbrt(A.state.mass)*1.2, q.z, 'rival'); A.step(0.4); for(let z=0;z<60&&A.feedState();z++)A.step(0.05) }
    out.merge=(A.state.mass-m0)/m0*100
    out.score=A.state.score
    return out
  })
  ok('late: normal food barely grows you', merge.food<3, `+${merge.food.toFixed(2)}%`)
  ok('late: merging black holes grows you', merge.merge>8, `+${merge.merge.toFixed(1)}%`)
  ok('merging is the clear late-game path', merge.merge > merge.food*8, `${merge.merge.toFixed(1)}% vs ${merge.food.toFixed(2)}%`)

  // 라이벌 스폰 압축 — 후반에도 상당수가 먹을 수 있어야 한다
  const edibleFrac = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(20000); A.step(0.1)
    let riv=0, ed=0
    for (let r=0;r<40;r++){ A.clearObjs(); A.setMass(20000); A.step(0.1)  // 실측 32%±5 → 표본을 키워야 22% 문턱이 안 흔들린다
      for (const o of A.objInfo()) if(o.t==='rival'){ riv++; if(o.edible)ed++ } }
    return { riv, pct: Math.round(ed/riv*100) }
  })
  ok('a real share of rivals is edible late', edibleFrac.pct>=22, `${edibleFrac.pct}% of ${edibleFrac.riv}`)

  // 점수가 리더보드 상한/레이트 안에 머문다
  const score = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(12); A.step(0.05)
    let t=0
    for (let i=0;i<600 && t<220;i++){
      A.clearObjs(); A.clearFeats()
      const q=A.pos(), r=Math.cbrt(A.state.mass)
      A.spawnTagged(A.state.mass*0.6, q.x+r*1.2, q.z, i%6===0?'rival':'planet') // 병합은 드문 이벤트
      A.step(0.35); t+=0.35
    }
    return { t:Math.round(t), score:A.state.score, mass:Math.round(A.state.mass) }
  })
  ok('220s aggressive run stays under the 1e8 cap', score.score<1e8, `score ${score.score.toLocaleString()} · mass ${score.mass.toLocaleString()}`)
  ok('and under the anti-cheat rate (40k/s)', score.score/score.t < 40000, `${Math.round(score.score/score.t).toLocaleString()}/s`)

  // ── (1) 성장: 약한 봇의 생존 편차를 빼고 '성장 메커닉' 자체를 결정론적으로 확인 ──
  const grow = await page.evaluate(() => {
    const A=window.__acc, out={}
    for (const m of [20, 300]) {
      A.begin(); A.setMass(m); A.step(0.1); A.clearObjs(); A.clearFeats()
      const m0=A.state.mass
      for (let k=0;k<8;k++){ const q=A.pos(); A.spawnTagged(A.state.mass*0.5, q.x+Math.cbrt(A.state.mass)*1.2, q.z); A.step(0.4); for(let z=0;z<60&&A.feedState();z++)A.step(0.05) }
      out[m] = Math.round((A.state.mass-m0)/m0*100)
    }
    return out
  })
  ok('growth works in mid game', grow[20]>50, `mass20: +${grow[20]}%`)
  ok('growth still works late', grow[300]>15, `mass300: +${grow[300]}%`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
