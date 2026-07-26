// 오너: "블랙홀에서 사이즈만 커지고 정체한다 — 더 여러 단계로 진화 못하나"
// 5단계 티어(항성질량→중간→초대질량→퀘이사→울트라매시브)와 단계별 실제 변화 검증
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
  await p.waitForFunction(()=>window.__acc&&window.__acc.tiers,{timeout:15000})
  ok('boot',true)

  const names = await p.evaluate(()=>window.__acc.tiers())
  ok('black hole has 5 tiers', names.length===5, names.join(' → '))

  // 질량 사다리를 오르며 티어·존·렌징이 실제로 바뀌는지
  const ladder = await p.evaluate(()=>{
    const A=window.__acc, out=[]
    for(const m of [50, 400, 5000, 50000, 500000]){
      A.begin(); A.setMass(m); A.step(0.1); A.step(2.4)   // 존 lerp 시간
      out.push({ m, tier:A.state.tier, fog:A.fogHex(), lens:A.zoneLens(), jets:A.jetsOn() })
    }
    return out
  })
  const tiersSeen = [...new Set(ladder.map(l=>l.tier))]
  ok('each mass step lands in a different tier', tiersSeen.length===5, tiersSeen.join(' · '))
  const fogs = [...new Set(ladder.map(l=>l.fog))]
  ok('every tier has its own zone colour', fogs.length===5, fogs.join(' '))
  ok('lensing keeps rising with tier', ladder[4].lens > ladder[0].lens*1.5, `${ladder[0].lens} → ${ladder[4].lens}`)

  // QUASAR에서 제트 점화, 그 아래선 꺼져 있어야
  ok('jets OFF below quasar', ladder[2].jets===false, `tier=${ladder[2].tier}`)
  ok('jets ON at quasar', ladder[3].jets===true, `tier=${ladder[3].tier}`)
  ok('jets stay ON at ultramassive', ladder[4].jets===true, `tier=${ladder[4].tier}`)

  // 제트가 실제로 축선상의 먹이를 삼킨다
  const jetEat = await p.evaluate(()=>{
    const A=window.__acc; A.begin(); A.setMass(50000); A.step(0.1); A.clearObjs(); A.clearFeats()
    const q=A.pos(), r=Math.cbrt(A.state.mass)
    // 제트가 회전하므로 홀 주위 여러 각도에 먹이를 깔아두면 지나가며 삼킨다
    for(let i=0;i<12;i++){ const a=i/12*6.283; A.spawn('planet', A.state.mass*0.3, q.x+Math.cos(a)*r*5, q.z+Math.sin(a)*r*5) }
    const n0=A.objInfo().length, m0=A.state.mass
    for(let i=0;i<20;i++)A.step(0.12)
    return { n0, m0, m1:A.state.mass, jets:A.jetsOn() }
  })
  ok('jets consume bodies along the beam', jetEat.m1>jetEat.m0, `mass ${Math.round(jetEat.m0)} → ${Math.round(jetEat.m1)}`)

  // 티어 간격이 로그(×10)라 후반에도 계속 승급 — 이전엔 160에서 끝났음
  const reach = await p.evaluate(()=>{
    const A=window.__acc; A.begin(); A.setMass(36700); A.step(0.1); return A.state.tier })
  ok('owner peak (36.7K) is no longer the top tier', reach==='QUASAR', reach)

  ok('no JS/console errors', errs.length===0, errs.slice(0,2).join(' | '))
}catch(e){console.error('FATAL',e);results.push([false,'fatal',String(e)])}
finally{await b.close()}
const passed=results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length?0:1)
