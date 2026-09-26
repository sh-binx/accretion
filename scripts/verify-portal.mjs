// 포털 어댑터 — CrazyGames / Poki / 로컬. 계약: 어떤 실패에도 게임을 막지 않고 콜백은 반드시 불린다.
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
  await page.waitForFunction(()=>window.__acc&&window.__acc.portal,{timeout:15000})
  ok('boot',true)

  // 호스트 판별
  const pick=await page.evaluate(()=>({
    cg:__acc.pickPortal('www.crazygames.com',''), cgSub:__acc.pickPortal('games.crazygames.com',''),
    poki:__acc.pickPortal('a.poki-gdn.com',''), poki2:__acc.pickPortal('poki.com',''),
    own:__acc.pickPortal('sh-binx.github.io',''), forced:__acc.pickPortal('sh-binx.github.io','?portal=poki')}))
  ok('CrazyGames 호스트 판별', pick.cg==='cg'&&pick.cgSub==='cg')
  ok('Poki 호스트 판별(게임 CDN·본 도메인)', pick.poki==='poki'&&pick.poki2==='poki')
  ok('자체 호스팅은 로컬 폴백', pick.own==='local')
  ok('?portal= 로 강제 전환(QA용)', pick.forced==='poki')

  // 로컬(SDK 없음)에서의 계약
  const st=await page.evaluate(()=>__acc.portal())
  ok('로컬에서 SDK 없이 동작', st.kind==='local'&&st.sdk===false)
  ok('첫 프레임 후 로딩 완료 신호', st.loadingDone===true)

  // 광고: SDK가 없어도 콜백이 반드시 불린다
  const ad=await page.evaluate(()=>new Promise(r=>{const t=setTimeout(()=>r('timeout'),4000)
    __acc.testAd(()=>{clearTimeout(t);r('done')})}))
  ok('SDK 없어도 미드게임 광고 콜백 보장', ad==='done', ad)
  const rw=await page.evaluate(()=>new Promise(r=>{let rewarded=false;const t=setTimeout(()=>r('timeout'),4000)
    __acc.testRewarded(()=>{rewarded=true},()=>{clearTimeout(t);r(rewarded?'reward+done':'done')})}))
  ok('리워디드도 콜백 보장(광고 없으면 보상 없음)', rw==='done', rw)

  // 광고 중 강제 뮤트 → 복원
  const mute=await page.evaluate(()=>new Promise(r=>{
    __acc.begin() // 오디오 잠금 해제(광고 뮤트는 master 게인을 건드리므로 해제 상태여야 의미가 있다)
    const before=__acc.audioGain?__acc.audioGain():null
    __acc.testAd(()=>r({before,after:__acc.audioGain?__acc.audioGain():null}))}))
  if(mute.before!==null) ok('광고 후 오디오 게인 복원', mute.after===mute.before, `${mute.before} → ${mute.after}`)
  else ok('광고 뮤트 검사 — 오디오 미해제', false, 'AU.master 없음')

  // 게임 시작/종료가 포털에 보고되는지(로컬은 no-op이지만 예외 없이 통과해야 한다)
  const life=await page.evaluate(()=>{try{__acc.begin();__acc.setScore(1234);__acc.gameOver();return 'ok'}catch(e){return String(e)}})
  ok('시작/종료 경로가 포털 호출로 깨지지 않는다', life==='ok', life)

  // ── DEV 게이트: 정확히 dev=1만 치트 훅을 연다(2026-09-26 — `?device=`·`?dev=0`에도 열리던 것 수리) ──
  const gate={}
  for(const q of ['?device=mobile','?developer=1','?devmode','?dev=0','?dev=10','?x=1&dev=1']){
    const p2=await browser.newPage();await p2.goto('http://localhost:3040/'+q,{waitUntil:'load'});await p2.waitForTimeout(300)
    gate[q]=await p2.evaluate(()=>typeof window.__acc);await p2.close()}
  ok('DEV 게이트: dev=1이 아닌 파라미터는 훅을 열지 않는다', ['?device=mobile','?developer=1','?devmode','?dev=0','?dev=10'].every(q=>gate[q]==='undefined'), JSON.stringify(gate))
  ok('DEV 게이트: &dev=1은 연다', gate['?x=1&dev=1']==='object')

  // ── 사이트락 ──
  const sl=await page.evaluate(()=>['localhost','127.0.0.1','sh-binx.github.io','www.crazygames.com','games.crazygames.com','crazygames.fr','www.crazygames.com.br','app.crazygames.com','abc.game-files.crazygames.com','games.poki.com','a1b2.poki-gdn.com','inspector.poki.dev',
    'evil.com','crazygames.evil.com','notcrazygames.com','evilpoki.com','poki.com.evil.net','sh-binx.github.io.evil.com','other.github.io'].map(h=>[h,__acc.siteAllowed(h)]))
  const allowWant=12
  ok('사이트락: 포털·자체 호스트는 허용', sl.slice(0,allowWant).every(x=>x[1]), JSON.stringify(sl.slice(0,allowWant).filter(x=>!x[1])))
  ok('사이트락: 그 외 호스트는 차단', sl.slice(allowWant).every(x=>!x[1]), JSON.stringify(sl.slice(allowWant).filter(x=>x[1])))
  {const fs=await import('fs');const html=fs.readFileSync('/Users/chodaehee/dev/accretion/index.html','utf8');const three=fs.readFileSync('/Users/chodaehee/dev/accretion/three.min.js','utf8')
   const ctx=await browser.newContext();await ctx.route('http://stolen-copy.test/**',r=>r.fulfill({status:200,contentType:r.request().url().endsWith('.js')?'application/javascript':'text/html',body:r.request().url().endsWith('.js')?three:html}))
   const p3=await ctx.newPage();await p3.goto('http://stolen-copy.test/',{waitUntil:'load'});await p3.waitForTimeout(500)
   const st=await p3.evaluate(()=>({txt:document.body.innerText,btn:!!document.getElementById('startBtn'),canvas:document.querySelectorAll('canvas').length}))
   ok('사이트락: 무단 호스트에선 게임이 부팅되지 않는다', /not authorized/.test(st.txt)&&!st.btn&&st.canvas===0, JSON.stringify(st).slice(0,120))
   await ctx.close()}

  // ── CG SDK 모의 — 일시정지·locale·광고 뮤트 시점 ──
  {const ctx=await browser.newContext({viewport:{width:1280,height:720}})
   await ctx.route('https://sdk.crazygames.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:`
    window.__cg=[];var __cgL=n=>()=>__cg.push(n)
    window.CrazyGames={SDK:{init:async()=>{},
     game:{loadingStart:__cgL('loadingStart'),loadingStop:__cgL('loadingStop'),gameplayStart:__cgL('gameplayStart'),gameplayStop:__cgL('gameplayStop'),happytime:__cgL('happytime')},
     ad:{requestAd:(t,cb)=>{__cg.push('request:'+t);__cg.push('gain@request:'+Math.round(window.__acc.audioGain()*100)/100);setTimeout(()=>{cb.adStarted();__cg.push('gain@started:'+Math.round(window.__acc.audioGain()*100)/100);setTimeout(()=>{cb.adFinished();__cg.push('gain@finished:'+Math.round(window.__acc.audioGain()*100)/100)},60)},60)}},
     user:{systemInfo:{locale:'ko-KR',countryCode:'KR'}},
     data:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}}}`}))
   const p4=await ctx.newPage();const e4=[];p4.on('pageerror',e=>e4.push(e.message))
   await p4.goto('http://localhost:3040/?dev=1&portal=cg',{waitUntil:'networkidle'})
   await p4.waitForFunction(()=>window.__acc&&window.__acc.portal().sdk,{timeout:15000})
   ok('CG: SDK locale(ko-KR)을 따른다', await p4.evaluate(()=>__acc.lang())==='ko')
   await p4.evaluate(()=>{__acc.begin();__acc.hideOnboard()})
   const setHidden=v=>p4.evaluate(v=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>v});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>v?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'))},v)
   await p4.waitForFunction(()=>__acc.state.t>=0.3,{timeout:15000}) // SwiftShader는 실시간보다 느리다
   await setHidden(true);await p4.waitForTimeout(300)
   const hid=await p4.evaluate(()=>({t:__acc.state.t,ps:__acc.pauseState()}))
   await p4.waitForTimeout(1500);const t1=await p4.evaluate(()=>__acc.state.t)
   ok('탭 숨김 → 게임 시간 정지', hid.t>0&&Math.abs(t1-hid.t)<0.05&&hid.ps.hidden&&!hid.ps.gp, `${hid.t} → ${t1} ${JSON.stringify(hid.ps)}`)
   await setHidden(false);await p4.waitForFunction(t=>__acc.state.t>t+0.2,t1,{timeout:15000}).catch(()=>{})
   const t2=await p4.evaluate(()=>__acc.state.t)
   ok('탭 복귀 → 게임 재개', t2>t1, `${t1} → ${t2}`)
   await setHidden(false);await p4.waitForTimeout(100) // 같은 상태 재통지 — 이벤트 중복 금지
   await p4.evaluate(()=>__acc.gameOver());await p4.waitForTimeout(300)
   const seq=(await p4.evaluate(()=>__cg.filter(x=>/^gameplay/.test(x)))).join(',')
   ok('gameplayStart/Stop가 짝을 이루고 연속 중복이 없다', seq==='gameplayStart,gameplayStop,gameplayStart,gameplayStop', seq)
   // 광고: 요청 시점엔 소리 유지, 시작되면 뮤트, 끝나면 복원
   await p4.evaluate(()=>new Promise(r=>__acc.testAd(r)))
   const ad=(await p4.evaluate(()=>__cg.filter(x=>/^gain@/.test(x)))).join(',')
   ok('광고 뮤트는 adStarted에서 걸리고 끝나면 풀린다', ad==='gain@request:0.85,gain@started:0,gain@finished:0.85', ad)
   ok('CG 모의 경로 JS 에러 0', e4.length===0, e4.slice(0,2).join(' | '))
   await ctx.close()}

  ok('no JS/console errors',errors.length===0,errors.slice(0,3).join(' | '))
}catch(e){console.error('FATAL',e);results.push([false,'fatal',String(e)])}
finally{await browser.close()}
const passed=results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length?0:1)
