// { printf 'const spaceId=123, tab="p1", base="http://localhost:3044/";\n'; cat scripts/verify-mobile-viewport.ego.mjs; } | ego-browser nodejs
const {strict:assert}=await import('node:assert')
const page=(await taskSpace(spaceId)).page(tab)
const errors=[]
if(typeof output==='string')await (await import('node:fs/promises')).mkdir(output,{recursive:true})
const shot=(name)=>typeof output==='string'?page.screenshot({path:output+'/'+name+'.png'}):null
const metrics=(width,height,mobile=true)=>page.cdp('Emulation.setDeviceMetricsOverride',{
 width,height,mobile,deviceScaleFactor:1,screenOrientation:{type:width>height?'landscapePrimary':'portraitPrimary',angle:width>height?90:0}
})
async function click(id,touch=true){
 const [x,y]=await page.evaluate(id=>{const r=document.getElementById(id).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]},id)
 if(!touch)return page.mouse.click(x,y,{label:'전체 화면 버튼 확인'})
 await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
 await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
}
async function updateVisual(width,height,offsetLeft=0,offsetTop=0){
 await page.evaluate(([width,height,offsetLeft,offsetTop])=>{
  const move=width===visualViewport.width&&height===visualViewport.height
  Object.assign(visualViewport,{width,height,offsetLeft,offsetTop})
  visualViewport.dispatchEvent(new Event(move?'scroll':'resize'))
 },[width,height,offsetLeft,offsetTop])
 // 한 번의 rAF로 합쳐 처리하는 구현에도 프레임 두 번을 준다.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
}
async function snapshot(expected,ids,insets=[0,0,0,0]){
 const state=await page.evaluate(ids=>{
  const get=id=>id==='canvas'?document.querySelector(id):document.getElementById(id)
  return {
   layout:[innerWidth,innerHeight],visual:[visualViewport.offsetLeft,visualViewport.offsetTop,visualViewport.width,visualViewport.height],
   scroll:[scrollX,scrollY,document.scrollingElement.scrollHeight===document.scrollingElement.clientHeight],
   graphics:[cam.aspect,rt.width,rt.height,renderer.getSize(new THREE.Vector2()).toArray()],
   rects:Object.fromEntries(ids.map(id=>{
    const e=get(id),r=e.getBoundingClientRect()
    return [id,{xywh:[r.x,r.y,r.width,r.height],hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),visible:getComputedStyle(e).visibility==='visible'}]
   }))
  }
 },ids)
 console.log(JSON.stringify(state))
 assert.deepEqual(state.visual,expected)
 assert.deepEqual(state.scroll,[0,0,true],'문서를 스크롤하지 않고 조작')
 if(state.rects.canvas)assert.deepEqual(state.rects.canvas.xywh,expected,'캔버스가 가시영역에 일치')
 const [x,y,w,h]=expected,[top,right,bottom,left]=insets
 assert.deepEqual(state.graphics,[w/h,w,h,[w,h]],'카메라, 렌더러, 렌더 타깃이 같은 크기')
 for(const id of ids.filter(id=>id!=='canvas')){
  const {xywh:[l,t,ew,eh],hit,visible}=state.rects[id]
  assert(l>=x+left-.01&&t>=y+top-.01&&l+ew<=x+w-right+.01&&t+eh<=y+h-bottom+.01,id+' 전체가 안전한 가시영역에 포함')
  assert(visible,id+' 노출')
  if(id.endsWith('Btn')||id==='mute'||id.startsWith('start')||id.startsWith('act')||id==='ribbon')assert(ew>=46&&eh>=46&&hit,id+' 터치 46px 및 중앙 히트')
 }
}
const inject=(source)=>page.cdp('Page.addScriptToEvaluateOnNewDocument',{source})
const remove=({identifier})=>page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier})
const errorProbe=await inject(`
window.addEventListener('error', e => { if (e.message) window.__viewportErrors.push(e.message) })
window.addEventListener('unhandledrejection', e => window.__viewportErrors.push(String(e.reason)))
window.__viewportErrors=[]
`)
const visual=await inject(`
const viewport=new EventTarget()
for(const key of ['width','height','offsetLeft','offsetTop','scale'])
 Object.defineProperty(viewport,key,{writable:true,value:key==='scale'?1:0})
Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true})
`)
const unavailable=await inject(`
Object.defineProperty(document,'fullscreenEnabled',{get:()=>false})
Object.defineProperty(document,'webkitFullscreenEnabled',{get:()=>false})
`)
try{
 await metrics(667,375)
 await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3})
 await page.goto(base+(typeof baseline==='string'?baseline:'')+'?dev=1&lang=ko')
 await page.waitForFunction(()=>!!window.__acc)
 await click('startBtn')
 await page.waitForFunction(()=>document.body.classList.contains('playing'))
 await page.evaluate(()=>{hideOnboard();hud()})
 await updateVisual(667,291,0,0)
 if(typeof baseline==='string')await shot('red-play')
 await snapshot([0,0,667,291],['canvas','hud','right','massbar','mute','pauseBtn','actDash','actPulse','actWave'])
 if(typeof baseline==='string')throw Error('기존 빌드에서 가림이 재현되지 않음')
 await page.evaluate(()=>window.scrollTo(0,70))
 await updateVisual(640,274,10,7)
 // 실제 iPhone 노치·홈 인디케이터에 해당하는 수치를 별도로 격리해 검증.
 const insets=[10,44,21,44]
 await page.evaluate(insets=>['top','right','bottom','left'].forEach((side,i)=>
  document.body.style.setProperty('--safe-'+side,insets[i]+'px')),insets)
 const playIds=['canvas','hud','right','massbar','mute','pauseBtn','actDash','actPulse','actWave']
 await snapshot([10,7,640,274],playIds,insets)
 await shot('green-play')
 await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:230,y:155}]})
 await page.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:280,y:155}]})
 assert.deepEqual(await page.evaluate(()=>[joyOn,joyMag>.8,joyEl.getBoundingClientRect().x+56]),[true,true,230])
 await updateVisual(640,274,13,8)
 assert.equal(await page.evaluate(()=>joyEl.getBoundingClientRect().x+56),230,'가시영역 위치만 바뀌어도 조이스틱 원점 유지')
 await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
 await updateVisual(640,274,10,7)
 await page.evaluate(()=>{__acc.setInv(100);__acc.clearField();__acc.setSpawn(false);__acc.setMass(16000);__acc.step(.1);hud()})
 const late=await page.evaluate(()=>[document.getElementById('right').getBoundingClientRect().bottom,
  document.getElementById('surge').getBoundingClientRect().top])
 console.log('짧은 가로 퀘이사 HUD 아래 / 조작대 위:',late)
 assert(late[0]<=late[1],'오른쪽 HUD와 최대 조작 버튼 수가 겹치지 않음')
 await snapshot([10,7,640,274],[...playIds,'actFlare','actHold'],insets)
 await shot('green-late')
 await click('pauseBtn')
 await page.waitForFunction(()=>__acc.pauseState().manual)
 await snapshot([10,7,640,274],['canvas','resumeBtn'],insets)
 await shot('green-pause')
 await click('resumeBtn')
 await page.waitForFunction(()=>!__acc.pauseState().manual)
 await updateVisual(375,560)
 await page.waitForFunction(()=>__acc.pauseState().orient)
 await updateVisual(667,375)
 await page.waitForFunction(()=>!__acc.pauseState().orient)
 await snapshot([0,0,667,375],playIds,insets)
 assert.equal(await page.evaluate(()=>scrollY),0)
 errors.push(...await page.evaluate(()=>window.__viewportErrors))
 await page.reload()
 await page.waitForFunction(()=>!!window.__acc)
 await updateVisual(667,274)
 await page.evaluate(insets=>['top','right','bottom','left'].forEach((side,i)=>
  document.body.style.setProperty('--safe-'+side,insets[i]+'px')),insets)
 await snapshot([0,0,667,274],['canvas','ribbon','startBtn','startCodex','startAwards','startLang'],insets)
 await shot('green-menu')
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('[data-fullscreen]')].map(e=>e.hidden)),[true,true],'지원하지 않는 환경에서 버튼 숨김')
 // 목록과 닫기 버튼은 모달 안에서 접근 가능해야 한다.
 await click('startCodex')
 await page.waitForFunction(()=>!document.getElementById('codexScreen').classList.contains('off'))
 await page.evaluate(()=>{let m=document.getElementById('codexScreen');m.scrollTop=m.scrollHeight})
 await snapshot([0,0,667,274],['canvas','codexClose'],insets)
 await click('codexClose')
 assert.equal(await page.evaluate(()=>document.getElementById('codexScreen').classList.contains('off')),true)
 errors.push(...await page.evaluate(()=>window.__viewportErrors))
 await remove(unavailable)
 await remove(visual)
 await metrics(960,600,false)
 await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false})
 // 실제 API: 클릭으로 진입/해제와 번역을 보고, 테스트 API로 호출 거부를 별도로 주입한다.
 await page.goto(base+'?dev=1&lang=en')
 await page.waitForFunction(()=>!!window.__acc)
 const full='startFullscreen'
 assert.deepEqual(await page.evaluate(()=>[document.fullscreenEnabled,$('startFullscreen').hidden,$('startFullscreen').textContent.trim()]),[true,false,'Fullscreen'])
 await click(full,false)
 await page.waitForFunction(()=>document.fullscreenElement===document.documentElement&&$('startFullscreen').textContent==='Exit fullscreen')
 await click(full,false)
 await page.waitForFunction(()=>!document.fullscreenElement&&$('startFullscreen').textContent==='Fullscreen')
 await page.evaluate(()=>{document.documentElement.requestFullscreen=()=>Promise.reject(new TypeError('QA denied'));setLang('ko')})
 await click(full,false)
 await page.waitForFunction(()=>$('startFullscreenStatus').textContent.includes('전체 화면'))
 assert.equal(await page.evaluate(()=>$('startFullscreen').textContent.trim()),'전체 화면')
 assert.equal(await page.evaluate(()=>document.fullscreenElement),null)
 await click('startBtn',false)
 await page.waitForFunction(()=>document.body.classList.contains('playing'))
 await page.evaluate(()=>hideOnboard())
 await page.keyboard.press('Escape')
 await page.waitForFunction(()=>__acc.pauseState().manual&&document.activeElement.id==='resumeBtn')
 await page.keyboard.press('Tab')
 assert.equal(await page.evaluate(()=>document.activeElement.id),'pauseFullscreen')
 await page.keyboard.press('Tab')
 assert.equal(await page.evaluate(()=>document.activeElement.id),'resumeBtn')
 errors.push(...await page.evaluate(()=>window.__viewportErrors))
 // 구형 WebKit 접두사 경로와 VisualViewport 미지원은 따로 모의한다.
 const legacy=await inject(`
 Object.defineProperty(window,'visualViewport',{value:undefined})
 Object.defineProperty(document,'fullscreenEnabled',{value:false})
 Object.defineProperty(document,'webkitFullscreenEnabled',{value:true})
 let active=null
 Object.defineProperty(document,'webkitFullscreenElement',{get:()=>active})
 Object.defineProperty(Element.prototype,'webkitRequestFullscreen',{value:function(){
  active=this
  document.dispatchEvent(new Event('webkitfullscreenchange'))
 }})
 document.webkitExitFullscreen=()=>{
  active=null
  document.dispatchEvent(new Event('webkitfullscreenchange'))
 }
 `)
 try{
  await page.goto(base+'?dev=1&lang=en')
  await page.waitForFunction(()=>!!window.__acc)
  assert.deepEqual(await page.evaluate(()=>renderer.getSize(new THREE.Vector2()).toArray()),[960,600])
  await metrics(800,500,false)
  await page.waitForFunction(()=>rt.width===800&&rt.height===500)
  await click(full,false)
  await page.waitForFunction(()=>document.webkitFullscreenElement===document.documentElement&&$('startFullscreen').textContent==='Exit fullscreen')
  await click(full,false)
  assert.equal(await page.evaluate(()=>document.webkitFullscreenElement),null)
  errors.push(...await page.evaluate(()=>window.__viewportErrors))
 }finally{await remove(legacy)}
 console.log('가시영역·안전 여백·회전·모달·전체 화면 실제 진입/해제 및 거부·접두사/가시영역 미지원 대체 경로 통과')
 assert.deepEqual(errors,[],'페이지 에러')
}finally{
 await remove(unavailable).catch(()=>{})
 await remove(visual).catch(()=>{})
 await remove(errorProbe)
 await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false})
 await page.cdp('Emulation.clearDeviceMetricsOverride')
}
