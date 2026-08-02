// Late-game verification — movement no longer collapses at high mass,
// and threat (rivals) escalates as you grow. (owner: "커질수록 멈추는 느낌 + 커지면 안 무섭다")
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

// distance traveled over 0.5s at steady glide, mass pinned to M
async function travel(M) {
  return await page.evaluate((M) => {
    const A = window.__acc
    A.begin(); A.setTarget(600, 0)
    for (let i=0;i<8;i++){ A.setMass(M); A.step(0.1) }      // reach steady glide (mass pinned)
    const p0 = A.pos()
    for (let i=0;i<5;i++){ A.setMass(M); A.step(0.1) }      // 0.5s travel
    const p1 = A.pos()
    return Math.hypot(p1.x-p0.x, p1.z-p0.z)
  }, M)
}
// rival share of a FRESH field at this tier — averaged over 3 refills (low variance)
async function rivalShare(M) {
  return await page.evaluate((M) => {
    const A = window.__acc
    A.begin()
    for (let i=0;i<3;i++){ A.setMass(M); A.step(0.05) }     // settle tierIdx to tier(M)
    let total=0, rivals=0, threats=0
    for (let r=0;r<24;r++){   // 라이벌 위협 비율 이론값 ~53% — 3회(14개 표본)로는 동전 던지기라 흔들린다
      A.clearObjs(); A.setMass(M); A.step(0.1)              // refill field fresh at this tier
      const info = A.objInfo()
      total += info.length
      rivals += info.filter(o => o.t==='rival').length
      threats += info.filter(o => o.t==='rival' && !o.edible).length
    }
    return { total, rivals, threats, share: total? rivals/total : 0, tier: A.state.tier }
  }, M)
}

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.objInfo, { timeout:15000 })
  ok('boot', true)

  // 1) movement no longer collapses — big mass travels AT LEAST as far as small (here: farther)
  const dSmall = await travel(1.2)
  const dBig   = await travel(120)
  ok('movement does NOT collapse at high mass', dBig > dSmall * 1.3, `small=${dSmall.toFixed(1)} big=${dBig.toFixed(1)} (×${(dBig/dSmall).toFixed(2)})`)

  // 2) threat escalates — rivals are a larger share of the field when big
  const rSmall = await rivalShare(1.2)
  const rBig   = await rivalShare(120)
  ok('rival share grows with size', rBig.share > rSmall.share * 1.5, `small=${(rSmall.share*100).toFixed(0)}%(${rSmall.tier}) big=${(rBig.share*100).toFixed(0)}%(${rBig.tier})`)
  ok('most big-tier rivals are deadly (bigger than you)', rBig.threats > rBig.rivals * 0.5, `threats=${rBig.threats}/${rBig.rivals} rivals`)

  // 3) regression — early game still spawns edible planets, growth works, no errors
  const early = await rivalShare(1.2)
  ok('early game still mostly food (rivals < 30%)', early.share < 0.30, `${(early.share*100).toFixed(0)}%`)
  // 초반은 원래 고분산(약한 봇은 ~5% 확률로 급사) → 단일 런으로 성장을 단정하면 테스트가 흔들린다.
  // 5회 중앙값으로 '성장 메커닉이 살아있는가'를 본다.
  const grew = await page.evaluate(async () => {
    const A = window.__acc, runs=[]
    for (let r=0;r<5;r++){ A.begin(); const m0=A.state.mass
      for (let k=0;k<14;k++){ A.eatNearest(); A.step(0.4) }
      runs.push({ m0, m1:A.state.mass }) }
    runs.sort((a,b)=>(a.m1-a.m0)-(b.m1-b.m0))
    return runs[2]
  })
  ok('regression: growth intact (5회 중앙값)', grew.m1 > grew.m0, `${grew.m0} → ${grew.m1.toFixed(2)}`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
  // ── 종착점: 은하 중심(Sgr A*) ──
  // 조건이 '질량 2,365,000'이던 시절, 실측 544런 중 도달 0건 · 역대 최고도 209,304(8.8%)로
  // 게임이 종착점이라 부르는 곳에 아무도 닿은 적이 없었다. 이제 퀘이사 티어면 도전할 수 있다.
  const coreTravel = (m) => page.evaluate((m) => {
    const A=window.__acc
    A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(m)
    const before=A.state.mass
    let n=0
    while(!A.coreState().eaten && A.state.alive && n<3000){
      const cp=A.corePos(); A.setTarget(cp.x,cp.z); A.step(0.05,20); n++
      if(n%10===0) A.clearField()          // 이동 중 천적에게 뜯기면 기전이 아니라 조우를 재게 된다
    }
    return { eaten:A.coreState().eaten, alive:A.state.alive,
             before:Math.round(before), after:Math.round(A.state.mass) }
  }, m)

  const quasar = await coreTravel(40000)
  ok('core: a QUASAR-tier hole reaches and swallows it', quasar.eaten===true&&quasar.alive===true,
     `${quasar.before.toLocaleString()} → ${quasar.after.toLocaleString()}`)
  ok('core: swallowing it is a real jump (not a rounding error)', quasar.after>quasar.before*10,
     `×${(quasar.after/quasar.before).toFixed(1)}`)
  const small = await coreTravel(3000)
  ok('core: below QUASAR you are the one eaten', small.eaten===false&&small.alive===false,
     `eaten=${small.eaten} alive=${small.alive}`)

  // 나침반 — 목적지는 보여야 끌어당긴다
  const comp = await page.evaluate(async () => {
    const A=window.__acc, f=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))
    const row=()=>document.getElementById('coreRow').style.display!=='none'
    A.begin(); A.hideOnboard(); A.setMass(300); A.step(0.3); await f()
    const low=row()
    A.setMass(40000); A.step(0.3); await f()
    return { low, high:row(), txt:document.getElementById('cval').textContent }
  })
  ok('core: compass hidden before SUPERMASSIVE', comp.low===false, String(comp.low))
  ok('core: compass shows bearing + distance once you can look for it', comp.high===true&&/[↑↗→↘↓↙←↖]/.test(comp.txt),
     comp.txt)

  // 병합 경제에 제동이 남아 있는가 — 감쇠를 없앴더니 220초 완전 플레이에 7.4e17로 폭주했다
  const runaway = await page.evaluate(() => {
    const A=window.__acc
    const one=(m)=>{ A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(m)
      const c=A.pos(), hr=Math.cbrt(m)
      A.spawn('rival', m*0.8, c.x+hr*1.2, c.z)
      for(let i=0;i<40;i++){ A.eatNearest(); A.step(0.05,20) }
      return (A.state.mass-m)/m }
    return { low:one(500), high:one(5e5) }
  })
  ok('merge economy still brakes at high mass (no runaway)', runaway.high < runaway.low*0.25,
     `+${(runaway.low*100).toFixed(0)}% @500 → +${(runaway.high*100).toFixed(2)}% @500K`)

  // 후반 맵이 계속 같아 보이던 문제 — 초대질량부터 지형이 하나 늘어난다
  const feats = await page.evaluate(() => {
    const A=window.__acc, out={}
    for(const [k,m] of [['bh',300],['smbh',4000]]){
      A.begin(); A.hideOnboard(); A.setMass(m)
      for(let i=0;i<8;i++)A.step(0.25)
      out[k]=A.featCount?A.featCount():null }
    return out
  })
  ok('map keeps growing: more terrain from SUPERMASSIVE', feats.smbh>feats.bh,
     `${feats.bh} → ${feats.smbh}`)

  // ── 런 리듬 이벤트 — 같은 밀도로 계속 먹기만 하면 시간이 평평해진다 ──
  const ev = await page.evaluate(() => {
    const A=window.__acc, out={}
    A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(3000)
    const n0=A.objInfo().length
    A.fireEvent('stream'); A.step(0.1)
    out.stream={ added:A.objInfo().length-n0, tagged:A.streamCount(), rec:A.eventState().streams }
    A.clearField()
    const p0=A.pos(), f0=A.featCount()
    A.spawn('giant', 300, p0.x+20, p0.z)
    const before=A.objInfo()[0]
    A.fireEvent('blast'); A.step(0.05,20)
    out.blast={ ring:A.eventState().ring, feats:A.featCount()-f0, rec:A.eventState().blasts }
    // 형태 게이트 — 원시별 구간엔 사건이 없다(기본기에 집중)
    A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(2)
    for(let i=0;i<60;i++){ A.step(1.0); if(i%5===0)A.clearField() }
    out.proto=A.eventState().streams+A.eventState().blasts
    // 블랙홀이 되면 주기적으로 온다
    A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(3000)
    for(let i=0;i<80;i++){ A.step(1.0); if(i%5===0)A.clearField() }
    out.bh={ n:A.eventState().streams+A.eventState().blasts, s:A.eventState().streams, b:A.eventState().blasts }
    return out
  })
  ok('event: stellar stream lays down a chain of stars', ev.stream.added>=12&&ev.stream.rec===1,
     `${ev.stream.added}개 · 흐름표시 ${ev.stream.tagged}`)
  ok('event: shock breakout rings out and leaves a remnant', ev.blast.ring===true&&ev.blast.feats>=1&&ev.blast.rec===1,
     `ring=${ev.blast.ring} 지형+${ev.blast.feats}`)
  ok('event: none while still a protostar', ev.proto===0, `${ev.proto}건/60s`)
  ok('event: both kinds arrive once you are a black hole', ev.bh.n>=2&&ev.bh.s>=1&&ev.bh.b>=1,
     `80초에 ${ev.bh.n}건(흐름 ${ev.bh.s} · 충격파 ${ev.bh.b})`)

  // ── 후반 천체 구성 — 40,000 이후가 전부 같았다 ──
  const roster = await page.evaluate(() => {
    const A=window.__acc
    const at=(m)=>{ A.begin(); A.hideOnboard(); A.setMass(m)
      const k={}
      for(let r=0;r<25;r++){ A.clearObjs(); A.setMass(m); A.step(0.1)
        for(const o of A.objInfo()) k[o.t]=(k[o.t]||0)+1 }
      return k }
    return { smbh:at(4000), quasar:at(40000), ultra:at(3e5) }
  })
  ok('roster: S-stars only from QUASAR', !roster.smbh.sstar && roster.quasar.sstar>0,
     `초대질량 ${roster.smbh.sstar||0} → 퀘이사 ${roster.quasar.sstar}`)
  ok('roster: galactic nuclei only at ULTRAMASSIVE', !roster.quasar.nucleus && roster.ultra.nucleus>0,
     `퀘이사 ${roster.quasar.nucleus||0} → 극대질량 ${roster.ultra.nucleus}`)
  ok('roster: QUASAR and ULTRAMASSIVE no longer look the same',
     Math.abs((roster.quasar.sstar||0)-(roster.ultra.sstar||0))>10 || (roster.ultra.nucleus||0)>10,
     `sstar ${roster.quasar.sstar}/${roster.ultra.sstar} · nucleus ${roster.quasar.nucleus||0}/${roster.ultra.nucleus}`)

  // ── 승격이 '나'도 바꾸는가 ──
  // 질량 20에서 블랙홀이 된 뒤로 8자릿수·5티어 동안 아바타가 한 번도 안 변했다(오너 지적).
  // 물리 근거 둘: 원반 온도 T ∝ M^(-1/4) · 원반 바깥은 자기중력으로 잘려 고질량일수록 지평선에 붙는다.
  const look = await page.evaluate(() => {
    const A=window.__acc, out=[]
    A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField()
    for(const m of [25,400,4000,40000,3e5]){
      A.setMass(m); for(let i=0;i<6;i++){ A.step(0.15); A.clearField(); A.setMass(m) }
      out.push({ m, ...A.diskColor(), ...A.diskShape() })
    }
    return out
  })
  const T=look.map(x=>x.temp), OUT=look.map(x=>x.out)
  ok('look: disk temperature steps with every tier', T.join()==='0,0.25,0.5,0.75,1', T.join(' → '))
  ok('look: the disk visibly cools (blue drops)',
     parseInt(look[0].a.slice(5,7),16) - parseInt(look[4].a.slice(5,7),16) > 60,
     `${look[0].a} → ${look[4].a}`)
  ok('look: the disk tightens onto the horizon as mass grows',
     OUT.every((v,i)=>i===0||v<OUT[i-1]) && OUT[4] < OUT[0]*0.85,
     OUT.join(' → '))
  // 스킨은 정체성을 잃지 않는다 — 고정색 보간으로 했더니 AURORA가 올리브가 됐다
  const skin = await page.evaluate(() => {
    const A=window.__acc, o={}
    A.begin(); A.hideOnboard(); A.setMass(3e5); A.step(0.2)
    for(const id of ['void','solar','aurora']){ A.applySkin(id); o[id]=A.diskColor().a }
    A.applySkin('void')
    return o
  })
  ok('look: skins stay distinguishable at max mass',
     new Set(Object.values(skin)).size===3, JSON.stringify(skin))

} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
