import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
// 오버레이 겹침 감사 — fixed 요소를 DOM에서 열거해 텍스트 리프 단위로 쌍별 검사(손으로 선택자를 적으면 반드시 빠뜨린다)
const results=[]
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
for (const vp of [{width:1280,height:720},{width:1440,height:810},{width:844,height:390}]) {
  const p = await b.newPage({viewport:vp})
  await p.goto('http://localhost:3040/?dev=1',{waitUntil:'networkidle'})
  await new Promise(r=>setTimeout(r,2400))
  await p.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(1000)
    window.__t=setInterval(()=>{const q=A.pos(),r=Math.cbrt(A.state.mass)
      for(let i=0;i<3;i++)A.spawn('planet',40,q.x+(i-1)*r*0.6,q.z+r*0.9)},60)})
  await new Promise(r=>setTimeout(r,1600))
  const res = await p.evaluate(()=>{clearInterval(window.__t)
    // 화면에 실제로 '글자를 그리는' 요소만 리프 단위로 수집
    const leaves=[...document.querySelectorAll('body *')].filter(e=>{
      const st=getComputedStyle(e)
      if(st.visibility==='hidden'||st.display==='none'||parseFloat(st.opacity)<0.06)return false
      if(!e.textContent||!e.textContent.trim())return false
      if([...e.children].some(c=>c.textContent&&c.textContent.trim()))return false  // 텍스트를 직접 그리는 리프만
      const r=e.getBoundingClientRect()
      if(r.width<4||r.height<4)return false
      // 조상 중 숨겨진 것 제외
      for(let a=e.parentElement;a;a=a.parentElement){const s2=getComputedStyle(a)
        if(s2.display==='none'||s2.visibility==='hidden'||parseFloat(s2.opacity)<0.06)return false}
      return true})
    const info=leaves.map(e=>({k:(e.id||e.className||e.tagName).toString().split(' ')[0],
      t:e.textContent.trim().slice(0,12),r:e.getBoundingClientRect()}))
    const ov=[]
    for(let i=0;i<info.length;i++)for(let j=i+1;j<info.length;j++){
      const a=info[i].r,c=info[j].r
      const ix=Math.min(a.right,c.right)-Math.max(a.left,c.left)
      const iy=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top)
      if(ix>3&&iy>3)ov.push(`${info[i].k}"${info[i].t}" ⨯ ${info[j].k}"${info[j].t}" ${Math.round(ix)}×${Math.round(iy)}`)}
    return {n:info.length,ov}})
  const okk=res.ov.length===0
  results.push(okk)
  console.log(`${okk?'✓':'✗'} ${vp.width}x${vp.height} 겹침 ${res.ov.length} (텍스트요소 ${res.n})`)
  res.ov.slice(0,7).forEach(x=>console.log('   ',x))
  await p.close()
}
await b.close()
const passed=results.filter(Boolean).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length?0:1)
