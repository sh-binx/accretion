// UI 전수 감사(상시 회귀) — '그려지는 모든 것'(글자·배경·테두리·그림자) 기준.
// 텍스트만 보던 옛 감사가 서지 바·음소거 버튼을 놓쳐 실기에서 겹침이 발견된 뒤 이 기준으로 바꿨다.
// 원래 주석: — '그려지는 모든 것' 기준. 메시지 채널이 동시에 몇 개까지 뜨는지도 센다.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
const VPS=[[1440,810,false],[1280,720,false],[852,393,true],[740,360,true],[393,852,true],[1024,1366,true]]
const results=[]
let total=0
for(const [w,h,touch] of VPS){
  const p=await b.newPage({viewport:{width:w,height:h},isMobile:touch,hasTouch:touch})
  await p.goto('http://localhost:3040/?dev=1',{waitUntil:'networkidle'})
  await new Promise(r=>setTimeout(r,2200))
  const res=await p.evaluate(()=>{
    const A=window.__acc
    A.begin();A.setMass(3000);A.hideOnboard&&A.hideOnboard()
    const c=document.getElementById('codex')
    c.innerHTML='<div class="ct">◆ CODEX 20/31 · COMET</div><div class="cf">The tail always points away from the star, not backwards along its path — solar wind blows it outward.</div>'
    A.forceUI()
    return new Promise(res=>setTimeout(()=>res(measure()),700))
    function measure(){
    // '그리는' 요소 전부: 글자 / 배경 / 테두리 / 그림자
    const paints=[...document.querySelectorAll('body *')].filter(e=>{
      const st=getComputedStyle(e)
      if(st.display==='none'||st.visibility==='hidden'||parseFloat(st.opacity)<0.06)return false
      for(let a=e.parentElement;a;a=a.parentElement){const s2=getComputedStyle(a)
        if(s2.display==='none'||s2.visibility==='hidden'||parseFloat(s2.opacity)<0.06)return false}
      const r=e.getBoundingClientRect()
      if(r.width<3||r.height<3)return false
      if(r.width>=innerWidth*0.9&&r.height>=innerHeight*0.9)return false
      const hasText=!!(e.textContent&&e.textContent.trim())&&![...e.children].some(x=>x.textContent&&x.textContent.trim())
      const hasBg=st.backgroundColor&&st.backgroundColor!=='rgba(0, 0, 0, 0)'
      const hasBorder=parseFloat(st.borderTopWidth)>0||parseFloat(st.borderLeftWidth)>0
      const hasShadow=st.boxShadow&&st.boxShadow!=='none'
      return hasText||hasBg||hasBorder||hasShadow })
    const info=paints.map(e=>({k:(e.id||(e.className||'').toString().split(' ')[0]||e.tagName),r:e.getBoundingClientRect(),e}))
    const ov=[]
    for(let i=0;i<info.length;i++)for(let j=i+1;j<info.length;j++){
      if(info[i].e.contains(info[j].e)||info[j].e.contains(info[i].e))continue
      const a=info[i].r,c2=info[j].r
      const ix=Math.min(a.right,c2.right)-Math.max(a.left,c2.left)
      const iy=Math.min(a.bottom,c2.bottom)-Math.max(a.top,c2.top)
      if(ix>3&&iy>3)ov.push(`${info[i].k} ⨯ ${info[j].k} (${Math.round(ix)}×${Math.round(iy)})`)}
    // 동시에 뜬 '메시지 채널' 수
    const chans=['#banner','#codex','#onb','.pop','#combo','#feedwrap'].filter(s=>{
      const e=document.querySelector(s); if(!e)return false
      const st=getComputedStyle(e); return st.display!=='none'&&parseFloat(st.opacity)>=0.06})
    const outside=info.filter(x=>x.r.left<-1||x.r.top<-1||x.r.right>innerWidth+1||x.r.bottom>innerHeight+1).map(x=>x.k)
    return {n:info.length,ov,chans,outside:[...new Set(outside)]}}
  })
  total+=res.ov.length; results.push(res.ov.length===0)
  console.log(`${w}x${h}${touch?' touch':''}  요소 ${res.n} · 겹침 ${res.ov.length} · 동시 메시지 ${res.chans.length} [${res.chans.join(' ')}]`)
  res.ov.slice(0,5).forEach(x=>console.log('    ',x))
  if(res.outside.length)console.log('     화면 밖:',res.outside.join(','))
  await p.close()
}
// ── 메시지 큐: 실제 플레이 중 배너·코덱스가 동시에 뜨지 않는가(forceUI 우회 없이) ──
{
  const p=await b.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true})
  await p.goto('http://localhost:3040/?dev=1',{waitUntil:'networkidle'}); await p.waitForTimeout(2200)
  const q=await p.evaluate(async()=>{const A=window.__acc;A.begin();A.hideOnboard();A.resetCodex&&A.resetCodex()
    let both=0,samples=0
    for(let i=0;i<60;i++){
      A.setMass(1.2*Math.pow(1.15,i))
      const c=A.pos(),rr=Math.cbrt(A.state.mass)
      A.spawn(['comet','rock','planet','giant','binary'][i%5],A.state.mass*0.3,c.x+rr*1.4,c.z)
      await new Promise(r=>setTimeout(r,60))
      const bn=parseFloat(getComputedStyle(document.getElementById('banner')).opacity)>0.5
      const cx=document.getElementById('codex').classList.contains('on')
      samples++; if(bn&&cx)both++}
    return {samples,both}})
  await p.close()
  const ok=q.both===0
  results.push(ok)
  console.log(`메시지 큐  표본 ${q.samples} · 배너+코덱스 동시 ${q.both}회  ${ok?'✓':'✗ 큐 미작동'}`)
}

const passed=results.filter(Boolean).length
console.log(`\n${passed}/${results.length} passed  (총 겹침 ${total})`)
if(passed!==results.length)process.exitCode=1
await b.close()
