// DOM TouchEvent 회귀 시험. 실제 손가락/기기 검증을 대체하지 않는다.
// 호출 앞에 const spaceId=<현재 공간>; 를 붙인다.
const assert = (await import('node:assert')).strict;
const t=await taskSpace(spaceId),p=t.page('p1');
await p.goto('http://localhost:3040/?lang=ko&qa='+Date.now());
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
