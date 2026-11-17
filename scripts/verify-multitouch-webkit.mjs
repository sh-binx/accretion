// 엔진 호환성 회귀. 로컬 주소의 WebKit에서 TouchEvent 분기와 한 손 터치만 검사한다.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'

const {webkit}=createRequire(import.meta.url)('playwright')
const browser=await webkit.launch()
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true})
 const errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto((process.argv[2]??'http://localhost:3040/')+'?dev=1&lang=ko')
 await page.waitForFunction(()=>window.__acc)
 await page.locator('#startBtn').click()
 await page.waitForFunction(()=>__acc.state.alive)
 const runs=await page.evaluate(()=>{
  hideOnboard();__acc.clearField();__acc.setSpawn(false);clearFeats();__acc.setMass(16000);S.invT=100;__acc.step(.1)
  const canvas=renderer.domElement
  function touch(identifier,target,x,y){
   return document.createTouch(window,target,identifier,x,y,x,y)
  }
  function send(type,target,touches,changedTouches){
   const event=new TouchEvent(type,{bubbles:true,cancelable:true,
    touches:document.createTouchList(...touches),changedTouches:document.createTouchList(...changedTouches),
    targetTouches:document.createTouchList(...touches.filter(point=>point.target===target))})
   target.dispatchEvent(event)
   return event.defaultPrevented
  }
  const left=touch(1,canvas,95,175),moved=touch(1,canvas,151,175)
  send('touchstart',canvas,[left],[left])
  send('touchmove',canvas,[moved],[moved])
  const count=()=>[S.surgeCount,S.pulseCount,S.waveCount,S.flareCount]
  const result=['actDash','actPulse','actWave','actFlare'].map((id,index)=>{
   S.energy=1;S.surgeT=0;S.shake=0;S.jetFire=0;shock.visible=false;hud()
   const button=$(id),r=button.getBoundingClientRect()
   const right=touch(2,button,r.x+r.width/2,r.y+r.height/2)
   const jitter=touch(2,button,right.clientX+2,right.clientY+2)
   const before=count()
   const ready=button.getAttribute('aria-disabled')==='false'
   const startCancelled=send('touchstart',button,[moved,right],[right])
   const moveCancelled=send('touchmove',button,[moved,jitter],[jitter])
   const endCancelled=send('touchend',button,[moved],[jitter])
   return {id,ready,startCancelled,moveCancelled,endCancelled,energy:S.energy,steer:steer(),
    counts:count().map((n,i)=>n-before[i]),index,
    effect:[S.surgeT>0,S.shake>0,shock.visible,S.jetFire>0][index]}
  })
  send('touchend',canvas,[],[moved])
  return result
 })
 for(const run of runs){
  console.log(JSON.stringify(run))
  const {id,index,...state}=run
  assert.deepEqual(state,{ready:true,startCancelled:true,moveCancelled:false,endCancelled:true,energy:0,
   steer:{x:1,z:0,mag:1},counts:runs.map((_,i)=>+(i===index)),effect:true},id)
 }

 // 단일 WebKit 터치 입력으로 직접 누르고 합성 click이 중복 경로를 만들지 않는지 확인한다.
 const before=await page.evaluate(()=>{
  S.energy=1;S.surgeT=0;hud()
  window.compatClicks=0
  $('actPulse').addEventListener('click',()=>window.compatClicks++)
  return S.pulseCount
 })
 const box=await page.locator('#actPulse').boundingBox()
 assert(box)
 await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2)
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
 assert.deepEqual(await page.evaluate(()=>[S.pulseCount,S.energy,window.compatClicks]),[before+1,0,0])
 assert.deepEqual(errors,[])
 console.log('WebKit 4개 DOM 터치 스킬과 단일 터치 1회 발동 통과, 페이지 에러 0')
}finally{
 await browser.close()
}
