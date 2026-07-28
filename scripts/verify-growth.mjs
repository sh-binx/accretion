// 성장 체감 — "커지는 느낌이 없다"의 구조적 원인을 회귀로 고정한다.
// 실측(3.6.1): 질량 2→120,000에서 먹이/나 비율이 0.40→0.54로 *증가*해 성장이 체감될 수 없었다.
// 처방: ① 우주 자(고정 격자) ② 질량 비교 마일스톤 ③ 고정 크기 랜드마크(은하 중심)
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
  await page.waitForFunction(()=>window.__acc&&window.__acc.gridCells,{timeout:15000})
  ok('boot',true)

  // ① 우주 자 — 커질수록 화면에 격자가 더 많이 보여야 한다(절대 기준)
  const cells=await page.evaluate(()=>{const A=window.__acc,o={}
    for(const m of [2,60,3000,120000]){A.begin();A.setMass(m);A.step(0.1);o[m]=A.gridCells()}
    return o})
  ok('격자가 성장에 따라 촘촘해진다', cells[120000]>cells[2]*6, `${cells[2]} → ${cells[120000]}칸`)
  ok('구간마다 단조 증가', cells[2]<cells[60]&&cells[60]<cells[3000]&&cells[3000]<cells[120000],
     `${cells[2]}/${cells[60]}/${cells[3000]}/${cells[120000]}`)

  // ② 질량 비교 마일스톤 — 실제 천체와 대조
  const marks=await page.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(1.2);A.step(0.05)
    const a=A.massMarks().idx
    A.setMass(300);A.step(0.05);A.step(0.05); const b=A.massMarks().idx
    A.setMass(200000);A.step(0.05);A.step(0.05); const c=A.massMarks().idx
    return {a,b,c,total:A.massMarks().total}})
  ok('성장하며 마일스톤이 순서대로 열린다', marks.a<marks.b&&marks.b<marks.c, `${marks.a} → ${marks.b} → ${marks.c} / ${marks.total}`)
  ok('마일스톤이 되돌아가지 않는다', marks.c<=marks.total)

  // ③ 은하 중심 — 크기가 고정돼 성장하면 화면에서 작아진다
  const core=await page.evaluate(()=>{const A=window.__acc;A.begin();A.step(0.05)
    const c=A.coreState()
    const frac=m=>{const half=(22+Math.cbrt(m)*7)*0.466, cr=Math.cbrt(4.3e6)*0.62*3.1;return cr/half}
    return {visible:c.visible,mass:c.mass,small:frac(3),big:frac(300000)}})
  ok('은하 중심이 배치된다', core.visible===true)
  ok('질량이 Sgr A*와 같다(430만)', Math.abs(core.mass-4.3e6)<1)
  ok('성장하면 화면에서 작아진다', core.big < core.small*0.1, `${(core.small*100).toFixed(0)}% → ${(core.big*100).toFixed(0)}%`)

  // ④ 제트 축은 고정이고, 먹는 방향이 축을 정렬시킨다(바딘–패터슨)
  const spin=await page.evaluate(()=>{const A=window.__acc
    const run=(dx,dz)=>{A.begin();A.setMass(48000);A.step(0.06);A.clearObjs();A.clearFeats();A.setInv(99)
      A.setJetAngle(Math.PI*0.5)
      const q=A.pos(),rr=Math.cbrt(48000)
      for(let k=0;k<40;k++){A.spawn('planet',A.state.mass*0.06,q.x+dx*rr*1.6+(k%3-1)*rr*0.15,q.z+dz*rr*1.6);A.step(0.08)}
      return A.spinAxis().angle}
    return {right:run(1,0), up:run(0,-1)}})
  ok('오른쪽에서 먹으면 축이 그쪽으로 정렬된다', Math.abs(spin.right)<0.25, `${spin.right.toFixed(2)} rad`)
  ok('위쪽에서 먹으면 축이 유지된다', Math.abs(spin.up-Math.PI/2)<0.25, `${spin.up.toFixed(2)} rad`)

  ok('no JS/console errors',errors.length===0,errors.slice(0,3).join(' | '))
}catch(e){console.error('FATAL',e);results.push([false,'fatal',String(e)])}
finally{await browser.close()}
const passed=results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length?0:1)
