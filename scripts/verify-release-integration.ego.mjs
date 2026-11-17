// 운영판 병합 집중 준비 시험: 정산·저장·지형 수명. 실제 완주는 별도 영상으로 검증한다.
const assert=(await import('node:assert')).strict;
const page=(await taskSpace(spaceId)).page('p1');
await page.goto('http://localhost:3040/?dev=1&lang=ko');
await page.waitForFunction(()=>window.__acc);
console.log(await page.snapshot());
await page.click('#startBtn');
const result=await page.evaluate(()=>{
 const A=__acc;hideOnboard();const checks=[];const check=(name,pass,detail)=>checks.push({name,pass,detail});
 // 이 검수 출처의 앱 키만 관리한다. 다른 출처/프로필 저장소는 건드리지 않는다.
 for(const k of ['acc_dust','acc_up','acc_streak','acc_runs'])localStorage.removeItem(k);
 A.begin();S.peak=500;S.t=95;const r=settleRun(),d=dustBal(),runs=+readRecord('acc_runs');
 // 성공 패널 계속 경로는 런을 재생성하지 않으며 실패 때 재정산하지 않는다.
 PAUSE.result=true;continueAfterCore();S.peak=1000;S.t=120;A.gameOver();
 check('성공→계속→실패 한 런 1회 정산',dustBal()===d&&+readRecord('acc_runs')===runs,{d,balance:dustBal(),runs:readRecord('acc_runs')});
 A.begin();S.peak=2000;S.t=90;settleRun();const before=dustBal();PAUSE.result=true;$('coreRestart').click();
 check('성공→새 판 이전 정산 보존',dustBal()===before&&S.dustSettlement===null&&S.alive,{before,balance:dustBal()});
 const RealDate=Date;let day=1;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[2026,10,day,23,59,59]))}};
 localStorage.removeItem('acc_streak');A.begin();settleRun();const one=S.dustSettlement;
 day=2;settleRun();check('날짜 넘어도 같은 런 재정산 없음',S.dustSettlement===one&&streakInfo().n===1);
 A.begin();settleRun();check('다음 날짜 첫 런 연속 증가',streakInfo().n===2&&S.dustSettlement.daily===14,S.dustSettlement);
 day=4;A.begin();settleRun();check('하루 건너뛰면 연속 리셋',streakInfo().n===1&&S.dustSettlement.daily===10,S.dustSettlement);window.Date=RealDate;
 localStorage.setItem('acc_up',JSON.stringify({head:2,evap:3,charge:2,shield:2}));localStorage.setItem('acc_dust','137');A.begin();
 check('저장 업그레이드 모두 적용',S.mass===1.2*1.55&&S.modEvap===.76&&S.chargeMul===1.24&&S.shield===3,{mass:S.mass,evap:S.modEvap,charge:S.chargeMul,shield:S.shield});
 A.clearField();A.setSpawn(false);clearFeats();
 let shared=0;SPH.addEventListener('dispose',()=>shared++);ROCK.addEventListener('dispose',()=>shared++);
 for(const type of ['wormhole','remnant','nebula']){
  const f=mkFeat(type,0,0),geos=new Set(),mats=new Set(),textures=new Set();let gd=0,md=0,td=0;
  f.g.traverse(o=>{if(o.geometry&&!o.isSprite)geos.add(o.geometry);if(o.material){mats.add(o.material);if(o.material.map)textures.add(o.material.map)}});
  for(const g of geos)g.addEventListener('dispose',()=>gd++);for(const m of mats)m.addEventListener('dispose',()=>md++);for(const t of textures)t.addEventListener('dispose',()=>td++);
  releaseFeat(f);releaseFeat(f);check(type+' 소유 geometry/material 한 번 해제',gd===geos.size&&md===mats.size&&td===0&&!feats.includes(f),{gd,md,td});
 }
 const cycle=()=>{for(const type of ['wormhole','remnant','nebula'])mkFeat(type,0,0);render();clearFeats();render();return renderer.info.memory.geometries};
 const warm=cycle(),counts=[];for(let i=0;i<20;i++){A.begin();A.clearField();A.setSpawn(false);clearFeats();counts.push(cycle())}
 check('새 런 20회 지형 GPU 안정·공유기하 보존',counts.every(n=>n<=warm+2)&&shared===0,{warm,counts,shared});
 return checks;
});
for(const r of result){console.log(JSON.stringify(r));assert(r.pass,r.name)}
await page.reload();await page.waitForFunction(()=>window.__acc);await page.click('#startBtn');
assert.deepEqual(await page.evaluate(()=>[S.mass,S.modEvap,S.chargeMul,S.shield,dustBal()]),[1.2*1.55,.76,1.24,3,137]);
console.log('새로고침 이후 기존 저장값 유지·적용 통과');
