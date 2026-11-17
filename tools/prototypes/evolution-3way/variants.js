/* ACCRETION 진화 3안 — 공통 타임라인 + 안별 연출.
 * 세 안은 같은 시각 t·같은 질량 곡선·같은 카메라 식·같은 환경(안개·조명)을 쓴다. 다른 것은 '천체 연출'뿐이다.
 * 모든 값은 t 의 순수 함수로 매 프레임 다시 계산한다(스크럽·동시 재생에서 세 뷰가 한 시계를 공유). */
(function(){
'use strict'
const E=window.ACC_ENGINE
const {rad,clamp}=E

/* ── 공통 타임라인 ── */
const TL={END:18,IGN:4.0,COL:11.0}
// 질량 곡선: 원시별 1.2(begin 시작값, index.html:2900) → 3(점화 임계) → 40(붕괴 임계) → 46.
// 항성 구간은 지수 성장(먹을수록 빨리 큰다)으로 둔다.
TL.mass=t=>{
 if(t<TL.IGN)return 1.2+1.8*clamp(t/TL.IGN,0,1)
 if(t<TL.COL)return 3*Math.pow(40/3,(t-TL.IGN)/(TL.COL-TL.IGN))
 return 40+6*clamp((t-TL.COL)/(TL.END-TL.COL),0,1)}
TL.hr=t=>rad(TL.mass(t))
TL.MARKERS=[{n:'원시별',t:2.0},{n:'점화',t:4.15},{n:'항성',t:7.5},{n:'붕괴',t:11.2},{n:'블랙홀',t:14.5}]
TL.stageAt=t=>t<TL.IGN?'원시별':t<TL.IGN+1?'점화':t<TL.COL?'항성':t<TL.COL+1.5?'붕괴':'블랙홀'
// 환경(안개·반구광) 존 전환 — 게임은 형태가 바뀌는 순간 목표 존이 바뀌고 exp(-0.7t)로 따라간다(index.html:2382-2386).
const ZSW=[[0,0],[TL.IGN,1],[TL.COL,2]]
const COARSE=matchMedia('(pointer:coarse)').matches||('ontouchstart' in window)

/* ── 보조 ── */
const sm=u=>{u=clamp(u,0,1);return u*u*(3-2*u)}
const eIn=u=>{u=clamp(u,0,1);return u*u*u}
const eOut=u=>{u=clamp(u,0,1);return 1-Math.pow(1-u,3)}
const eOutBack=u=>{u=clamp(u,0,1);const c=1.9;return 1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2)}
const _c=new THREE.Color()
const lerpHex=(a,b,k)=>_c.setHex(a).lerp(new THREE.Color(b),clamp(k,0,1)).getHex()
function fxLerp(a,b,k){return a.map((v,i)=>v+(b[i]-v)*k)}
// 존 비네트(#zone box-shadow, index.html:120). 전환 1.6s ease. switches 가 1개면 고정.
function zoneFx(t,sw){let cur=E.ZONES[sw[0][1]].fx
 for(let i=1;i<sw.length;i++){if(t<sw[i][0])break;cur=fxLerp(cur,E.ZONES[sw[i][1]].fx,sm((t-sw[i][0])/1.6))}
 return cur}

/* 매 프레임 기본값 복원 — 원본 메시의 초기값(index.html:486-540) */
function resetBase(H){
 H.rockG.scale.setScalar(1);H.starG.scale.setScalar(1);H.bhG.scale.setScalar(1)
 H.pRockMat.emissiveIntensity=.62
 const g=(s,k)=>{const b=s.userData.base;s.material.opacity=b.op*(k==null?1:k);s.scale.set(b.size,b.size,1);s.material.color.setHex(b.color)}
 g(H.rockGlow);g(H.starGlowA);g(H.starGlowB);g(H.coreGlow)
 H.starBody.material.color.setHex(0xffd98a)
 H.disk.material.uniforms.uOp.value=1.0;H.diskArc.material.uniforms.uOp.value=0.33
 H.photon.material.opacity=1
 if(H.flare)H.flare.visible=false}

/* 공통 적용: 질량 스케일·카메라·환경·원반 회전·광자 고리. 반환: {hr,camD} */
function common(V,t,shake){
 const H=V.H,hr=TL.hr(t)
 H.hole.scale.setScalar(hr)                                   // index.html:1956 시각 스케일 = 질량^(1/3)
 const camD=E.placeCam(V.cam,hr,shake)
 V.scene.fog.density=0.047/camD                               // index.html:2249
 E.zoneColors(t,ZSW,V.scene.fog.color,V.hemiLight.color)
 H.disk.material.uniforms.uT.value=t;H.diskArc.material.uniforms.uT.value=t   // index.html:1958 uT+=dt
 H.photon.quaternion.copy(V.cam.quaternion)                   // index.html:2256
 return {hr,camD}}

/* ════════ A 현행 — 게임 그대로 ════════ */
const A={id:'A',name:'A 현행',
 note:'게임 그대로: 질량 임계(3·40)에서 메시를 즉시 교체. 초신성 = 흰 플래시·충격파 링·흔들림. 렌징은 블랙홀 순간 ×0.42→×1.0 으로 점프. 배너는 게임 큐(1.7초)·재방문 플레이어 기준.',
 sched:E.simulateMsgQueue([
  {t:TL.IGN,pri:2,main:E.TXT.ignite.m,sub:E.TXT.ignite.s},          // index.html:1936
  {t:TL.COL,pri:2,main:E.TXT.nova.m,sub:E.TXT.nova.s},              // index.html:2704
  {t:TL.COL+1.5,pri:4,main:E.TXT.hold.m,sub:COARSE?E.TXT.hold.st:E.TXT.hold.s}],TL.END), // index.html:1932 (1.5s 뒤, 우선순위 4)
 apply(V,t){
  const H=V.H;resetBase(H)
  const sh=E.shakeOffset(TL.COL,t,1.6,11)                    // index.html:2691 S.shake+=1.6
  const {hr}=common(V,t,sh)
  const f=t<TL.IGN?0:t<TL.COL?1:2
  E.applyForm(H,f)                                           // index.html:1929 applyForm(nf) — 즉시 교체
  E.shockAt(V.shock,t-TL.COL,hr)                             // index.html:2689 · 2712-2718
  // 초신성 eatBurst(hole,0xfff0c0,40)(index.html:2703)는 재현하지 않는다: 홀 중심에서 생성된 입자는
  // 같은 프레임 updateParticles 에서 d(=0→||1)=1 < rad(m)*1.1 로 흡수 판정돼 한 번도 그려지지 않는다.
  V.parts.render([],t,TL.hr)
  return {lens:E.lensStrength(hr,E.FORMS[f].lens),eh:E.lensEH(hr),
   flash:E.flashAt(t-TL.COL),banner:E.bannerAt(this.sched,t),
   zone:E.ZONES[0].fx}}                                      // #zone 그림자는 형태 전환 때 갱신되지 않는다(setZoneInstant(0) 이후 블랙홀 티어 승격 때만)
}

/* ════════ B 가독성 — 같은 자산, 단계·전이를 읽기 쉽게 ════════ */
const B_CUE_I=3.3,B_CUE_C=10.2
const B={id:'B',name:'B 가독성',
 note:'단계마다 정지 구간 + 짧은 예고. 점화 0.7초 전 원시별이 조여들며 달아오름 → 그 크기에서 항성이 이어받음. 붕괴는 별이 오그라든 크기에서 블랙홀이 자라남. 흔들림 없음·플래시 약하게·렌징 0.9초 페이드. 하단 단계 표시줄 + 단계별 화면 테두리 색(게임의 존 비네트).',
 sched:[
  {t0:0.4,t1:2.8,main:E.TXT.proto.m,sub:E.TXT.proto.s},
  {t0:4.2,t1:6.6,main:E.TXT.ignite.m,sub:E.TXT.ignite.s},
  {t0:11.3,t1:13.7,main:E.TXT.nova.m,sub:E.TXT.nova.s},
  {t0:15.0,t1:17.4,main:E.TXT.hold.m,sub:COARSE?E.TXT.hold.st:E.TXT.hold.s}],
 apply(V,t){
  const H=V.H;resetBase(H)
  const {hr}=common(V,t,null)
  const f=t<TL.IGN?0:t<TL.COL?1:2
  E.applyForm(H,f)
  let lensK=E.FORMS[f].lens,cue=''
  if(f===0){const u=sm((t-B_CUE_I)/(TL.IGN-B_CUE_I))     // 점화 예고: 수축 + 달아오름
   H.rockG.scale.setScalar(1-0.14*u);H.pRockMat.emissiveIntensity=.62+.8*u
   H.rockGlow.material.opacity=.5+.4*u;H.rockGlow.scale.setScalar(3.4*(1+.15*u))
   if(u>0)cue='점화 직전'}
  if(f===1){const v=eOut((t-TL.IGN)/0.45),v2=clamp((t-TL.IGN)/0.6,0,1)
   const w=eIn((t-B_CUE_C)/(TL.COL-B_CUE_C))                // 붕괴 예고: 오그라들며 어두워짐
   H.starG.scale.setScalar((0.86+0.14*v)*(1-0.7*w))
   const k=(1+0.35*(1-v2))*(1-0.6*w)
   H.starGlowA.material.opacity=.85*k;H.starGlowB.material.opacity=.5*k
   H.starBody.material.color.setHex(lerpHex(0xffd98a,0xffb070,w*0.5))
   if(t<TL.IGN+0.6)cue='점화';else if(w>0)cue='붕괴 직전'}
  if(f===2){const b=eOut((t-TL.COL)/0.6),q=sm((t-TL.COL)/0.9)
   H.bhG.scale.setScalar(0.3+0.7*b)
   H.disk.material.uniforms.uOp.value=q;H.diskArc.material.uniforms.uOp.value=.33*q
   H.photon.material.opacity=q;H.coreGlow.material.opacity=.28*q
   lensK=0.42+(1-0.42)*q
   if(t<TL.COL+0.9)cue='붕괴'}
  E.shockAt(V.shock,t-TL.COL,hr,0.55)
  V.parts.render([],t,TL.hr)
  return {lens:E.lensStrength(hr,lensK),eh:E.lensEH(hr),
   flash:E.flashAt(t-TL.COL,0.18),banner:E.bannerAt(this.sched,t),
   zone:zoneFx(t,ZSW),chip:{idx:f,cue}}}
}

/* ════════ C 연출 강화 — 빛·수축 방향·박자 ════════ */
const C_ANT=3.0,C_SWELL=9.4,C_COLL=10.4,C_BEAT=10.88
// 입자 스펙은 한 번만 만든다(시드 고정). 원본 eatBurst 의 물리(중심 46 가속·흡수 반경)를 그대로 쓰고 생성 위치·속도만 다르다.
const C_SPECS=(()=>{const out=[];let i=0
 // 1) 원시별로 빨려드는 가스 — 나선 유입. 점화 직전엔 유입이 두 배로 빨라진다.
 for(let t0=0.15;t0<TL.IGN;t0+=(t0<C_ANT?0.05:0.022)){const r=E.hash(i++,31)
  const hr=TL.hr(t0),R=hr*(3+r()*1.6),a=r()*6.283,tv=(3+r()*2.2)*(r()<.5?1:1)
  out.push({t0,x:Math.cos(a)*R,z:Math.sin(a)*R,vx:-Math.sin(a)*tv,vz:Math.cos(a)*tv,life:.55+r()*.15,sz:.3+r()*.35,color:r()<.5?0xff9a5a:0xffb070})}
 // 2) 붕괴 — 별 둘레에서 안쪽으로 끌려드는 고리
 for(let k=0;k<130;k++){const r=E.hash(1000+k,37),t0=C_COLL-0.05+r()*0.4
  const hr=TL.hr(t0),R=hr*(2.6+r()*1.0),a=r()*6.283,tv=(r()-.5)*3
  out.push({t0,x:Math.cos(a)*R,z:Math.sin(a)*R,vx:-Math.sin(a)*tv,vz:Math.cos(a)*tv,life:.6+r()*.1,sz:.2+r()*.25,color:0xffd0a0,kill:.35})}
 // 3) 반동 — 흡수 반경 밖에서 바깥으로 튀는 분출(원본 eatBurst 색 0xfff0c0, 속도 ×3)
 for(let k=0;k<40;k++){const r=E.hash(2000+k,41),hr=TL.hr(TL.COL),a=r()*6.283,sp=(4+r()*7)*3,R=hr*1.25
  out.push({t0:TL.COL,x:Math.cos(a)*R,z:Math.sin(a)*R,vx:Math.cos(a)*sp,vz:Math.sin(a)*sp,life:.4+r()*.3,sz:.3+r()*.35,color:0xfff0c0})}
 return out})()
const C={id:'C',name:'C 연출 강화',
 note:'빛·수축 방향·박자. 원시별로 가스가 나선으로 빨려들고, 점화 직전 숨을 들이쉬듯 조여들었다가 섬광. 붕괴 전 별이 부풀며 붉어지고 → 입자가 안쪽으로 끌려들며 빛이 꺼지는 한 박자 → 반동 폭발. 렌징은 광자 고리가 조여들며 켜진다. 모두 기존 글로우·입자·렌징 재조합.',
 sched:E.simulateMsgQueue([
  {t:TL.IGN+0.35,pri:2,main:E.TXT.ignite.m,sub:E.TXT.ignite.s},
  {t:TL.COL+0.55,pri:2,main:E.TXT.nova.m,sub:E.TXT.nova.s},
  {t:TL.COL+3.8,pri:4,main:E.TXT.hold.m,sub:COARSE?E.TXT.hold.st:E.TXT.hold.s}],TL.END),
 setup(V){const fl=E.glow(0xfff2c8,4.6,0);fl.visible=false;V.H.starG.add(fl);V.H.flare=fl},
 apply(V,t){
  const H=V.H;resetBase(H)
  // 흔들림: 점화 0.6(가볍게) · 붕괴 1.6(게임과 같은 값)
  const s1=E.shakeOffset(TL.IGN,t,0.6,5),s2=E.shakeOffset(TL.COL,t,1.6,11)
  const {hr}=common(V,t,{x:s1.x+s2.x,z:s1.z+s2.z})
  const f=t<TL.IGN?0:t<TL.COL?1:2
  E.applyForm(H,f)
  let lensK=E.FORMS[f].lens,ehK=1,vig=0,flash=0
  if(f===0){const a=eIn((t-C_ANT)/(TL.IGN-C_ANT))           // 숨 들이쉬기: 조여들며 어두워진다
   H.rockG.scale.setScalar(1-0.22*a);H.pRockMat.emissiveIntensity=.62*(1-0.45*a)+1.6*eIn((t-3.75)/0.25)
   H.rockGlow.material.opacity=.5*(1-0.5*a)}
  if(f===1){const g=t-TL.IGN
   // 점화 섬광 — 별 글로우와 같은 텍스처·색, 크기만 키웠다 줄인다
   H.flare.visible=g<1.4
   H.flare.material.opacity=0.8*(g<0.06?g/0.06:Math.exp(-(g-0.06)*4.0))
   const fs=4.6*(1.1+1.5*eOut(g/0.3));H.flare.scale.set(fs,fs,1)
   let sc=g<0.6?0.78+(1-0.78)*eOutBack(g/0.6):1
   let k=1+0.08*Math.sin(t*2.2)                               // 항성 호흡
   const sw=sm((t-C_SWELL)/(C_COLL-C_SWELL))                  // 붕괴 전 팽창 + 붉어짐
   const co=eIn((t-C_COLL)/(C_BEAT-C_COLL))                   // 안쪽으로 무너짐
   sc*=(1+0.16*sw)*(1-0.86*co)
   k*=(1-0.2*sw)*(1-0.88*co)
   H.starG.scale.setScalar(sc)
   H.starGlowA.material.opacity=.85*k;H.starGlowB.material.opacity=.5*k
   H.starGlowA.material.color.setHex(lerpHex(0xffb254,0xff5a2a,sw*0.85))
   H.starBody.material.color.setHex(lerpHex(lerpHex(0xffd98a,0xff8a4a,sw*0.75),0x8a3a1a,co*0.6))
   lensK=0.42*(1-0.75*co)
   vig=Math.max(sw*0.25,co)*(t>=C_BEAT?1:1)
   flash=0}   // 점화는 화면 전체 플래시 없이 별 자리의 섬광만 — 전체 플래시는 회색 막으로 읽혔다(시안 검토)
  if(f===2){const g=t-TL.COL
   H.bhG.scale.setScalar(0.14+0.86*eOutBack(g/0.7))
   const L=sm((g-0.15)/1.4)
   lensK=L+0.25*Math.sin(Math.PI*L)                          // 램프 + 살짝 넘침
   ehK=1+1.6*(1-L)                                           // 광자 고리가 바깥에서 조여든다
   const q=sm((g-0.2)/1.2)
   H.disk.material.uniforms.uOp.value=q;H.diskArc.material.uniforms.uOp.value=.33*q
   const spin=1.8*(1-Math.exp(-g*1.5))                       // 원반 회전 스핀업(uT 앞당김)
   H.disk.material.uniforms.uT.value=t+spin;H.diskArc.material.uniforms.uT.value=t+spin
   H.photon.material.opacity=sm((g-0.1)/0.7);H.coreGlow.material.opacity=.28*sm(g/0.9)
   vig=Math.max(0,1-g/0.6)
   flash=E.flashAt(g)}
  E.shockAt(V.shock,t-TL.COL,hr)
  V.parts.render(C_SPECS,t,TL.hr)
  return {lens:E.lensStrength(hr,lensK),eh:E.lensEH(hr)*ehK,flash,banner:E.bannerAt(this.sched,t),
   zone:zoneFx(t,ZSW),vig}}
}

window.EVO={TL,VARIANTS:{A,B,C},ORDER:['A','B','C']}
})()
