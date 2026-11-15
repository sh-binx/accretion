// ego-browser nodejs < scripts/verify-flight-ui.ego.mjs
// 같은 작업의 관리 탭을 사용한다. spaceId·tab·artifact 경로는 실행 시 스크립트 맨 앞에 지정한다.
// 예: { printf 'const spaceId = 1234, tab = "p1", output = "/absolute/artifacts";\n'; cat scripts/verify-flight-ui.ego.mjs; } | ego-browser nodejs
const {strict: assert}=await import('node:assert')
const {mkdir}=await import('node:fs/promises')
const task=await taskSpace(spaceId)
const page=task.page(tab)
const base='http://localhost:3040/'
async function touch(x,y){
 await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
 await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
}
async function hit(selector,isTouch,label){
 if(!isTouch)return page.click(selector,{label})
 const [x,y]=await page.evaluate(s=>{
  const r=document.querySelector(s).getBoundingClientRect()
  if(!r.width||!r.height)throw Error('숨겨진 대상: '+s)
  return [r.x+r.width/2,r.y+r.height/2]
 },selector)
 return touch(x,y)
}
async function shot(size,state){
 if(state==='onboard')await page.waitForFunction(()=>getComputedStyle($('onb')).opacity==='1')
 if(state==='play')await page.waitForFunction(()=>getComputedStyle($('hud')).opacity==='1')
 if(state==='core')await page.waitForFunction(()=>getComputedStyle($('codex')).opacity==='1')
 await page.screenshot({path:output+'/'+size+'-'+state+'.png'})
}
async function menuTargets(size,state){
 const {controls,overlaps}=await page.evaluate(state=>{
  const selectors=state==='start'
   ? ['#ribbon','#startBtn','#subs button','#startDailyBoard','#start .wm','#start .tl','#start .namerow','#chips span.stat']
   : ['#retryBtn','#over .linkbtn','#overTitle','#overMsg','#overStat','#resultTier','#rankline']
  const rows=[...document.querySelectorAll(selectors.join(','))]
   .filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility==='visible')
   .map(e=>({e,r:e.getBoundingClientRect(),id:e.id||e.className}))
  const controls=rows.filter(({e})=>e instanceof HTMLButtonElement).map(({e,r,id})=>({
   id,w:r.width,h:r.height,inView:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
   hit:[[r.left+2,r.y+r.height/2],[r.right-2,r.y+r.height/2],[r.x+r.width/2,r.top+2],[r.x+r.width/2,r.bottom-2],[r.x+r.width/2,r.y+r.height/2]]
    .every(([x,y])=>e.contains(document.elementFromPoint(x,y)))
  }))
  const overlaps=rows.flatMap(({e,r,id},i)=>rows.slice(i+1).filter(({e:other,r:s})=>
   (e instanceof HTMLButtonElement||other instanceof HTMLButtonElement)&&r.width&&r.height&&s.width&&s.height&&
   Math.min(r.right,s.right)>Math.max(r.left,s.left)&&Math.min(r.bottom,s.bottom)>Math.max(r.top,s.top)
  ).map(({id:other})=>[id,other]))
  return {controls,overlaps}
 },state)
 for(const id of state==='start'?['ribbon','startBtn','startCodex','startAwards','startLang']:['retryBtn','overCodex']){
  assert(controls.some(c=>c.id===id),size+' '+state+' 누락: '+id)
 }
 console.log(size,state,JSON.stringify({controls,overlaps}))
 assert.deepEqual(controls.filter(c=>c.w<46||c.h<46||!c.inView||!c.hit),[],size+' '+state+' 메뉴/결과의 실제 터치 영역')
 assert.deepEqual(overlaps,[],size+' '+state+' 겹치는 요소')
}
const abilityState=()=>page.evaluate(()=>[S.surgeCount,S.pulseCount,S.waveCount,$('mute').getAttribute('aria-pressed')])
async function verifyAbilityFocus(){
 // 실제 포인터 클릭 뒤 DOM에 포커스를 주입하지 않고 바로 Space를 보낸다.
 for(const [id,index] of [['mute',3],['actPulse',1],['actWave',2]]){
  await page.waitForFunction(()=>!__acc.state.surging)
  await page.evaluate(()=>{__acc.setEnergy(1);hud()})
  const before=await abilityState()
  await hit('#'+id,false,'포인터로 비행 버튼 실행')
  const activated=[...before]
  activated[index]=index===3?String(before[3]==='false'):before[index]+1
  assert.deepEqual(await abilityState(),activated,id+' 실제 클릭 효과')
  await page.evaluate(()=>__acc.setEnergy(1))
  await page.keyboard.press('Space')
  const expected=[...activated];expected[0]++
  const actual=await abilityState()
  console.log(id,'클릭 후 Space',JSON.stringify({actual,expected}))
  assert.deepEqual(actual,expected,id+' 클릭 뒤 Space는 대시만 실행')
 }
 await page.waitForFunction(()=>!__acc.state.surging)
 // 탐색은 실제 Tab으로 하고 Space/Enter의 기본 버튼 동작과 초점 유지를 확인한다.
 for(let i=0;i<7&&await page.evaluate(()=>document.activeElement.id)!=='mute';i++)await page.keyboard.press('Shift+Tab')
 assert.equal(await page.evaluate(()=>document.activeElement.id),'mute','Tab 탐색으로 음소거 선택')
 const before=await abilityState()
 await page.evaluate(()=>__acc.setEnergy(1))
 await page.keyboard.press('Space')
 assert.deepEqual(await abilityState(),[...before.slice(0,3),String(before[3]==='false')])
 assert.equal(await page.evaluate(()=>document.activeElement.id),'mute')
 // HTMLElement.click()은 detail=0인 비포인터 활성화 경로를 검증하는 대리 입력이다.
 await page.evaluate(()=>$('mute').click())
 assert.deepEqual(await abilityState(),before)
 assert.equal(await page.evaluate(()=>document.activeElement.id),'mute','detail=0 클릭 뒤 버튼 초점 유지')
 for(let i=0;i<3;i++)await page.keyboard.press('Tab')
 assert.equal(await page.evaluate(()=>document.activeElement.id),'actPulse','Tab 탐색으로 당기기 선택')
 await page.keyboard.press('Enter')
 assert.deepEqual(await abilityState(),[before[0],before[1]+1,before[2],before[3]])
 assert.equal(await page.evaluate(()=>document.activeElement.id),'actPulse')
 console.log('Tab·Space·Enter·detail=0 활성화 및 버튼 초점 유지')
 // 아래 공통 대시 검증도 실제 Space 입력을 이용한다.
 await hit('#mute',false,'포인터로 비행 포커스 복귀')
 await page.evaluate(()=>__acc.setEnergy(1))
 await page.keyboard.press('Space')
}
await mkdir(output,{recursive:true})
const variants=[[1280,720,false,'en'],[960,600,false,'ko'],[844,390,true,'en'],[667,375,true,'ko'],[390,844,true,'ko']]
try{
 for(const [width,height,mobile,lang] of variants){
  const size=width+'x'+height
  if(typeof reviewSizes!=='undefined'&&!reviewSizes.includes(size))continue
  await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1,screenOrientation:{type:width>height?'landscapePrimary':'portraitPrimary',angle:width>height?90:0}})
  await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:3})
  await page.goto(base+'?dev=1&lang='+lang)
  await page.waitForFunction(()=>!!window.__acc)
  assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight,document.body.classList.contains('touch')]),[width,height,mobile])
  if(height>width){
   const guard=await page.evaluate(()=>({paused:__acc.pauseState().orient,visible:document.querySelector('#rotate').classList.contains('on'),text:document.querySelector('#rotate .s').textContent}))
   assert(guard.paused&&guard.visible)
   assert.match(guard.text,/가로/)
   await shot(size,'rotate')
   console.log(size,'세로 차단 및 가로 안내')
   continue
  }
  await shot(size,'start')
  if(mobile)await menuTargets(size,'start')
  await hit('#startBtn',mobile,'새 플레이 시작')
  await page.waitForFunction(()=>__acc.onboardOn())
  await shot(size,'onboard')
  if(!mobile)assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#obMoveK b')].map(e=>e.textContent).join('')),'WASD')
  if(mobile){
   await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:220}]})
   await page.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:155,y:220}]})
  }else await page.keyboard.down('d')
  try{await page.waitForFunction(()=>__acc.pos().x>.2,undefined,{timeout:5000})}
  finally{if(mobile)await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('d')}
  await page.evaluate(()=>{__acc.setInv(100);__acc.clearField();__acc.setSpawn(false);__acc.setMass(1000);__acc.step(.1);__acc.setEnergy(1);hud()})
  await page.waitForFunction(()=>document.querySelector('#actDash').getAttribute('aria-disabled')==='false')
  await shot(size,'play')
  if(width===1280){
   await page.keyboard.press('Shift+Tab')
   assert.deepEqual(await page.evaluate(()=>[S.energy,S.pulseCount]),[1,0])
   await page.keyboard.press('Shift')
   assert.deepEqual(await page.evaluate(()=>[S.energy,S.pulseCount]),[0,1])
   await verifyAbilityFocus()
  }
  else await hit('#actDash',mobile,'대시 능력 실행')
  await page.waitForFunction(()=>__acc.state.surging&&__acc.state.energy===0&&document.querySelector('#actDash').getAttribute('aria-disabled')==='true')
  await hit('#pauseBtn',mobile,'플레이 일시정지')
  await page.waitForFunction(()=>__acc.pauseState().manual)
  const paused=await page.evaluate(()=>({time:S.t,energy:S.energy,gp:__acc.pauseState().gp}))
  await page.waitForTimeout(180)
  assert.deepEqual(await page.evaluate(()=>({time:S.t,energy:S.energy,gp:__acc.pauseState().gp})),paused)
  assert.equal(paused.gp,false)
  await shot(size,'pause')
  await hit('#resumeBtn',mobile,'정지된 플레이 재개')
  await page.waitForFunction(t=>S.t>t&&__acc.pauseState().gp,paused.time)
  if(!mobile){
   await page.keyboard.press('Escape')
   assert(await page.evaluate(()=>__acc.pauseState().manual))
   await page.keyboard.press('Escape')
   assert(!await page.evaluate(()=>__acc.pauseState().manual))
  }
  await page.evaluate(()=>{__acc.choiceReal(true);openChoice('BLACK HOLE')})
  await page.waitForFunction(()=>__acc.choiceOn())
  const offered=await page.evaluate(()=>__acc.choiceOpts())
  await shot(size,'choice')
  if(mobile)await hit('#choiceWrap .cc:nth-child(2)',true,'두 번째 진화 선택')
  else if(width===960){await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.press('Enter')}
  else await page.keyboard.press('2')
  assert.deepEqual(await page.evaluate(()=>__acc.boons()),[offered[1]])
  assert(!await page.evaluate(()=>__acc.choiceOn()))
  await page.evaluate(()=>{
   __acc.choiceReal(false);__acc.setMass(16000);__acc.step(.1)
   MSGQ.length=0;msgUntil=0;pushMsg({kind:'c',type:'rival',pri:9,key:'ui-codex'})
   hud()
  })
  await page.waitForFunction(()=>!__acc.choiceOn()&&document.querySelector('#massbar').classList.contains('core-goal')&&document.querySelector('#cval').textContent.length>0)
  await shot(size,'core')
  if(mobile){
   const [x,y]=await page.evaluate(()=>{const r=$('actHold').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})
   await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
  }else if(width===1280){
   await page.waitForFunction(()=>!__acc.state.surging)
   await page.keyboard.press('Shift+Tab')
   assert.equal(await page.evaluate(()=>document.activeElement.id),'actHold')
   const [x,y]=await page.evaluate(()=>{const r=$('actHold').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})
   await page.mouse.move(x,y)
   await page.mouse.down()
  }else await page.keyboard.down('c')
  try{await page.waitForFunction(()=>$('actHold').getAttribute('aria-pressed')==='true')}
  finally{if(mobile)await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else if(width===1280)await page.mouse.up();else await page.keyboard.up('c')}
  await page.waitForFunction(()=>$('actHold').getAttribute('aria-pressed')==='false')
  if(width===1280){
   const before=await abilityState()
   await page.evaluate(()=>__acc.setEnergy(1))
   await page.keyboard.press('Space')
   assert.deepEqual(await abilityState(),[before[0]+1,...before.slice(1)],'포인터 붙잡기 해제 뒤 Space는 대시')
  }
  await page.evaluate(()=>__acc.gameOver())
  await shot(size,'over')
  if(mobile)await menuTargets(size,'over')
  await hit('#retryBtn',mobile,'새 플레이 다시 시작')
  await page.waitForFunction(()=>__acc.state.alive&&__acc.onboardOn())
  assert.deepEqual(await page.evaluate(()=>__acc.boons()),[])
  if(mobile){
   await page.cdp('Emulation.setDeviceMetricsOverride',{width:height,height:width,mobile:true,deviceScaleFactor:1})
   await page.waitForFunction(()=>__acc.pauseState().orient&&!__acc.pauseState().gp)
   await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,mobile:true,deviceScaleFactor:1})
   await page.waitForFunction(()=>!__acc.pauseState().orient&&__acc.pauseState().gp)
  }
  console.log(size,'이동 · 대시/재충전 · 일시정지/재개 · 진화 · 은하 중심 · 붙잡기 · 다시 시작 통과')
 }
}finally{
 await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false})
 await page.cdp('Emulation.clearDeviceMetricsOverride')
}
