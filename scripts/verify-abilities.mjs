// 능력 3종 — 전부 실제 현상에 근거해야 한다.
//  RECOIL KICK  : 비대칭 중력파 방출로 병합 잔해가 걷어차인다(블랙홀이 스스로 가속하는 유일한 실제 경로)
//  FRAME DRAG   : 회전하는 블랙홀이 시공간을 끌어 주변 물질을 강제로 공전시킨다(Lense-Thirring)
//  GRAV. WAVE   : 병합은 시공간 파동으로 에너지를 방출하고 주변 궤도를 흐트러뜨린다
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const results=[]
const ok=(n,c,x='')=>{results.push([c,n,x]);console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`)}
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage']})
const page=await browser.newPage()
const errors=[]
page.on('pageerror',e=>errors.push('PAGEERR: '+e.message))
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('CONSOLE: '+m.text())})
try{
  await page.goto('http://localhost:3040/?dev=1',{waitUntil:'networkidle',timeout:30000})
  await page.waitForFunction(()=>window.__acc&&window.__acc.doWave,{timeout:15000})
  ok('boot',true)

  // 셋 다 에너지가 가득해야만 쓸 수 있다(자원 경쟁 = 선택의 무게)
  const gate=await page.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(3000);A.step(0.05)
    A.setEnergy(0);const before={s:A.state.surgeCount||0,p:A.state.pulseCount||0,w:A.waveCount()}
    A.doSurge();A.doPulse?A.doPulse():0;A.doWave()
    return {blocked:(A.state.surgeCount||0)===before.s&&A.waveCount()===before.w}})
  ok('에너지가 없으면 발동하지 않는다', gate.blocked===true)

  // ① RECOIL KICK — 진행 방향으로 임펄스
  const kick=await page.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(3000);A.step(0.05);A.clearObjs();A.setInv(99)
    A.setTarget(A.pos().x+500,A.pos().z);for(let i=0;i<6;i++)A.step(0.05)
    const p0={x:A.pos().x,z:A.pos().z}
    A.setEnergy(1);A.doSurge();for(let i=0;i<6;i++)A.step(0.05)
    const d1=Math.hypot(A.pos().x-p0.x,A.pos().z-p0.z)
    A.begin();A.setMass(3000);A.step(0.05);A.clearObjs();A.setInv(99)
    A.setTarget(A.pos().x+500,A.pos().z);for(let i=0;i<6;i++)A.step(0.05)
    const p1={x:A.pos().x,z:A.pos().z}
    for(let i=0;i<6;i++)A.step(0.05)
    return {withKick:d1, without:Math.hypot(A.pos().x-p1.x,A.pos().z-p1.z)}})
  ok('RECOIL: 같은 시간에 더 멀리 간다', kick.withKick>kick.without*1.25, `${kick.withKick.toFixed(1)} vs ${kick.without.toFixed(1)}`)

  // ② FRAME DRAG — 먹이를 끌어들이고, 접선 속도를 줘 공전시킨다
  const drag=await page.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(3000);A.step(0.05);A.clearObjs();A.clearFeats();A.setInv(99)
    const q=A.pos(),rr=Math.cbrt(3000);A.spawnTagged(400,q.x+rr*5,q.z)
    const d0=A.tagDist();A.setEnergy(1);A.doPulse();A.step(0.03)
    return {d0,d1:A.tagDist()}})
  ok('FRAME DRAG: 먹이가 끌려온다', drag.d1===null||drag.d1<drag.d0*0.6, `${drag.d0} → ${drag.d1}`)

  // ③ GRAVITATIONAL WAVE — 궤도를 흩고 라이벌의 강착을 끊는다
  const wave=await page.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(3000);A.step(0.05);A.clearObjs();A.clearFeats();A.setInv(99)
    const q=A.pos(),rr=Math.cbrt(3000)
    A.spawnTagged(9000,q.x+rr*3.2,q.z,'rival')   // 위협 대상 — 밀어내는 것이 이 능력의 용도다
    const d0=A.tagDist()
    A.setEnergy(1);A.doWave();A.step(0.06)
    return {d0,d1:A.tagDist(),stunned:A.jetStun().some(v=>v>0),n:A.waveCount(),shock:A.shockOn()}})
  ok('WAVE: 위협이 밖으로 밀려난다', wave.d1!==null&&wave.d1>wave.d0, `${wave.d0} → ${wave.d1}`)
  ok('WAVE: 라이벌의 강착이 끊긴다', wave.stunned===true)
  ok('WAVE: 팽창하는 파면이 보인다', wave.shock===true)
  ok('WAVE: 발동 횟수가 기록된다', wave.n===1, `${wave.n}회`)

  // 코덱스가 두 현상을 가르친다
  const cdx=await page.evaluate(()=>{const A=window.__acc;A.resetCodex();A.begin();A.setMass(3000);A.step(0.05)
    A.setEnergy(1);A.doWave();A.openCodex();const t=document.getElementById('codexGrid').textContent;A.closeCodex()
    return {seen:A.codex().seen,total:A.codex().total,txt:t}})
  ok('중력파 코덱스가 열린다', cdx.seen.includes('gwave'))
  ok('LIGO 2015 관측 사실이 실린다', /LIGO/.test(cdx.txt))
  ok('코덱스 33항목', cdx.total===33, `${cdx.total}`)

  ok('no JS/console errors',errors.length===0,errors.slice(0,3).join(' | '))
}catch(e){console.error('FATAL',e);results.push([false,'fatal',String(e)])}
finally{await browser.close()}
const passed=results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length?0:1)
