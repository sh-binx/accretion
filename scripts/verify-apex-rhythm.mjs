import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire('/Users/chodaehee/dev/stone-still/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
 const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;let n=42;Math.random=()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296)});
 await p.goto('http://localhost:3040/?dev=1&lang='+(process.env.TEST_LANG||'en'));await p.waitForFunction(()=>window.__acc);
 const warning=await p.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(400);A.setInv(100);A.step(.3);A.setInv(100);A.setSpawn(false);A.state.evT=1000;A.fireEvent('blast');return A.eventState()});
 assert.equal(warning.blasts,0,'예고 중 실제 폭발 횟수 0');assert(warning.warning,'예고 상태가 필요');
 const hit=await p.evaluate(()=>{const A=window.__acc,q=A.eventState().warning;A.step(1.904);A.placeNemesis(q.x,q.z);A.step(.208);const start=A.nemesis();A.setMass(100);A.step(1);return {start,after:A.nemesis(),ev:A.eventState()}});
 assert.equal(hit.ev.blasts,1);assert.equal(hit.ev.warning,null);assert(hit.start.supplyPause>7,'충격파 범위의 적 공급 중단');assert(hit.after.mass>=hit.start.mass-.01,'질량을 자동으로 낮추지 않음');
 const attack=await p.evaluate(()=>{const A=window.__acc;A.setMass(A.nemesis().mass*1.2);hud();return document.querySelector('#apex').textContent});assert((attack.includes('CONSUME IT')||attack.includes('삼켜라'))&&/(WINDOW|기회).*?[1-8]s/.test(attack),'공격 가능할 때도 기회 종료 시간 표시');
 const expired=await p.evaluate(()=>{const A=window.__acc;A.placeNemesis(1000,1000);A.step(8.32);hud();return {n:A.nemesis(),text:document.querySelector('#apex').textContent}});assert.equal(expired.n.supplyPause,0);assert(!/WINDOW|기회/.test(expired.text),'공급 회복 뒤 타이머 제거');
 const recovery=await p.evaluate(()=>{const A=window.__acc;A.setMass(400);A.eatNemesis();for(let i=0;i<20;i++){A.setMass(400);A.step(.208)}const early=A.nemesis();for(let i=0;i<42;i++){A.setMass(400);A.step(.208)}return {early,late:A.nemesis(),t:A.state.t,alive:A.state.alive,mass:A.state.mass}});
 assert.equal(recovery.early,null,'처치 4초 뒤 추격자 없음');assert(recovery.late,'12초 뒤 추격 재개');
 const miss=await p.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(400);A.setInv(100);A.step(.3);A.setInv(100);A.setSpawn(false);A.state.evT=1000;A.fireEvent('blast');const q=A.eventState().warning;A.step(1.904);A.placeNemesis(q.x+q.radius*3,q.z);A.step(.208);return A.nemesis()});
 assert.equal(miss.supplyPause,0,'범위 밖 적은 영향 없음');
 const reset=await p.evaluate(()=>{const A=window.__acc;A.fireEvent('blast');A.begin();return A.eventState()});assert.equal(reset.warning,null);assert.equal(reset.blasts,0);
 const ended=await p.evaluate(()=>{const A=window.__acc;A.setMass(400);A.step(.1);A.fireEvent('blast');A.gameOver();return A.eventState()});assert.equal(ended.warning,null,'게임 종료 시 예고 제거');
 assert.deepEqual(errors,[]);console.log('충격파 예고·적중/회피·추격 휴식·재시작 검증 통과');
}finally{await browser.close()}
