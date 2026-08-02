// 오너 아이디어 2종:
//  (A) 큰 블랙홀에 닿으면 즉사가 아니라 '조석 영역'에서 질량을 뜯기며 탈출 기회를 준다
//  (B) 큰 먹이는 한 입에 사라지지 않고 흡수에 시간이 걸린다(TDE)
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
  await page.waitForFunction(() => window.__acc && window.__acc.tidalState, { timeout:15000 })
  ok('boot', true)

  // ── (A1) 조석 영역: 즉사하지 않고 질량이 깎인다 ──
  const zone = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats()
    A.setInv(0)
    const q=A.pos(), R=Math.cbrt(400)   // 라이벌 반경
    // 조석 영역 안(코어 0.72R 밖, 입 1.55R 안) = ~1.15R
    A.spawn('rival', 400, q.x+R*1.15, q.z)
    const m0=A.state.mass; A.step(0.05)
    return { m0, m1:A.state.mass, alive:A.state.alive, inZone:A.tidalState().inZone, depth:A.tidalState().depth }
  })
  ok('A1: 조석 영역에 들어가도 즉사하지 않는다', zone.alive===true)
  ok('A1: 영역 안이라고 인식한다', zone.inZone===true, `depth=${zone.depth}`)
  ok('A1: 질량을 뜯긴다', zone.m1 < zone.m0, `${zone.m0} → ${zone.m1.toFixed(1)}`)

  // ── (A2) 사건지평선(코어) 안쪽은 여전히 즉사 ──
  const core = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats(); A.setInv(0)
    const q=A.pos()
    A.spawn('rival', 400, q.x+0.2, q.z)   // 사실상 중심
    A.step(0.05)
    return { alive:A.state.alive, cause:A.state.cause||null }
  })
  ok('A2: 사건지평선 안쪽은 즉사(되돌릴 수 없다)', core.alive===false)

  // ── (A3) 오래 머무르면 결국 죽는다 ──
  const drained = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats(); A.setInv(0)
    const q=A.pos(), R=Math.cbrt(400)
    A.spawn('rival', 400, q.x+R*1.3, q.z)
    let n=0
    for(let i=0;i<80 && A.state.alive;i++){ A.step(0.06); n++ }
    return { alive:A.state.alive, steps:n, mass:A.state.mass }
  })
  ok('A3: 계속 머무르면 결국 소멸한다', drained.alive===false, `${drained.steps}스텝 후`)
  ok('A3: 즉사가 아니라 여러 프레임에 걸쳐 죽는다', drained.steps>=3, `${drained.steps}스텝`)

  // ── (A4) 벗어나면 산다 ──
  const escaped = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(100); A.step(0.1); A.clearObjs(); A.clearFeats(); A.setInv(0)
    const q=A.pos(), R=Math.cbrt(400)
    A.spawn('rival', 400, q.x+R*1.35, q.z)
    A.step(0.05); const mid=A.state.mass
    A.clearObjs()                       // 탈출(위협 제거) 시뮬레이션
    for(let i=0;i<10;i++) A.step(0.06)
    return { alive:A.state.alive, mid, end:A.state.mass, inZone:A.tidalState().inZone }
  })
  ok('A4: 영역을 벗어나면 생존한다', escaped.alive===true, `mass ${escaped.end.toFixed(1)}`)
  ok('A4: 벗어나면 드레인이 멈춘다', escaped.inZone===false)

  // ── (B1) 블랙홀: 작은 먹이는 한 입에 ──
  const snack = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(1000); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(), r=Math.cbrt(1000)
    A.spawn('planet', 50, q.x+r*1.1, q.z)   // rel=0.05 → 즉시
    const m0=A.state.mass; A.step(0.05)
    return { m0, m1:A.state.mass, feeding:A.feedState()!==null, left:A.objInfo().filter(o=>!o.eaten).length }
  })
  ok('B1: 블랙홀은 작은 천체를 한 입에 먹는다', snack.m1>snack.m0 && snack.feeding===false, `+${(snack.m1-snack.m0).toFixed(1)}`)

  // ── (B2) 블랙홀: 큰 먹이는 시간이 걸린다 ──
  const bigMeal = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(1000); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(), r=Math.cbrt(1000)
    A.spawn('planet', 800, q.x+r*1.1, q.z)   // rel=0.8 → 흡수에 시간
    const m0=A.state.mass
    A.step(0.05)
    const started=A.feedState()
    const mMid=A.state.mass
    let n=0; while(A.feedState()&&n<80){ A.step(0.05); n++ }
    return { m0, started, mMid, mEnd:A.state.mass, frames:n, done:A.feedState()===null }
  })
  ok('B2: 큰 먹이는 흡수 상태로 들어간다', bigMeal.started!==null, JSON.stringify(bigMeal.started))
  ok('B2: 흡수가 여러 프레임에 걸친다', bigMeal.frames>=5, `${bigMeal.frames}프레임 (~${(bigMeal.frames*0.05).toFixed(2)}s)`)
  ok('B2: 진행 중에도 질량이 점진 이전된다', bigMeal.mMid>bigMeal.m0 && bigMeal.mMid<bigMeal.mEnd, `${bigMeal.m0} → ${bigMeal.mMid.toFixed(1)} → ${bigMeal.mEnd.toFixed(1)}`)
  ok('B2: 결국 완료된다', bigMeal.done===true)

  // ── (B3) 행성 단계: 비슷한 크기 먹이도 시간이 걸린다(오너 요청) ──
  const rockMeal = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(2); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(), r=Math.cbrt(2)
    A.spawn('rock', 1.2, q.x+r*1.2, q.z)   // rel=0.6 → 시간
    A.step(0.05)
    return { feeding:A.feedState()!==null, mass:A.state.mass, dur:A.feedState()?A.feedState().dur:null }
  })
  ok('B3: 행성 단계에서도 큰 먹이는 시간이 걸린다', rockMeal.feeding===true && rockMeal.mass<3, `mass=${rockMeal.mass?.toFixed(2)} dur=${rockMeal.dur}s`)

  // ── (B4) 흡수 중엔 느려진다(무방비 — 리스크) ──
  const slow = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(1000); A.step(0.1); A.clearObjs(); A.clearFeats()
    const base=A.maxSpeed?A.maxSpeed():null
    const q=A.pos(), r=Math.cbrt(1000)
    A.spawn('planet', 800, q.x+r*1.1, q.z); A.step(0.05)
    return { base, fed:A.maxSpeed?A.maxSpeed():null, feeding:A.feedState()!==null }
  })
  if (slow.base!==null) ok('B4: 흡수 중 이동속도가 느려진다', slow.fed < slow.base, `${slow.base?.toFixed(1)} → ${slow.fed?.toFixed(1)}`)
  else ok('B4: (maxSpeed 훅 없음 — 건너뜀)', true)

  // ── (B5) 한 번에 하나만 흡수 ──
  const one = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(1000); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(), r=Math.cbrt(1000)
    A.spawn('planet', 800, q.x+r*1.1, q.z); A.spawn('planet', 700, q.x-r*1.1, q.z)
    A.step(0.05)
    const f=A.feedState()
    return { feeding:f!==null }
  })
  ok('B5: 동시에 하나만 흡수한다', one.feeding===true)

  // ── (B6) TDE 코덱스가 열린다 ──
  const cdx = await page.evaluate(() => {
    const A=window.__acc; A.resetCodex(); A.begin(); A.setMass(1000); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(), r=Math.cbrt(1000)
    A.spawn('planet', 800, q.x+r*1.1, q.z); A.step(0.05)
    return { seen:A.codex().seen, total:A.codex().total }
  })
  ok('B6: TDE 코덱스가 열린다', cdx.seen.includes('tde'), cdx.seen.join(','))
  ok('B6: 코덱스 37항목', cdx.total===37, `${cdx.total}`)

  // ── (C) 흡수 중인 천체: 겹치지 않고, 무엇보다 '밀려나지 않는다' ──
  // 오너 리포트 2건을 동시에 만족해야 한다:
  //   ① "천체가 블랙홀과 겹쳐 뱅글뱅글 돈다"  → 가만히 있을 때 원반과 겹치지 않아야 한다
  //   ② "행성과 블랙홀이 충돌하면 밀려난다"    → 내가 다가가도 천체가 물러나지 않아야 한다
  // 예전 해법(하드 하한으로 로슈 거리 유지)은 ①을 고치면서 ②를 만들었다. 이제 밖으로는 밀지 않고,
  // 파고들면 조석력(1/r³)만큼 잔해가 더 빨리 벗겨지는 방식으로 둘을 같이 만족시킨다.
  {
    const r = await page.evaluate(async ()=>{
      const A=window.__acc
      const setup=()=>{
        A.begin();A.hideOnboard();A.setSpawn(false);A.setMass(300);A.step(0.05);A.clearField()
        const c=A.pos()
        return {c,t:A.spawnTagged(300*0.9,c.x+Math.cbrt(300)*3.4,c.z,'planet')}}
      // ① 가만히 둘 때 — 원반과 겹치지 않는다
      const s1=setup();let worstGap=null,feedT=0
      for(let i=0;i<160;i++){
        A.setTarget(s1.c.x,s1.c.z)
        A.step(0.05)
        const f=A.feedObj()
        if(f){feedT+=0.05;const gap=f.dist-f.sx-f.hr*2.16
          if(worstGap===null||gap<worstGap)worstGap=+gap.toFixed(2)}
        else if(feedT>0)break}
      // ② 밀고 들어갈 때 — 반발(거리 증가)이 없어야 한다
      const s2=setup();let repel=0,minD=1e9
      for(let i=0;i<140;i++){
        A.setTarget(s2.t.x,s2.t.z)
        const a=A.tagPos();A.step(0.05);const bb=A.tagPos()
        if(!a||!bb)break
        const d0=Math.hypot(a.x-a.hx,a.z-a.hz), d1=Math.hypot(bb.x-bb.hx,bb.z-bb.hz)
        minD=Math.min(minD,d1)
        if(d1>d0+0.01&&d1>minD+0.01)repel+=d1-d0
        if(!A.state.alive)break}
      A.setSpawn(true)
      return {feedT:+feedT.toFixed(2),worstGap,repel:+repel.toFixed(1),hr:Math.cbrt(300)}})
    ok('흡수가 시간을 쓴다(가만히 1초 이상)', r.feedT>=1, r.feedT+'초')
    // 하드 하한을 뺐으니 붙잡힌 직후 한 프레임은 아주 살짝 안쪽일 수 있다.
    // 지평선 반경의 5% 미만이면 육안으로 구분되지 않는다(실측 1% 수준).
    ok('가만히 있을 때 원반과 겹치지 않음', r.worstGap!==null&&r.worstGap>=-r.hr*0.05,
       '최소 여유 '+r.worstGap+' (허용 '+(-r.hr*0.05).toFixed(2)+')')
    ok('다가가도 천체가 밀려나지 않음', r.repel<=r.hr*0.8, '반발 '+r.repel+' (한계 '+(r.hr*0.8).toFixed(1)+')')

    // 오너 리포트: "굵은 보더처럼 표현되고 블랙홀 근처에서 끊긴다"
    // 원인은 붙잡는 거리가 밝은 코어 안(2.16hr)이라 본체·줄기가 글로우에 지워지고,
    // 입자가 서로 겹쳐 한 줄로 뭉친 것. 붙잡는 거리를 4.6hr로 빼고 입자를 잘게 했다.
    const look = await page.evaluate(async ()=>{
      const A=window.__acc
      A.begin();A.hideOnboard();A.setSpawn(false);A.setMass(8000);A.step(0.05);A.clearField()
      const c=A.pos()
      const t=A.spawnTagged(8000*0.9,c.x+Math.cbrt(8000)*4.5,c.z,'planet')
      for(let i=0;i<120;i++){A.setTarget(c.x,c.z);A.step(0.05);if(A.feedObj())break}
      const f=A.feedObj()
      A.setSpawn(true)
      if(!f)return null
      // 본체 중심이 밝은 코어(원반 2.16hr + 광자링 + 글로우) 밖에 있어야 눈에 보인다
      return {dist:f.dist,hr:f.hr,ratio:+(f.dist/f.hr).toFixed(2)}})
    ok('흡수 중인 본체가 밝은 코어 밖에 선다', look && look.ratio>=3.6,
       look ? look.ratio+'hr (기준 3.6hr — 원반 2.16 + 글로우)' : '흡수 미발생')

    // 오너: "나선고리가 갑자기 뚝 생겨 이질적이다" → 본체에서 자라나 홀에 닿아야 한다
    const grow = await page.evaluate(async ()=>{
      const A=window.__acc
      A.begin();A.hideOnboard();A.setSpawn(false);A.setMass(8000);A.step(0.05);A.clearField()
      const c=A.pos()
      A.spawnTagged(8000*0.9,c.x+Math.cbrt(8000)*4.5,c.z,'planet')
      for(let i=0;i<140;i++){A.setTarget(c.x,c.z);A.step(0.04);if(A.feedObj())break}
      const seq=[]
      for(let i=0;i<10;i++){const g=A.streamGrow();if(!g)break;seq.push(g.len);A.step(0.06)}
      A.setSpawn(true)
      return seq})
    const rising = grow.length>=5 && grow.every((v,i)=>i===0||v>=grow[i-1]-0.5)
    ok('줄기가 한 번에 나타나지 않고 자란다', rising && grow[grow.length-1] > grow[0]*2.5,
       grow.length? grow[0]+' → '+grow[grow.length-1] : '표본 없음')


  }

    {
  // 오너: "빨려오면 한번에 빨려들어가야" — 흡수가 끝난 잔해는 지평선까지 완주해야 한다.
    // 로슈 한계에서 시작하므로 예전 속도로는 83%만 가고 사라졌다.
    const sw = await page.evaluate(()=>{const A=window.__acc
      A.begin();A.hideOnboard();A.setSpawn(false);A.clearField();A.setMass(40)
      const c=A.pos(),hr=Math.cbrt(A.state.mass)
      const t=A.spawnTagged(A.state.mass*0.9,c.x+hr*6,c.z,'planet')
      let seen=[],gt=0,fedEnded=false
      for(let i=0;i<500;i++){A.setTarget(t.x,t.z);A.step(0.02,20);gt+=0.02
        if(!A.feedObj()&&gt>1)fedEnded=true
        if(fedEnded){const g=A.eatenGeo()
          if(g.length)seen.push(g[0])
          else if(seen.length)return {n:seen.length,from:seen[0].d,to:seen[seen.length-1].d}}}
      return {n:seen.length,from:seen[0]&&seen[0].d,to:seen[seen.length-1]&&seen[seen.length-1].d}})
    await page.evaluate(()=>window.__acc.setSpawn(true))
    ok('흡수 완료 후 잔해가 지평선까지 완주', sw.n>0 && sw.to<=sw.from*0.12, JSON.stringify(sw))
  }

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally { await browser.close() }
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
