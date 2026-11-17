// ego lite 검수 공간의 정상 프로덕션 페이지를 실제 키보드 입력으로 진행한다. 관찰은 읽기 전용이며 게임 상태·시계·난수를 조작하지 않는다.
const fs=await import('node:fs');
const {createHash}=await import('node:crypto');
const root='/Users/chodaehee/dev/accretion';
let out;
// ego-browser nodejs < scripts/verify-core-play.ego.mjs 로 실행. 현재 검수 공간/탭을 먼저 확인해 전달한다.
const target=JSON.parse(fs.readFileSync(root+'/artifacts/core-play-target.json','utf8'));
out=root+'/artifacts/'+(target.outputDir||'core-play-ego');fs.mkdirSync(out,{recursive:true});
const task=await taskSpace(target.spaceId);const page=task.page(target.pageLabel);
const report={sourceSha256:createHash('sha256').update(fs.readFileSync(root+'/index.html')).digest('hex'),mode:'production; read-only state observation; real keyboard input; unmodified game clock; screenshot evidence; optional canvas video with existing game audio (DOM HUD excluded)',runs:[]};
let success=false, completed=false;
const eventErrors=[];const frames=[];let recording=false;
async function drain(){for(const event of await page.events())if(event.method==='Runtime.exceptionThrown')eventErrors.push(event.params?.exceptionDetails||event)}

try{
 for(let run=0;run<(target.maxRuns||3)&&!success;run++){
  const errors=[],samples=[];let held=new Set();
  const runSourceSha256=createHash('sha256').update(fs.readFileSync(root+'/index.html')).digest('hex');
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:960,height:600,deviceScaleFactor:1,mobile:false});
  await page.goto('http://localhost:3040/');
  await page.cdp('Runtime.enable');
  if(target.record&&!recording){recording=true}
  console.log(await page.snapshot());
  report.gpu=await page.evaluate(()=>{const g=renderer.getContext(),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown'});
  await page.click('#startBtn');
  if(target.canvasVideo)await page.evaluate(()=>{
   const stream=renderer.domElement.captureStream(30), chunks=[];let audio;
   if(AU.ac&&AU.master){audio=AU.ac.createMediaStreamDestination();AU.master.connect(audio);for(const track of audio.stream.getAudioTracks())stream.addTrack(track)}
   const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
   const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
   const done=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{const b=new Uint8Array(await new Blob(chunks,{type:mime}).arrayBuffer());let binary='';for(let i=0;i<b.length;i+=32768)binary+=String.fromCharCode(...b.subarray(i,i+32768));stream.getTracks().forEach(t=>t.stop());if(audio)AU.master.disconnect(audio);resolve(btoa(binary))}});
   window.__qaCapture={recorder,done};recorder.start(1000);
  });
  const start=Date.now();let lastLog=-10,state;
  while(Date.now()-start<(target.maxDurationMs||240000)){
   state=await page.evaluate(()=>{
    const q=hole.position,r=rad(S.mass),bh=S.formIdx===2;
    return {alive:S.alive,t:S.t,mass:S.mass,tier:S.tierIdx,form:S.formIdx,r,energy:S.energy,coreEaten,dev:typeof window.__acc,
     core:{x:galCore.position.x-q.x,z:galCore.position.z-q.z},choice:choiceOpen,boons:(window.__choicePick||[]).map(b=>b.id),
     objects:objects.filter(o=>!o.eaten).map(o=>({x:o.g.position.x-q.x,z:o.g.position.z-q.z,m:o.mass,r:o.r,
       dangerous:o.type==='rival'?(o.mass>=S.mass||!bh):(!bh&&o.mass>=S.mass),feeding:!!feedOf(o)}))};
   });
   if(state.t-lastLog>=10||!state.alive||state.coreEaten){lastLog=state.t;const {objects,...sample}=state;samples.push(sample);console.log(JSON.stringify({run,t:state.t,mass:state.mass,tier:state.tier,coreEaten:state.coreEaten,alive:state.alive}));await page.screenshot({path:`${out}/run-${run}-${Math.floor(state.t)}.png`})}
   if(state.dev!=='undefined')throw new Error('프로덕션에 DEV 훅이 노출됨');
   if(!state.alive||state.coreEaten){success=state.coreEaten;break}
   if(state.choice){await page.keyboard.press('Digit1');await page.waitForTimeout(80);continue}
   const dangers=state.objects.filter(o=>o.dangerous),food=state.objects.filter(o=>!o.dangerous&&!o.feeding);
   let aim=state.core;
   if(state.tier<3){
    food.sort((a,b)=>{
     const score=o=>{const d=Math.hypot(o.x,o.z);let risk=0;for(const h of dangers){const hd=Math.hypot(h.x-o.x,h.z-o.z);risk+=Math.max(0,(h.r*2.5+state.r*3-hd))/(state.r+1)}return d/(state.r+1)+risk*8-Math.min(3,o.m/state.mass)*2};return score(a)-score(b)});
    aim=food[0]||{x:0,z:1};
   }
   const al=Math.hypot(aim.x,aim.z)||1;let best={score:-Infinity,x:0,z:0};
   for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[.707,-.707],[-.707,.707],[-.707,-.707]]){
    let score=(x*aim.x+z*aim.z)/al*3;
    const step=(16+state.r*5)*.7;
    for(const h of dangers){const d=Math.hypot(h.x,h.z),next=Math.hypot(h.x-x*step,h.z-z*step),safe=h.r*1.55+state.r*2.5;
     if(next<safe)score-=12*(1-next/safe);if(d<safe*2)score+=(next-d)/(state.r+1)*2;
    }
    if(score>best.score)best={score,x,z};
   }
   const next=new Set();if(best.x)next.add(best.x>0?'KeyD':'KeyA');if(best.z)next.add(best.z>0?'KeyS':'KeyW');
   for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;
   const imminent=dangers.some(o=>Math.hypot(o.x,o.z)<o.r*1.55+state.r*5);
   if(imminent){await page.keyboard.press('Space');if(state.tier>=3)await page.keyboard.press('KeyF')}
   if(recording){const path=out+'/frame-'+String(frames.length).padStart(6,'0')+'.png';await page.screenshot({path});frames.push({path,time:Date.now()/1000})}
   await page.waitForTimeout(60);
  }
  for(const k of held)await page.keyboard.up(k);
  const {objects,...final}=state||{};await page.screenshot({path:`${out}/run-${run}-final.png`});
  if(!recording)await drain();errors.push(...eventErrors.splice(0));
  let video;
  if(target.canvasVideo){const b64=await page.evaluate(async()=>{window.__qaCapture.recorder.stop();const data=await window.__qaCapture.done;delete window.__qaCapture;return data});video=`${out}/run-${run}-canvas.webm`;fs.writeFileSync(video,Buffer.from(b64,'base64'))}
  report.runs.push({run,video,sourceSha256:runSourceSha256,success:!!final.coreEaten,final,samples,errors});fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
 }
 completed=true;
}finally{if(recording){recording=false;if(completed){await drain();}fs.writeFileSync(out+'/frames.json',JSON.stringify(frames));report.frameCount=frames.length}
// 오류나 사용자 제어회수 뒤에는 추가 UI 입력을 보내지 않는다.
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2))}
if(!success||report.runs.some(r=>r.errors.length))process.exitCode=1;
