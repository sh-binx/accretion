import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
let pass=0,fail=0
const chk=(n,c,i)=>{if(c){pass++;console.log('  ✓',n)}else{fail++;console.log('  ✗ FAIL:',n,i!==undefined?JSON.stringify(i):'')}}
const D='/Users/chodaehee/dev/accretion'
const cb=Math.floor(Math.random()*1e9)
const b=await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })
const p=await b.newPage({ viewport:{width:1280,height:800} })
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())})
await p.goto(`http://localhost:3040/index.html?dev=1&cb=${cb}`,{waitUntil:'load'})
await p.waitForFunction(()=>window.__acc,null,{timeout:15000})
const ev=(fn,...a)=>p.evaluate(fn,...a)

console.log('\n━ 1. 부트 · 렌더 ━')
await p.waitForTimeout(600)
chk('JS 에러 0(부트)', errs.length===0, errs.slice(0,4))
chk('start 상태(미시작)', !(await ev(()=>window.__acc.state.alive)))
await p.screenshot({path:D+'/../nova-surge/.git/../../accretion-shot-title.png'}).catch(()=>{})

console.log('\n━ 2. 시작 → 성장(먹기) ━')
await ev(()=>window.__acc.begin());await p.waitForTimeout(200)
await ev(()=>window.__acc.hideOnboard()) // 인트로 카드가 떠 있으면 게임이 멈춘다 — 타이머 만료에 기대면 불안정
chk('begin → alive', await ev(()=>window.__acc.state.alive))
const m0=await ev(()=>window.__acc.state.mass)
// 근처 식량으로 유도 + 스텝 반복해 먹여 성장
// 스폰은 난수라 한 판만 보면 결과가 요동친다(같은 이유로 다른 스위트도 중앙값을 쓴다) → 5판 중앙값
const grow=await ev(()=>{const A=window.__acc,out=[]
 for(let k=0;k<5;k++){A.begin();A.hideOnboard()
  for(let i=0;i<160;i++){A.eatNearest();A.step(0.25,16);if(!A.state.alive)break}
  out.push(A.state.mass)}
 return out.sort((a,b)=>a-b)})
const m1=grow[2]
chk('먹어서 성장(중앙값 '+m0+'→'+m1+' · 5판)', m1>m0*1.3, {m0,grow})

console.log('\n━ 3. 호킹 축소(안 먹으면 감소) ━')
await ev(()=>{window.__acc.begin();window.__acc.hideOnboard()}) // 앞 절에서 죽었으면 step이 한 프레임도 안 돈다 — 살아있는 판에서 잰다
await ev(()=>window.__acc.setMass(6))
const before=await ev(()=>window.__acc.state.mass)
// 타겟을 멀리 둬 안 먹게 하고 스텝
await ev(()=>{window.__acc.setTarget(9999,9999);window.__acc.setSpawn(false);window.__acc.clearField()}) // 먹이를 치워야 순수 손실이 보인다(끌려온 천체를 먹어 결과가 뒤집혔었음)
const after=await ev(()=>window.__acc.step(3.0,16))
await ev(()=>window.__acc.setSpawn(true))
chk('호킹 축소로 질량 감소('+before+'→'+after.mass+')', after.mass<before, {before,after:after.mass})

console.log('\n━ 4. 티어 · 렌징 강도(질량 따라) ━')
await ev(()=>window.__acc.begin());await p.waitForTimeout(120) // fresh alive
await ev(()=>{window.__acc.setTarget(0,0);window.__acc.setMass(2)});await p.waitForTimeout(120)
const s4a=await ev(()=>({m:window.__acc.state.mass,alive:window.__acc.state.alive,lens:window.__acc.lens().strength}))
await ev(()=>window.__acc.setMass(60));await ev(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))) // 렌징 유니폼은 렌더에서 갱신 — 프레임을 기다려야 읽힌다
const s4b=await ev(()=>({m:window.__acc.state.mass,alive:window.__acc.state.alive,tier:window.__acc.state.tier,lens:window.__acc.lens().strength}))
console.log('    lo:',JSON.stringify(s4a),' hi:',JSON.stringify(s4b))
chk('렌징 강도 질량 따라 증가('+s4a.lens.toFixed(4)+'→'+s4b.lens.toFixed(4)+')', s4b.lens>s4a.lens*1.3, {s4a,s4b})
chk('질량 60 → STELLAR-MASS(현행 티어표: SUPERMASSIVE는 1200+)', s4b.m>40&&s4b.tier==='STELLAR-MASS', s4b)

console.log('\n━ 5. 증발 게임오버 ━')
await ev(()=>window.__acc.setMass(0.5));await ev(()=>window.__acc.setTarget(9999,9999))
await ev(()=>window.__acc.step(2.0,16));await p.waitForTimeout(120)
const dead=await ev(()=>({alive:window.__acc.state.alive,over:!document.getElementById('over').classList.contains('off'),title:document.getElementById('overTitle').textContent}))
chk('저질량 → 증발 게임오버(EVAPORATED)', !dead.alive&&dead.over&&dead.title==='EVAPORATED', dead)

console.log('\n━ 6. 재시작 ━')
await ev(()=>window.__acc.begin());await p.waitForTimeout(150)
chk('재시작 → alive · mass 리셋', await ev(()=>window.__acc.state.alive&&window.__acc.state.mass<2))

console.log('\n━ 7. 렌징 비주얼 스크린샷(질량 大) ━')
await ev(()=>{window.__acc.setMass(45);window.__acc.setTarget(0,0)})
await p.waitForTimeout(500) // 실렌더 프레임
await p.screenshot({path:D+'/proto-shot-lensing.png'})
await ev(()=>window.__acc.setMass(4))
await p.waitForTimeout(400)
await p.screenshot({path:D+'/proto-shot-early.png'})
console.log('  스크린샷: proto-shot-lensing.png · proto-shot-early.png')

console.log('\n━ 최종 ━')
chk('전체 JS 에러 0', errs.length===0, errs.slice(0,5))
console.log(`\n══ proto: ${pass} PASS / ${fail} FAIL ══`)
await b.close();process.exit(fail?1:0)
