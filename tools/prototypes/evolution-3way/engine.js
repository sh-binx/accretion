/* ACCRETION 진화 3안 비교 — 엔진 이식부
 * 원본: /index.html (v1.0.1, 89210d5). 아래 각 블록 머리에 원본 줄 번호를 적었다.
 * 원칙: 메시·셰이더·글로우·입자·렌징·카메라·배너 큐의 '수치와 식'은 원본 그대로 복사했다.
 * 바꾼 것은 결정성(determinism)뿐이다 — 스크럽·3뷰 동기화를 위해
 *   (1) Math.random → 시드 고정 난수, (2) 프레임 적분(lerp·shake·particles)을 '시각 t의 함수'로 재생.
 * 이식하지 않은 것: 먹이·라이벌·흡수 흐름(feed stream)·제트·격자(gWant=0 이라 원래 안 보임)·오디오·HUD.
 */
(function(){
'use strict'
const E={}

/* ── 시드 난수 (원본 rnd = Math.random, index.html:402) ── */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
E.mulberry=mulberry
const R0=mulberry(20261005)
const rnd=(a,b)=>a+R0()*(b-a)
E.hash=(i,s)=>{const r=mulberry((i*2654435761)^(s*40503));r();return r}   // 입자별 독립 난수열

/* index.html:403 */
const rad=m=>Math.cbrt(Math.max(0.001,m))
E.rad=rad
const clamp=(v,a,b)=>v<a?a:(v>b?b:v)
E.clamp=clamp

/* index.html:791-793 — 형태 정의(시각에 쓰는 필드만) */
E.FORMS=[
 {id:'rock',n:'PROTOSTAR',    max:3,  lens:0.14},
 {id:'star',n:'MAIN SEQUENCE',max:40, lens:0.42},
 {id:'bh',  n:'BLACK HOLE',   max:1e9,lens:1.0}]

/* index.html:2374-2376 — 존 팔레트(진화 구간 3개) */
E.ZONES=[
 {fog:0x070910,hemi:0x9fb0cc,lens:1.0,fx:[300,50,70,90,130,.16]},   // PLANETESIMAL
 {fog:0x120c07,hemi:0xffd9a0,lens:1.0,fx:[320,66,255,160,70,.20]},  // MAIN SEQUENCE
 {fog:0x05060f,hemi:0x9fc0ff,lens:1.0,fx:[320,60,40,80,200,.20]}]   // BH STELLAR

/* index.html:420-426 — 렌더러 설정 */
E.createRenderer=function(canvas){
 const r=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})
 r.setPixelRatio(Math.min(devicePixelRatio,2))
 r.outputEncoding=THREE.sRGBEncoding
 r.toneMapping=THREE.ACESFilmicToneMapping
 r.toneMappingExposure=1.05
 return r}

/* index.html:440-442 — 별 텍스처 */
const STAR_TEX=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d')
 const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#fff');g.addColorStop(.35,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)')
 x.fillStyle=g;x.beginPath();x.arc(16,16,16,0,6.283);x.fill();return new THREE.CanvasTexture(c)})()

/* index.html:433-439 — 별밭 */
function makeStars(n,spread,size,op,col){
 const g=new THREE.BufferGeometry(),p=new Float32Array(n*3)
 for(let i=0;i<n;i++){const r=rnd(spread*0.4,spread),th=rnd(0,6.283),ph=Math.acos(rnd(-1,1))
  p[i*3]=r*Math.sin(ph)*Math.cos(th);p[i*3+1]=r*Math.sin(ph)*Math.sin(th);p[i*3+2]=r*Math.cos(ph)}
 g.setAttribute('position',new THREE.BufferAttribute(p,3))
 return new THREE.Points(g,new THREE.PointsMaterial({color:col,size,transparent:true,opacity:op,sizeAttenuation:false,map:STAR_TEX,alphaTest:0.04,depthWrite:false}))}

/* index.html:427 + 443-459 — 배경 씬(렌징 대상). 3뷰가 같은 카메라 궤도를 쓰므로 공유한다 */
E.createBg=function(){
 const bgScene=new THREE.Scene()
 const stars=new THREE.Group()
 stars.add(makeStars(6000,1600,1.8,0.95,0xcfe0ff))
 stars.add(makeStars(3000,1600,2.8,0.85,0x9fb8ff))
 stars.add(makeStars(1400,1600,4.2,0.8,0xffe0c8))
 bgScene.add(stars)
 const neb=new THREE.Mesh(new THREE.SphereGeometry(1500,16,12),new THREE.MeshBasicMaterial({side:THREE.BackSide,transparent:true,opacity:0.5,
  map:(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d')
   const g1=x.createRadialGradient(360,150,0,360,150,300);g1.addColorStop(0,'rgba(90,70,180,.5)');g1.addColorStop(1,'rgba(0,0,0,0)')
   x.fillStyle=g1;x.fillRect(0,0,512,512)
   const g2=x.createRadialGradient(140,380,0,140,380,260);g2.addColorStop(0,'rgba(30,120,200,.4)');g2.addColorStop(1,'rgba(0,0,0,0)')
   x.fillStyle=g2;x.fillRect(0,0,512,512)
   return new THREE.CanvasTexture(c)})()}))
 bgScene.add(neb)
 return {bgScene,stars,neb}}

/* index.html:451-472 — 중력 렌징 후처리(셰이더 원문 그대로) */
E.createPost=function(){
 const postScene=new THREE.Scene(),postCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1)
 const lensMat=new THREE.ShaderMaterial({
  uniforms:{tDiffuse:{value:null},uCenter:{value:new THREE.Vector2(.5,.5)},uStrength:{value:0.0},uAspect:{value:1},uEH:{value:0.03}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:[
  'uniform sampler2D tDiffuse;uniform vec2 uCenter;uniform float uStrength;uniform float uAspect;uniform float uEH;varying vec2 vUv;',
  'void main(){',
  ' vec2 uv=vUv;vec2 d=uv-uCenter;d.x*=uAspect;float r=length(d);',
  ' float defl=uStrength/(r+0.008);defl=min(defl,r*0.99);',
  ' vec2 dir=d/max(r,1e-4);vec2 off=dir*defl;off.x/=uAspect;',
  ' vec3 col=texture2D(tDiffuse,uv-off).rgb;',
  ' float mag=uStrength/(r*r+0.006);',
  ' col*=1.0+clamp(mag*0.55,0.0,2.6);',
  ' float ph=exp(-pow((r-uEH)/(uEH*0.4),2.0));',
  ' col+=vec3(1.0,0.82,0.6)*ph*(0.35+uStrength*4.5);',
  ' float halo=smoothstep(uEH*3.5,uEH*1.3,r);',
  ' col+=vec3(0.12,0.28,0.6)*halo*uStrength*2.2;',
  ' gl_FragColor=vec4(col,1.0);',
  '}'].join('\n')})
 postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),lensMat))
 return {postScene,postCam,lensMat}}

/* index.html:475-479 — 글로우 스프라이트 */
const GT=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d')
 const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.4,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)')
 x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})()
function glow(color,size,op){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GT,color,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));s.scale.set(size,size,1);s.userData.base={size,op,color};return s}
E.glow=glow

/* index.html:489-514 — 강착원반 셰이더 */
const DISK_GLSL={
 vert:'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 frag:[
 'precision highp float;varying vec2 vP;',
 'uniform float uT,uIn,uOut,uPhi,uOp;uniform vec3 uCA,uCR;',
 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
 'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
 ' return mix(mix(h(i),h(i+vec2(1.0,0.0)),f.x),mix(h(i+vec2(0.0,1.0)),h(i+vec2(1.0,1.0)),f.x),f.y);}',
 'float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<4;i++){s+=a*n2(p);p*=2.03;a*=0.5;}return s;}',
 'void main(){',
 ' float r=length(vP);float t=(r-uIn)/(uOut-uIn);',
 ' if(t<0.0||t>1.0)discard;',
 ' float a=atan(vP.y,vP.x);',
 ' float shear=uT*2.4*pow(max(r,0.35),-1.5);',
 ' float f=fbm(vec2((a+shear)*2.6,r*5.0));f=mix(0.5,1.45,f);',
 ' vec3 col=mix(uCR,uCA,pow(1.0-t,1.25));',
 ' float dop=0.30+0.85*pow(1.0+0.58*cos(a-uPhi),3.0)/4.1;',
 ' float rad=pow(1.0-t,1.6)*1.55+0.10;',
 ' float al=smoothstep(0.0,0.10,t)*smoothstep(1.0,0.70,t)*uOp*f*dop*rad;',
 ' col=mix(col,uCA,clamp((dop-0.95)*0.4,0.0,0.45));', ' col+=vec3(0.34,0.31,0.27)*pow(1.0-t,5.0)*dop;', ' gl_FragColor=vec4(col,clamp(al*1.85,0.0,1.0));',
 '}'].join('\n')}
function diskMat(op,arc){return new THREE.ShaderMaterial({
 uniforms:{uT:{value:0},uIn:{value:arc?0.98:0.86},uOut:{value:arc?2.16:1.98},uPhi:{value:1.15},uOp:{value:op},uCA:{value:new THREE.Color(0xcaf0ff)},uCR:{value:new THREE.Color(0xff4a12)}},
 vertexShader:DISK_GLSL.vert,fragmentShader:DISK_GLSL.frag,
 transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false})}

/* index.html:486-540 — 플레이어 메시(블랙홀 파츠 · 원시별 · 주계열성)
 * 원본은 전부 hole 에 직접 붙인다. 여기선 형태별 서브그룹(rockG/starG/bhG)으로 한 겹 감쌌다 —
 * 스케일 1·회전 0 이면 원본과 같은 변환이고, B/C 안이 형태별 수축을 줄 수 있게 하기 위함이다.
 * 스킨: 기본 VOID (index.html:1591) · diskTemp=0(항성질량) → repaintDisk 가 바꾸는 값 없음(포톤 링만 0xffe8bf, index.html:1634-1641). */
E.buildHole=function(){
 const hole=new THREE.Group(),bhG=new THREE.Group(),rockG=new THREE.Group(),starG=new THREE.Group()
 hole.add(bhG,rockG,starG)
 const eh=new THREE.Mesh(new THREE.SphereGeometry(0.62,32,24),new THREE.MeshBasicMaterial({color:0x000000,fog:false}));bhG.add(eh)
 const disk=new THREE.Mesh(new THREE.RingGeometry(0.84,2.0,220,1),diskMat(1.0,false))
 disk.rotation.x=Math.PI*0.5-0.26;bhG.add(disk)
 const diskArc=new THREE.Mesh(new THREE.RingGeometry(0.9,2.16,220,1),diskMat(0.33,true))
 diskArc.rotation.set(0,0,0);bhG.add(diskArc)
 const photon=new THREE.Mesh(new THREE.RingGeometry(0.645,0.688,140),new THREE.MeshBasicMaterial({color:0xffe8bf,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,side:THREE.DoubleSide,fog:false}))
 photon.renderOrder=6;bhG.add(photon)
 const coreGlow=glow(0x66a8ff,4.2,0.28);bhG.add(coreGlow)
 // 원시별 (index.html:532-535)
 const pRockMat=new THREE.MeshStandardMaterial({color:0x6b4230,roughness:.92,flatShading:true,emissive:0x9c3e14,emissiveIntensity:.62})
 const pRock=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),pRockMat)
 const rockGlow=glow(0xff7a3a,3.4,0.5);pRock.add(rockGlow);rockG.add(pRock)
 // 주계열성 (index.html:536-540)
 const starBody=new THREE.Mesh(new THREE.SphereGeometry(1,26,18),new THREE.MeshBasicMaterial({color:0xffd98a,fog:false}))
 const starGlowA=glow(0xffb254,4.6,0.85),starGlowB=glow(0xfff2c8,2.6,0.5)
 starG.add(starBody,starGlowA,starGlowB)
 return {hole,bhG,rockG,starG,eh,disk,diskArc,photon,coreGlow,pRock,pRockMat,rockGlow,starBody,starGlowA,starGlowB}}

/* index.html:808 — applyForm: 형태 전환 = 메시 교체 */
E.applyForm=function(H,fi){H.bhG.visible=fi===2;H.rockG.visible=fi===0;H.starG.visible=fi===1}

/* index.html:811-815 — 시차 먼지(홀이 원점에 고정이라 랩 처리는 필요 없다) */
const DUSTN=460,DUSTR=120,dustPos=new Float32Array(DUSTN*3)
for(let i=0;i<DUSTN;i++){dustPos[i*3]=rnd(-DUSTR,DUSTR);dustPos[i*3+1]=rnd(-26,26);dustPos[i*3+2]=rnd(-DUSTR,DUSTR)}
const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3))

/* 게임플레이 씬 하나 = 한 뷰. index.html:428-431(안개·조명) · 2683-2685(충격파 링) */
E.createScene=function(){
 const scene=new THREE.Scene()
 scene.fog=new THREE.FogExp2(0x05060f,0.0016)
 const hemiLight=new THREE.HemisphereLight(0x9fc0ff,0x0a0f1e,0.5);scene.add(hemiLight)
 const key=new THREE.DirectionalLight(0xfff0dc,0.6);key.position.set(-8,18,10);scene.add(key)
 const cool=new THREE.DirectionalLight(0x4a7bff,0.4);cool.position.set(10,6,-8);scene.add(cool)
 scene.add(new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xa8c0e8,size:0.72,transparent:true,opacity:0.55,sizeAttenuation:true,map:STAR_TEX,alphaTest:0.04,depthWrite:false})))
 const H=E.buildHole();scene.add(H.hole)
 const shock=new THREE.Mesh(new THREE.RingGeometry(0.94,1,72),new THREE.MeshBasicMaterial({color:0xfff0d0,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}))
 shock.rotation.x=-Math.PI/2;shock.visible=false;scene.add(shock)
 const cam=new THREE.PerspectiveCamera(52,1,0.1,8000)   // index.html:428
 const parts=new Particles(scene)
 return {scene,hemiLight,H,shock,cam,parts}}

/* index.html:2214-2251 — 카메라. 게임플레이(S.alive) 분기만: camDist=22+hr*7, 높이 0.82·뒤 0.72, 원점 주시.
 * 원본은 목표로 dt*6 lerp — 질량이 연속으로 변해 지연은 수 프레임이라 생략했다. 흔들림만 아래 shakeOffset 으로 재생. */
E.camDist=hr=>22+hr*7
E.placeCam=function(cam,hr,off){const d=E.camDist(hr)
 cam.position.set(off?off.x:0,d*0.82,d*0.72+(off?off.z:0));cam.lookAt(0,0,0);return d}

/* index.html:2245-2251 — 흔들림: 매 프레임 (rand-.5)*shake*2.2 를 목표로 dt*6 lerp, shake 는 3/s 로 감쇠.
 * 같은 식을 60Hz 고정 스텝·시드 난수로 t0 부터 재생 → 스크럽해도 같은 그림. */
E.shakeOffset=function(t0,t,amp,seed){
 const o={x:0,z:0};if(t<t0)return o
 const dt=1/60,r=mulberry(seed||7);let s=0,tt=t0,n=0
 s=Math.min(amp,2)
 while(tt<t&&n<240){const k=Math.min(1,dt*6)
  const sx=(r()-0.5)*s*2.2,sz=(r()-0.5)*s*2.2
  o.x+=(sx-o.x)*k;o.z+=(sz-o.z)*k
  s=Math.max(0,s-dt*3);tt+=dt;n++}
 return o}

/* index.html:2280-2281 — 렌징 세기·광자 고리 반경(존 렌징 1.0, 완전체 아님) */
E.lensStrength=(hr,formLens,zoneLens)=>(0.010+Math.min(0.09,hr*0.014))*(zoneLens||1)*formLens
E.lensEH=hr=>0.02+Math.min(0.13,hr*0.02)

/* index.html:2385-2386 — 존 색 lerp: 매 프레임 k=min(1,dt*0.7) → 연속 근사 exp(-0.7Δt).
 * switches: [[t,zoneIdx],...] 시간순. 반환: {fog:Color, hemi:Color} */
const _ca=new THREE.Color(),_cb=new THREE.Color()
E.zoneColors=function(t,switches,outFog,outHemi){
 outFog.setHex(E.ZONES[switches[0][1]].fog);outHemi.setHex(E.ZONES[switches[0][1]].hemi)
 for(let i=1;i<switches.length;i++){const [ts,zi]=switches[i];if(t<ts)break
  const tEnd=(i+1<switches.length)?Math.min(t,switches[i+1][0]):t
  const k=1-Math.exp(-0.7*(tEnd-ts))
  outFog.lerp(_ca.setHex(E.ZONES[zi].fog),k);outHemi.lerp(_cb.setHex(E.ZONES[zi].hemi),k)}}

/* index.html:2687-2711 — 초신성 충격파 링: shockT+=dt*2.1, R=(22+rad(m)*7)*1.5, opacity .9*(1-shockT) */
E.shockAt=function(shock,dt,hr,opMul,speed){
 const sT=dt*2.1*(speed||1)
 if(dt<0||sT>=1){shock.visible=false;return}
 const R=(22+hr*7)*1.5
 shock.visible=true;shock.scale.setScalar(Math.max(0.001,Math.min(1,sT)*R))
 shock.material.opacity=Math.max(0,0.9*(1-sT))*(opMul==null?1:opMul)}

/* index.html:121-122 + 2692 — #flash: .on 시 opacity .82(전환 .04s), 90ms 뒤 해제 → .5s ease-out 으로 사라짐 */
E.flashAt=function(dt,peak){peak=peak==null?.82:peak
 if(dt<0)return 0
 if(dt<0.04)return peak*(dt/0.04)
 if(dt<0.09)return peak
 const u=(dt-0.09)/0.5;if(u>=1)return 0
 return peak*(1-(1-Math.pow(1-u,2)))}   // ease-out ≈ 1-(1-u)^2

/* index.html:1647-1676 — 메시지 우선순위 큐(pushMsg/pumpMsg)를 60Hz 로 미리 돌려 표시 구간표를 만든다.
 * 배너 1.7s · 코덱스 3.2s · 높은 우선순위가 오면 즉시 교체. 반환: [{t0,t1,main,sub,kind}] */
E.simulateMsgQueue=function(events,tEnd){
 const out=[],Q=[];let msgUntil=0,msgPri=0,cur=null,ei=0
 const ev=events.slice().sort((a,b)=>a.t-b.t)
 for(let n=0;n<=tEnd*60+1;n++){const now=n/60
  while(ei<ev.length&&ev[ei].t<=now+1e-9){const m=ev[ei++]
   if(!Q.some(x=>x.key===m.main)){Q.push(Object.assign({key:m.main},m));Q.sort((a,b)=>b.pri-a.pri);if(Q.length>4)Q.length=4;if(m.pri>msgPri)msgUntil=0}}
  if(now<msgUntil)continue
  const m=Q.shift()
  if(!m){if(msgUntil){if(cur){cur.t1=now;cur=null}msgUntil=0;msgPri=0}continue}
  if(cur){cur.t1=now}
  msgPri=m.pri;cur={t0:now,t1:null,main:m.main,sub:m.sub||'',kind:m.kind||'b'};out.push(cur)
  msgUntil=now+(cur.kind==='b'?1.7:3.2)}
 if(cur&&cur.t1==null)cur.t1=msgUntil
 return out}
/* 구간표 → 시각 t 의 배너 상태. CSS 'transition:opacity .3s'(index.html:61)를 그대로 흉내: 이어 붙은 구간은 글자만 바뀐다. */
E.bannerAt=function(sched,t,fade){fade=fade||0.3
 const ease=u=>u<=0?0:u>=1?1:u*u*(3-2*u)
 for(let i=0;i<sched.length;i++){const s=sched[i]
  if(t>=s.t0&&t<s.t1){const joined=i>0&&Math.abs(sched[i-1].t1-s.t0)<1e-6
   return {m:s,op:joined?1:ease((t-s.t0)/fade)}}}
 let best=null
 for(const s of sched)if(t>=s.t1&&t<s.t1+fade)best=s
 return best?{m:best,op:1-ease((t-best.t1)/fade)}:{m:null,op:0}}

/* index.html:1305-1313 — 강착 스파클. 원본 식(중심으로 46 가속 · life .4~.7 / max .7 · d<rad*1.1 이면 흡수)을
 * 입자마다 생성 시각부터 60Hz 로 재적분한다. spec: {t0,x,z,vx,vz,life,sz,color,pull?} */
function Particles(scene){this.pool=[];this.n=0
 for(let i=0;i<220;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GT,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));s.visible=false;scene.add(s);this.pool.push(s)}}
Particles.prototype.render=function(specs,t,hrAt){let used=0;const dt=1/60
 for(const p of specs){if(t<p.t0||t>p.t0+0.75)continue
  let x=p.x,z=p.z,vx=p.vx,vz=p.vz,life=p.life,tt=p.t0,dead=false,pull=p.pull||46
  while(tt+dt<=t){const d=Math.hypot(-x,-z)||1
   vx+=-x/d*pull*dt;vz+=-z/d*pull*dt;x+=vx*dt;z+=vz*dt;life-=dt;tt+=dt
   if(life<=0||d<hrAt(tt)*1.1*(p.kill||1)){dead=true;break}}
  if(dead||used>=this.pool.length)continue
  const s=this.pool[used++],k=Math.max(0,life/0.7),hr=hrAt(t)
  s.visible=true;s.material.color.setHex(p.color);s.position.set(x,0.2,z)
  s.scale.setScalar(p.sz*(0.4+k*0.6)*(hr*0.4+0.7));s.material.opacity=k*0.95*(p.op==null?1:p.op)}
 for(let i=used;i<this.pool.length;i++)this.pool[i].visible=false
 this.n=used}
/* index.html:1307 eatBurst — 원본 생성 규칙 그대로(위치·각도·속도·수명·크기) */
E.eatBurstSpecs=function(t0,x,z,color,n,seed){const out=[]
 for(let i=0;i<n;i++){const r=E.hash(i,seed);const a=r()*6.283,sp=4+r()*7
  out.push({t0,x,z,vx:Math.cos(a)*sp,vz:Math.sin(a)*sp,life:.4+r()*.3,sz:.5+r()*.7,color})}
 return out}

/* 배너 문구 — index.html 의 영문 원문 + KO 사전(1686, 1696, 708-712) */
E.TXT={
 ignite:{m:'☀ 점화',s:'핵융합이 시작됐다 — 당신은 항성이다'},
 nova:{m:'★ 초신성',s:'중심핵이 붕괴한다 — 당신은 블랙홀이다'},
 proto:{m:'◆ 원시별',s:'수축하는 구름 핵 — 아직 별이 아니다'},   // index.html:1937 문구(현행에선 발화 경로가 없다)
 hold:{m:'◍ 새 동작 — 붙잡아 쌓기',s:'C(또는 ◍ 붙잡기)를 누르고 있으면 먹는 대신 궤도에 붙잡는다 — 느리지만 훨씬 많이 번다',
       st:'◍ 붙잡기를 누르고 있으면 먹는 대신 궤도에 붙잡는다 — 느리지만 훨씬 많이 번다'}}

window.ACC_ENGINE=E
})()
