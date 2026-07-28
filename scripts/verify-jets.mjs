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
  const aim = await p.evaluate(()=>{
    const A=window.__acc
    const probe=(angle, place)=>{           // place: 'onAxis' | 'offAxis'
      A.begin(); A.setMass(50000); A.step(0.1); A.clearObjs(); A.clearFeats()
      A.setJetAngle(angle)
      const q=A.pos(), r=Math.cbrt(A.state.mass)
      const ax=Math.cos(angle), az=-Math.sin(angle)             // 제트 축(월드)
      const d=r*5
      const px = place==='onAxis' ? q.x+ax*d : q.x-az*d          // 축 위 / 축에 수직(90°)
      const pz = place==='onAxis' ? q.z+az*d : q.z+ax*d
      A.spawnTagged(A.state.mass*0.2, px, pz, 'planet')
      const m0=A.tagMass()
      A.step(0.02)                                               // 회전 전에 즉시 판정
      const m1=A.tagMass()
      return m1!==null && m1 < m0*0.9                            // 제트에 맞으면 부서져 질량이 급감한다
    }
    return { on0:probe(0,'onAxis'), off0:probe(0,'offAxis'),
             on1:probe(1.1,'onAxis'), off1:probe(1.1,'offAxis') }
  })
  ok('빔 축 위의 천체가 제트에 걸린다 (각 0)', aim.on0===true)
  ok('축에서 벗어난 천체는 안 맞는다 (각 0)', aim.off0===false)
  ok('회전한 각도에서도 동일 (1.1 rad)', aim.on1===true && aim.off1===false, `on=${aim.on1} off=${aim.off1}`)

  // 빔 길이 밖은 먹지 않는다
  const far = await p.evaluate(()=>{
    const A=window.__acc; A.begin(); A.setMass(50000); A.step(0.1); A.clearObjs(); A.clearFeats()
    A.setJetAngle(0); const q=A.pos(), r=Math.cbrt(A.state.mass)
    A.spawnTagged(A.state.mass*0.2, q.x+r*14, q.z, 'planet')   // 빔 길이(9r) 훨씬 밖
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
    A.step(0.02)
    return { dm:A.state.mass-m0, ds:A.state.score-s0 }
  })
  ok('jet consumption really adds score', real.ds>0, `+${real.ds.toLocaleString()}`)

  // 2026-07-28: 제트는 사건지평선을 어쩌지 못하므로 큰 라이벌을 '밀어낼' 수 없다.
  // 실제로 일어나는 일은 AGN 피드백 — 제트가 주변 가스를 쓸어내 강착이 멈춘다.
  const agn = await p.evaluate(() => { const A=window.__acc
    A.begin(); A.setMass(48000); A.step(0.06); A.clearObjs(); A.clearFeats(); A.setInv(99)
    const q=A.pos(), rr=Math.cbrt(48000)
    A.spawn('rival', 120000, q.x+rr*2.2, q.z)                      // 나보다 큰 라이벌 = 제트로 못 먹는다
    for(let i=0;i<6;i++) A.spawn('rock', A.state.mass*0.05, q.x+rr*2.2+(i-3)*rr*0.35, q.z+rr*0.4)
    let stunned=false, first=null
    for(let i=0;i<80;i++){ A.step(0.05)
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
