import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const require=createRequire('/Users/chodaehee/dev/stone-still/package.json');const {chromium}=require('playwright');
const b=await chromium.launch({headless:false,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:640,height:400}});await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto('http://localhost:3040/?dev=1');
const r=await p.evaluate(()=>{const A=window.__acc;A.begin();hideOnboard();A.setMass(1000);A.clearObjs();A.clearFeats();A.setSpawn(false);for(let i=0;i<300;i++)updateCamera(.016);
 const types=['rival','gascloud','nucleus','binary','giant','comet','rock','planet'];
 const cycle=()=>{for(const t of types)spawnObj(t,10,0,15);render();A.clearObjs();render();return renderer.info.memory.geometries};
 const warm=cycle(),counts=[];for(let i=0;i<8;i++)counts.push(cycle());return {warm,counts}});
console.log(JSON.stringify(r));assert(r.counts.every(n=>n<=r.warm+2),'천체 제거 뒤 GPU 기하 수가 누적되면 안 됨');console.log('천체 생성/제거 8회 GPU 기하 안정');}finally{await b.close()}
