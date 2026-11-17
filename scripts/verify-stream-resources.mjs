// 실제 흡수 루프에서 프레임별 기하 생성과 비유한 좌표를 검증한다.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire('/Users/chodaehee/dev/stone-still/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3040/?dev=1',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__acc);
 const result=await page.evaluate(()=>{
  const Original=THREE.TubeGeometry;let allocations=0,disposals=0,rebindings=0;
  THREE.TubeGeometry=class extends Original{constructor(...args){super(...args);allocations++}};
  const A=window.__acc;A.begin();A.setMass(1000);A.step(2);A.clearObjs();A.clearFeats();A.setSpawn(false);
  const dispose=THREE.BufferGeometry.prototype.dispose,setAttribute=THREE.BufferGeometry.prototype.setAttribute;
  THREE.BufferGeometry.prototype.dispose=function(){disposals++;return dispose.call(this)};
  THREE.BufferGeometry.prototype.setAttribute=function(...args){rebindings++;return setAttribute.apply(this,args)};
  const p=A.pos();A.spawnTagged(800,p.x+38,p.z,'planet');rebindings=0;disposals=0;
  const startIds=A.streamResources?.().map(s=>s.id);let frames=0,visible=false,finite=true,stable=true;
  for(let i=0;i<25;i++) {A.step(.016); if(A.feedState()){frames++;visible ||= A.streamOn();}
   if(A.streamResources){const states=A.streamResources();finite &&= states.every(s=>s.finite);stable &&= states.every((s,i)=>s.id===startIds[i]);}
  }
  const resources=A.streamResources?.();
  THREE.BufferGeometry.prototype.dispose=dispose;THREE.BufferGeometry.prototype.setAttribute=setAttribute;return {allocations,disposals,rebindings,frames,visible,finite,stable,resources};
 });
 console.log(JSON.stringify(result));
 await page.screenshot({path:'/tmp/accretion-stream-current.png'});
 assert(result.frames>5,'실제 흡수 프레임이 필요하다');
 assert(result.visible,'실제 흐름이 보여야 한다');
 assert.equal(result.allocations,0,'흡수 중 TubeGeometry를 새로 생성하지 않는다');
 assert(result.finite,'정점은 유한해야 한다');assert(result.stable,'모든 프레임에서 geometry UUID 유지');assert.equal(result.disposals,0,'흡수 중 기하 폐기 없음');assert.equal(result.rebindings,0,'흡수 중 속성 버퍼 교체 없음');
 assert(result.resources?.length===4,'슬롯 4개의 자원 확인');
 const cleanup=await page.evaluate(()=>{const A=window.__acc;for(let i=0;i<150;i++)A.step(.02);const end=A.streamResources();A.clearObjs();A.clearFeats();const p=A.pos();A.spawnTagged(A.state.mass*.8,p.x+Math.cbrt(A.state.mass)*3.8,p.z,'planet');A.step(.032);const active=A.streamResources().some(s=>s.visible);A.begin();return {end,active,reset:A.streamResources()}});
 assert(cleanup.end.every(s=>!s.visible),'흡수 종료 시 흐름 숨김');
 assert(cleanup.active,'흡수가 실제 진행 중인 상태에서 재시작');
 assert(cleanup.reset.every(s=>!s.visible),'재시작 시 흐름 숨김');
 assert.deepEqual(errors,[]);console.log('흡수 자원 검증 통과');
}finally{await browser.close()}
