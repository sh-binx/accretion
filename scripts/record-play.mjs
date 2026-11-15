// 정상 게임 루프 + 키보드 입력만 사용한다. 내부 상태는 경로 선택/검증을 위해 읽기만 한다.
import {createRequire} from 'node:module';import fs from 'node:fs';import {createHash} from 'node:crypto';
const require=createRequire('/Users/chodaehee/dev/stone-still/package.json');const {chromium}=require('playwright');
const sourceSha256=createHash('sha256').update(fs.readFileSync('index.html')).digest('hex');
const b=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
const c=await b.newContext({viewport:{width:960,height:600},recordVideo:{dir:'artifacts/20261115',size:{width:960,height:600}}});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://localhost:3040/');const gpu=await p.evaluate(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL)});console.log('GPU',gpu);await p.locator('#startBtn').click();let keys=new Set(),log=[];
try{for(let i=0;i<240;i++){
 const v=await p.evaluate(()=>{const q=hole.position;const food=objects.filter(o=>!o.eaten&&o.mass<S.mass&&(S.formIdx===2||o.type!=='rival')).sort((a,b)=>a.g.position.distanceToSquared(q)-b.g.position.distanceToSquared(q))[0];const danger=objects.filter(o=>!o.eaten&&o.mass>S.mass&&o.type==='rival').sort((a,b)=>a.g.position.distanceToSquared(q)-b.g.position.distanceToSquared(q))[0];return {alive:S.alive,mass:S.mass,t:S.t,choice:choiceOpen,dx:food?food.g.position.x-q.x:0,dz:food?food.g.position.z-q.z:-1,threat:danger?{dx:danger.g.position.x-q.x,dz:danger.g.position.z-q.z,d:danger.g.position.distanceTo(q)}:null,r:rad(S.mass),dev:typeof window.__acc}});
 if(!v.alive){log.push(v);break}if(v.choice)await p.keyboard.press('Digit1');
 let dx=v.dx,dz=v.dz;if(v.threat&&v.threat.d<v.r*5){dx=-v.threat.dx;dz=-v.threat.dz;await p.keyboard.press('Space')}
 const next=new Set();if(Math.abs(dx)>Math.abs(dz)*.3)next.add(dx>0?'KeyD':'KeyA');if(Math.abs(dz)>Math.abs(dx)*.3)next.add(dz>0?'KeyS':'KeyW');
 for(const k of keys)if(!next.has(k))await p.keyboard.up(k);for(const k of next)if(!keys.has(k))await p.keyboard.down(k);keys=next;
 if(i%20===0){log.push(v);console.log(JSON.stringify({i,mass:v.mass,t:v.t,alive:v.alive}));await p.screenshot({path:`artifacts/20261115/play-${i}.png`})}await p.waitForTimeout(500);
 }for(const k of keys)await p.keyboard.up(k);await p.screenshot({path:'artifacts/20261115/play-end.png'});
}finally{const video=p.video();await c.close();console.log('VIDEO',await video.path());fs.writeFileSync('artifacts/20261115/play-evidence.json',JSON.stringify({mode:'production; read-only observation; keyboard input; unmodified realtime loop; video has no audio',sourceSha256,gpu,errors,log},null,2));await b.close()}
