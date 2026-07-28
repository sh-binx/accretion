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

  ok('no JS/console errors',errors.length===0,errors.slice(0,3).join(' | '))
}catch(e){console.error('FATAL',e);results.push([false,'fatal',String(e)])}
finally{await browser.close()}
const passed=results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length?0:1)
