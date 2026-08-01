// STEP 2 — cosmic features: nebula (safe haven), wormhole (escape), remnant (big reward).
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
  await page.waitForFunction(() => window.__acc && window.__acc.feats, { timeout:15000 })
  ok('boot: feature hooks present', true)

  // gated: no features while a planetesimal (early game stays about basics)
  const early = await page.evaluate(() => { const A=window.__acc; A.begin(); A.setMass(2); A.step(0.5); return A.feats().length })
  ok('no features in the planetesimal stage', early===0, `${early}`)

  // they appear once you ignite
  const later = await page.evaluate(() => { const A=window.__acc; A.begin(); A.setMass(8); for(let i=0;i<4;i++)A.step(0.4); return A.feats() })
  ok('features appear from the star stage', later.length>=1, JSON.stringify(later))

  // NEBULA — mass regenerates while inside (beats evaporation)
  const neb = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(30); A.step(0.1); A.clearObjs(); A.clearFeats()
    A.spawnFeat('nebula',0,0)                      // centred on the player
    const m0=A.state.mass; for(let i=0;i<6;i++)A.step(0.25)
    return { m0, m1:A.state.mass, codex:A.codex().seen.includes('nebula') }
  })
  ok('NEBULA regenerates mass while inside', neb.m1>neb.m0, `${neb.m0} → ${neb.m1.toFixed(1)}`)
  ok('NEBULA records its codex fact', neb.codex===true)

  // outside a nebula, evaporation still wins (no free lunch)
  const drain = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(30); A.step(0.1); A.clearObjs(); A.clearFeats()
    const m0=A.state.mass; for(let i=0;i<6;i++)A.step(0.25)
    return { m0, m1:A.state.mass }
  })
  ok('outside it, mass still drains', drain.m1<drain.m0, `${drain.m0} → ${drain.m1.toFixed(1)}`)

  // WORMHOLE — teleports you far away (the escape valve)
  const worm = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(30); A.step(0.1); A.clearObjs(); A.clearFeats()
    const p0=A.pos(); A.spawnFeat('wormhole',0,0); A.step(0.1)
    const p1=A.pos()
    // 사용한 웜홀은 제거된다(필드가 곧 새 웜홀을 리필하므로 '내 위치 근처에 없음'으로 확인)
    return { moved:Math.hypot(p1.x-p0.x,p1.z-p0.z), codex:A.codex().seen.includes('wormhole'), nearby:A.feats().filter(f=>f.t==='wormhole'&&f.d<25).length }
  })
  ok('WORMHOLE teleports the player far', worm.moved>50, `${worm.moved.toFixed(0)} units`)
  ok('WORMHOLE is consumed on use', worm.nearby===0, `nearby=${worm.nearby}`)
  ok('WORMHOLE records its codex fact', worm.codex===true)

  // REMNANT — big one-shot mass + score
  const rem = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(30); A.step(0.1); A.clearObjs(); A.clearFeats()
    const m0=A.state.mass, s0=A.state.score
    A.spawnFeat('remnant',0,0); A.step(0.1)
    return { dm:A.state.mass-m0, ds:A.state.score-s0, codex:A.codex().seen.includes('remnant') }
  })
  ok('REMNANT grants a large mass reward', rem.dm>5, `+${rem.dm.toFixed(1)} mass`)
  ok('REMNANT grants score', rem.ds>0, `+${rem.ds}`)
  ok('REMNANT records its codex fact', rem.codex===true)

  // codex grew to 19 and skins re-tuned
  const cdx = await page.evaluate(() => ({ total: window.__acc.codex().total }))
  ok('codex now has 33 entries', cdx.total===33, `${cdx.total}`)

  // regression: restarting clears features, growth still works
  const reg = await page.evaluate(async () => {
    const A=window.__acc; A.begin(); const f=A.feats().length
    // 결정론적 확인 — 필드를 비우고 확실한 먹이만 옆에 두고 먹는다(위협·충돌 변수 제거)
    A.clearObjs(); A.clearFeats(); const m0=A.state.mass
    for(let k=0;k<6;k++){ const q=A.pos(); A.spawnTagged(A.state.mass*0.5, q.x+Math.cbrt(A.state.mass)*1.2, q.z); A.step(0.4) }
    return { f, grew:A.state.mass>m0 }
  })
  ok('begin() clears features', reg.f===0)
  ok('regression: growth intact', reg.grew===true)

  // 콤보 단계 — 연속 포식이 강착률을 끌어올린다(초에딩턴 → 원반 플레어 → 블레이자)
  {
    const r = await page.evaluate(()=>{
      const A=window.__acc
      A.begin();A.hideOnboard();A.setSpawn(false);A.setMass(60000);A.step(0.3);A.clearField()
      const c=A.pos(),hr=A.jetProbe().hr
      const seen={}
      for(let i=0;i<26;i++){
        A.spawn('planet',60000*0.05,c.x+hr*0.4,c.z);A.step(0.06)
        const cb=A.state.combo
        if(cb===5||cb===10||cb===20)seen[cb]={slots:A.feedSlots()}}
      A.setSpawn(true)
      return seen})
    ok('콤보 5 도달(SUPER-EDDINGTON)', !!r[5], JSON.stringify(r[5]||null))
    ok('콤보 10 도달(DISK FLARE)', !!r[10], JSON.stringify(r[10]||null))
    ok('콤보 20에서 흐름 슬롯이 늘어난다(BLAZAR)', !!r[20]&&r[20].slots>=4, JSON.stringify(r[20]||null))
  }

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
