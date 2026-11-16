// DOM 소유권 회귀와 Ego 터치 프로토콜로 실제 발동을 함께 검증한다.
// 호출 앞에 const spaceId=<현재 공간>; 를 붙인다.
const assert = (await import('node:assert')).strict;
const t=await taskSpace(spaceId),p=t.page('p1');
const base='http://localhost:'+(typeof testPort==='number'?testPort:3040)+'/';
await p.goto(base+'?lang=ko&qa='+Date.now());
await p.click('#startBtn');
const results=await p.evaluate(()=>{
 const canvas=renderer.domElement,button=document.querySelector('#actDash');
 const touch=(id,x,target=canvas)=>new Touch({identifier:id,target,clientX:x,clientY:240});
 const send=(type,touches,changed,target=canvas)=>target.dispatchEvent(new TouchEvent(type,{touches,changedTouches:changed,targetTouches:touches.filter(t=>t.target===target),bubbles:true,cancelable:true}));
 const checks=[];const check=(name,ok)=>checks.push({name,ok});
 let left=touch(1,100),right=touch(2,700,button);
 send('touchstart',[left],[left]);left=touch(1,150);send('touchmove',[left],[left]);
 send('touchstart',[left,right],[right],button);
 check('능력 접촉 중 이동 유지',joyOn&&joyMag>.8);
 send('touchend',[right],[left]);check('이동 손가락만 해제해도 정지',!joyOn&&joyMag===0);
 send('touchend',[],[right],button);
 send('touchstart',[right],[right],button);left=touch(3,100);send('touchstart',[right,left],[left]);left=touch(3,150);send('touchmove',[right,left],[left]);
 check('능력 먼저 누른 뒤 이동 시작',joyOn&&joyTouchId===3&&joyMag>.8);
 send('touchend',[left],[right],button);check('능력 해제 뒤 이동 유지',joyOn&&joyMag>.8);
 const extra=touch(4,400);send('touchstart',[left,extra],[extra]);check('두번째 캔버스 터치가 원점 변경하지 않음',joyTouchId===3&&joyMag>.8);
 send('touchcancel',[left],[extra]);check('다른 터치 취소는 이동 유지',joyOn&&joyMag>.8);
 send('touchcancel',[],[left]);check('조종 터치 취소 시 정지',!joyOn&&joyMag===0);
 left=touch(5,100);send('touchstart',[left],[left]);left=touch(5,150);send('touchmove',[left],[left]);
 showPause(true);send('touchmove',[left],[left]);showPause(false);
 check('일시정지 후 재개해도 잔류 터치로 이동하지 않음',!joyOn&&joyMag===0&&joyTouchId===null);
 send('touchend',[],[left]);
 return checks;
});
for(const result of results){console.log(result);assert(result.ok,result.name)}
await p.keyboard.press('Escape');

// Ego Chromium의 직접 입력 경로에서 좌표/ID가 있는 touchEnd로 손가락 하나만 뗀다.
const send=(type,touchPoints)=>p.cdp('Input.dispatchTouchEvent',{type,touchPoints})
const joyDown={id:1,x:95,y:175},joyMove={id:1,x:151,y:175}
const startSteering=async()=>{
 await send('touchStart',[joyDown])
 await send('touchMove',[joyMove])
}
const point=(id,n=2)=>p.evaluate(([id,n])=>{
 const r=$(id).getBoundingClientRect()
 return {id:n,x:r.x+r.width/2,y:r.y+r.height/2}
},[id,n])
const state=()=>p.evaluate(()=>({
 energy:S.energy,counts:[S.surgeCount,S.pulseCount,S.waveCount,S.flareCount],steer:steer(),
 effects:[S.surgeT>0,S.shake>0,shock.visible,S.jetFire>0],
 hold:holdCap,manual:PAUSE.manual,
 clicks:window.testClicks
}))
async function tapWhileSteering(id,motion=true){
 const down=await point(id)
 const up=motion?{...down,x:down.x+2,y:down.y+2}:down
 await send('touchStart',[down])
 if(motion)await send('touchMove',[up])
 await send('touchEnd',[up])
}
async function prepare(energy=1){
 await p.evaluate(energy=>{
  __acc.clearField();__acc.setSpawn(false);clearFeats()
  S.invT=100
  if(!jetsReady){__acc.setMass(16000);__acc.step(.1)}
  S.surgeT=0;S.shake=0;S.jetFire=0;S.energy=energy;shock.visible=false;hud()
  window.testClicks=0
 },energy)
}
const skills=['actDash','actPulse','actWave','actFlare']
const failures=[]
try{
 await p.cdp('Emulation.setDeviceMetricsOverride',{width:844,height:390,mobile:true,deviceScaleFactor:1})
 await p.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3})
 await p.goto(base+'?dev=1&lang=ko&qa='+Date.now())
 await p.click('#startBtn',{label:'멀티터치 검증 시작'})
 await p.waitForFunction(()=>S.alive&&!PAUSE.on)
 await p.evaluate(()=>{
  hideOnboard()
  window.testTrace=[]
  for(const type of ['touchstart','touchmove','touchend','click'])addEventListener(type,e=>{
   const button=e.target.closest?.('.act')
   if(type==='click'&&button)window.testClicks++
   if(testTrace.length<80)testTrace.push([type,button?.id||e.target.tagName,e.defaultPrevented,Array.from(e.touches??[]).map(t=>t.identifier),e.isTrusted])
  })
 })
 await prepare()
 await startSteering()
 const initial=await state()
 if(initial.steer.mag!==1)console.log('첫 손가락 추적',JSON.stringify(await p.evaluate(()=>[innerWidth,innerHeight,S.alive,S.t,PAUSE.on,document.elementFromPoint(95,175)?.tagName,testTrace])))
 assert.deepEqual(initial.steer,{x:1,z:0,mag:1},'첫 손가락 조이스틱 이동')
 for(const [i,id] of skills.entries()){
  await prepare(.5)
  const empty=await state()
  assert.equal(await p.evaluate(id=>$(id).getAttribute('aria-disabled'),id),'true')
  await tapWhileSteering(id,false)
  const depleted=await state()
  assert.equal(depleted.energy,.5,id+' 충전 미달 시 차감 금지')
  assert.deepEqual(depleted.counts,empty.counts,id+' 충전 미달 시 발동 금지')
  assert.deepEqual(depleted.steer,empty.steer,id+' 충전 미달 시 조이스틱 유지')
  await prepare()
  const before=await state()
  assert.equal(await p.evaluate(id=>$(id).getAttribute('aria-disabled'),id),'false',id+' 사용 가능')
  assert.deepEqual(before.steer,{x:1,z:0,mag:1})
  await tapWhileSteering(id)
  const after=await state()
  console.log(JSON.stringify({skill:id,before,after}))
  try{
   assert.deepEqual(after.counts,before.counts.map((n,k)=>k===i?n+1:n),id+' 준비된 스킬 정확히 한 번 발동')
   assert.equal(after.energy,0,id+' 에너지 한 번 차감')
   assert.equal(after.effects[i],true,id+' 실제 발동 효과')
   assert.deepEqual(after.steer,before.steer,id+' 조이스틱 방향·강도 유지')
   assert.equal(after.clicks,0,id+' 후속 호환 click 없음')
  }catch(error){failures.push(error.message)}
 }
 console.log('버튼 전달 이벤트',JSON.stringify(await p.evaluate(()=>testTrace)))
 assert.deepEqual(failures,[])

 // 제트 이외 세 스킬은 대시 지속 중 기존대로 잠긴다.
 await prepare()
 for(const id of skills.slice(0,3)){
  await p.evaluate(()=>{S.surgeT=1;hud()})
  const before=await state()
  assert.equal(await p.evaluate(id=>$(id).getAttribute('aria-disabled'),id),'true')
  await tapWhileSteering(id)
  const after=await state()
  assert.deepEqual(after.counts,before.counts)
  assert.equal(after.energy,1)
 }
 await prepare()
 const beforeCancel=await state()
 const pulse=await point('actPulse')
 await send('touchStart',[pulse])
 const outside={...pulse,x:460,y:200}
 await send('touchMove',[outside])
 await send('touchEnd',[outside])
 assert.deepEqual(await state(),beforeCancel,'버튼 밖에서 떼면 발동 없이 조이스틱 유지')
 await send('touchStart',[pulse])
 await send('touchCancel',[])
 const cancelled=await state()
 assert.deepEqual(cancelled.counts,beforeCancel.counts)
 assert.equal(cancelled.energy,1)
 assert.equal(cancelled.steer.mag,0)

 // 붙잡기는 누르는 입력으로 독립 실행하며, 어느 손을 먼저 떼도 소유권이 섞이지 않는다.
 for(const leftFirst of [false,true]){
  await startSteering()
  const hold=await point('actHold')
  await send('touchStart',[hold])
  assert.equal((await state()).hold,true)
  assert.equal((await state()).steer.mag,1)
  await send('touchEnd',[leftFirst?joyMove:hold])
  const one=await state()
  assert.equal(one.hold,leftFirst)
  assert.equal(one.steer.mag,leftFirst?0:1)
  await send('touchEnd',[leftFirst?hold:joyMove])
  assert.deepEqual(await p.evaluate(()=>[holdCap,joyOn]),[false,false])
 }

 // 접촉 중 열린 화면을 닫은 뒤에도 이전 터치가 다음 런/조작에 살아나지 않는다.
 for(const overlay of ['pause','choice','restart']){
  await prepare()
  await startSteering()
  await send('touchStart',[pulse])
  await p.evaluate(overlay=>{
   if(overlay==='pause'){showPause(true);showPause(false)}
   if(overlay==='choice'){__acc.choiceReal(true);openChoice('QUASAR');takeBoon(window.__choicePick[0]);__acc.choiceReal(false)}
   if(overlay==='restart'){__acc.gameOver();begin();hideOnboard();__acc.clearField();__acc.setSpawn(false);__acc.setMass(16000);__acc.step(.1);S.energy=1;hud()}
  },overlay)
  const before=await state()
  await send('touchEnd',[pulse])
  const after=await state()
  assert.deepEqual(after.counts,before.counts,overlay+' 모달 진입 전 접촉 무효화')
  assert.equal(after.energy,1)
  await send('touchEnd',[])
 }

 // 한 손 탭에서도 호환 클릭의 이중 경로가 생기지 않는다. 이후 실제 마우스와 키보드도 사용한다.
 await prepare()
 const solo=await point('actWave')
 const beforeSolo=await state()
 await send('touchStart',[solo])
 await send('touchEnd',[])
 await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
 const afterSolo=await state()
 assert.equal(afterSolo.counts[2],beforeSolo.counts[2]+1)
 assert.equal(afterSolo.energy,0)
 assert.equal(afterSolo.clicks,0)
 await p.cdp('Emulation.setTouchEmulationEnabled',{enabled:false})
 await prepare()
 const beforeClick=await state()
 const mouse=await point('actPulse')
 await p.mouse.click(mouse.x,mouse.y,{label:'마우스로 당기기 검증'})
 assert.equal((await state()).counts[1],beforeClick.counts[1]+1)
 assert.equal((await state()).energy,0)
 await prepare()
 const beforeKey=await state()
 await p.focus('#actWave')
 await p.keyboard.press('Space')
 assert.equal((await state()).counts[2],beforeKey.counts[2]+1)
 assert.equal((await state()).energy,0)
 assert.equal(await p.evaluate(()=>document.activeElement.id),'actWave')
 console.log('충전·대시 잠금·밖에서 떼기·취소·붙잡기·정지/진화/재시작·한 손 탭·마우스·키보드 통과')
}finally{
 await send('touchEnd',[]).catch(()=>{})
 await p.cdp('Emulation.setTouchEmulationEnabled',{enabled:false})
 await p.cdp('Emulation.clearDeviceMetricsOverride')
}
