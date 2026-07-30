// 오너: "머리에 빔이 생기고, 먹지도 않았는데 행성이 빨려든다"
// 핵심 요구: '보이는 빔'과 '실제 판정'이 정확히 일치할 것.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const results=[]; const ok=(n,c,x='')=>{results.push([c,n,x]);console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`)}
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage']})
const p = await b.newPage(); const errs=[]
p.on('pageerror',e=>errs.push(e.message))
p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text())})
try{
  await p.goto('http://localhost:3040/?dev=1',{waitUntil:'networkidle',timeout:30000})
  await p.waitForFunction(()=>window.__acc&&window.__acc.jetSpec,{timeout:15000})
  ok('boot',true)

  const spec = await p.evaluate(()=>window.__acc.jetSpec())
  ok('two jets exist', spec.n===2, `${spec.n}`)
  // 회전을 지오메트리에 구웠으므로 방향은 메시 quaternion이 아니라 '실제 월드 위치'로 판정한다(아래 tips)

  // 제트가 평면(XZ)에 눕혀져 있는가 — 이전 버그는 둘 다 화면 위(Y)를 향했다
  const tips = await p.evaluate(()=>{ const A=window.__acc; A.begin(); A.setMass(50000); A.step(0.1); A.setJetAngle(0); A.step(0.02); return A.jetWorldTips() })
  ok('jets lie in the play plane (not toward the camera)', Math.abs(tips[0].x)>1 && Math.abs(tips[1].x)>1, JSON.stringify(tips))
  ok('the two tips are on opposite sides', Math.sign(tips[0].x)!==Math.sign(tips[1].x), `${tips[0].x} vs ${tips[1].x}`)

  // ★ 핵심: 빔 축 위의 천체는 먹히고, 축에서 벗어난 천체는 먹히지 않는다
  // 설계(오너 확정): 제트는 자전축 '양쪽으로' 대칭으로 뿜고, 그 축을 발사 순간 한 번만 쓸어낸다.
  // 라이벌 블랙홀은 밀 수 없으므로 원반 가스만 날린다(AGN 피드백).
  const sweep = await p.evaluate(()=>{
    const A=window.__acc
    const run=(dist,fire)=>{
      A.begin();A.hideOnboard();A.setSpawn(false);A.setMass(50000);A.step(0.02)
      const hr=A.jetProbe().hr
      A.clearField()                                  // 스텝 없이 바로 배치 → 네메시스가 축을 돌리지 못한다
      const q=A.pos(),D=hr*dist
      A.spawn('planet',5000,q.x,q.z+D)                // +축(발사 시 축은 +Z로 선다)
      A.spawn('planet',5000,q.x,q.z-D)                // −축 → 쌍극이면 함께 쓸린다
      A.spawn('planet',5000,q.x+D,q.z)                // 축 밖 → 남아야 한다
      if(fire){A.setEnergy(1);A.doFlare()}
      return {swept:A.sweptLast(),left:A.jetProbe().objs.length,q,D}}
    const inR=run(4,true), outR=run(12,true), idle=run(4,false)
    // 1회성 — 발사 뒤 축 위에 새로 들어와도 추가로 쓸리지 않는다
    const r2=run(4,true);const s1=r2.swept
    A.spawn('planet',5000,r2.q.x,r2.q.z+r2.D);A.step(0.5)
    const after=A.sweptLast()
    A.setSpawn(true)
    return {inR:inR.swept,left:inR.left,outR:outR.swept,idle:idle.swept,once:after===s1}})
  ok('쌍극 — 축 양쪽이 함께 쓸린다', sweep.inR===2, `${sweep.inR}개`)
  ok('축 밖 천체는 남는다', sweep.left===1, `남은 ${sweep.left}개`)
  ok('사거리 밖은 쓸리지 않는다', sweep.outR===0, `${sweep.outR}개`)
  ok('쏘지 않으면 아무것도 안 쓸린다(상시 살상 폐지)', sweep.idle===0, `${sweep.idle}개`)
  ok('1회성 — 발사 뒤 새로 들어온 천체는 안전', sweep.once===true)

  // 오너: "제트는 기본적으로 보이지 않고 누른 순간만 분출했다 사라지는 것"
  const vis = await p.evaluate(async ()=>{
    const A=window.__acc
    A.begin();A.hideOnboard();A.setSpawn(false);A.setMass(50000);A.step(0.05)
    const idle=A.jetsVisible()
    A.setEnergy(1);A.doFlare()
    A.step(0.05);const during=A.jetsVisible()
    A.step(0.9); const after=A.jetsVisible()
    A.setSpawn(true)
    return {ready:A.jetsOn(),idle,during,after}})
  ok('퀘이사에서 능력은 사용 가능', vis.ready===true)
  ok('평상시 제트는 보이지 않는다', vis.idle===false)
  ok('누른 순간만 분출한다', vis.during===true)
  ok('분출이 끝나면 사라진다', vis.after===false)

  // 빔 길이 밖은 먹지 않는다
  const far = await p.evaluate(()=>{
    const A=window.__acc; A.begin(); A.setMass(50000); A.step(0.1); A.clearObjs(); A.clearFeats()
    A.setJetAngle(0); const q=A.pos(), r=Math.cbrt(A.state.mass)
    A.spawnTagged(A.state.mass*0.2, q.x+r*14, q.z, 'planet')   // 빔 길이(9r) 훨씬 밖
    A.setEnergy(1);A.doFlare()
    const m0=A.tagMass(); A.step(0.02); const m1=A.tagMass()
    return m1!==null && m1 < m0*0.9
  })
  ok('beyond the beam length nothing is consumed', far===false)

  // QUASAR 미만에선 제트가 없고 아무것도 자동으로 먹히지 않는다
  const below = await p.evaluate(()=>{
    const A=window.__acc; A.begin(); A.setMass(5000); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(), r=Math.cbrt(A.state.mass)
    A.spawnTagged(A.state.mass*0.2, q.x+r*5, q.z, 'planet')
    A.step(0.02); return { jets:A.jetsOn(), eaten:A.tagEaten(), tier:A.state.tier }
  })
  ok('below QUASAR: no jets', below.jets===false, below.tier)
  ok('below QUASAR: nothing auto-consumed', below.eaten===false)

  // 제트 포식은 실제로 질량·점수가 오른다(오너: "실제로 먹어지는지 모르겠다")
  const real = await p.evaluate(()=>{
    const A=window.__acc; A.begin(); A.setMass(50000); A.step(0.1); A.clearObjs(); A.clearFeats()
    A.setJetAngle(0); const q=A.pos(), r=Math.cbrt(A.state.mass)
    const m0=A.state.mass, s0=A.state.score
    A.spawn('planet', A.state.mass*0.3, q.x+r*5, q.z)
    A.setEnergy(1);A.doFlare()   // 살상은 플레어를 쏜 순간뿐
    A.step(0.02)
    return { dm:A.state.mass-m0, ds:A.state.score-s0 }
  })
  // 조석 박리로 미세하게 들어오는 건 정상(제트와 무관) — 삼켰다면 수천 단위로 뛴다
  ok('제트가 천체를 삼키지 않는다(질량 안 늘어남)', real.dm<1, `Δm=${real.dm.toFixed(2)} (먹었다면 수천)`)

  // 제트 탈출 — 위협 반대쪽으로 나를 튕겨내고, 원반이 날아간 라이벌은 추격을 멈춘다
  const esc = await p.evaluate(()=>{
    const A=window.__acc
    const trial=(useJet)=>{
      A.begin();A.hideOnboard();A.setSpawn(false);A.clearField();A.setMass(30000)
      const c=A.pos()
      A.spawn('rival',A.state.mass*2.5,c.x+Math.cbrt(30000)*2.4,c.z)
      A.step(0.05)
      if(useJet){A.setEnergy(1);A.doFlare()}
      for(let i=0;i<40;i++){A.step(0.05);if(!A.state.alive)return false}
      return A.state.alive}
    let no=0,jet=0
    for(let k=0;k<6;k++){if(trial(false))no++;if(trial(true))jet++}
    A.setSpawn(true)
    return {no,jet}})
  ok('제트 없이는 큰 라이벌에게 죽는다(대조군)', esc.no===0, `${esc.no}/6 생존`)
  ok('제트 탈출로 위기를 벗어난다', esc.jet>=5, `${esc.jet}/6 생존`)

  // 2026-07-28: 제트는 사건지평선을 어쩌지 못하므로 큰 라이벌을 '밀어낼' 수 없다.
  // 실제로 일어나는 일은 AGN 피드백 — 제트가 주변 가스를 쓸어내 강착이 멈춘다.
  const agn = await p.evaluate(() => { const A=window.__acc
    A.begin(); A.setMass(48000); A.step(0.06); A.clearObjs(); A.clearFeats(); A.setInv(99)
    const q=A.pos(), rr=Math.cbrt(48000)
    A.spawn('rival', 120000, q.x+rr*2.2, q.z)                      // 나보다 큰 라이벌 = 제트로 못 먹는다
    for(let i=0;i<6;i++) A.spawn('rock', A.state.mass*0.05, q.x+rr*2.2+(i-3)*rr*0.35, q.z+rr*0.4)
    let stunned=false, first=null
    for(let i=0;i<80;i++){ A.step(0.05)
      if(i%12===0){A.setEnergy(1);A.doFlare()}   // AGN 피드백도 플레어를 쏠 때 일어난다
      if(A.jetStun().some(v=>v>0)) stunned=true
      const r=A.objInfo().find(o=>o.t==='rival'); if(r&&first===null) first=r.mass }
    const r2=A.objInfo().find(o=>o.t==='rival')
    return { stunned, first, last: r2?r2.mass:null, alive: !!r2 } })
  ok('제트가 큰 라이벌의 원반 가스를 날린다', agn.stunned===true)
  ok('큰 라이벌은 제트로 먹히지 않는다(사건지평선)', agn.alive===true)
  ok('원반이 날아간 라이벌은 먹이 옆에서도 못 자란다', agn.last!==null && agn.last<=agn.first, `${agn.first} → ${agn.last}`)

  ok('no JS/console errors', errs.length===0, errs.slice(0,2).join(' | '))
}catch(e){console.error('FATAL',e);results.push([false,'fatal',String(e)])}
finally{await b.close()}
const passed=results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length?0:1)
