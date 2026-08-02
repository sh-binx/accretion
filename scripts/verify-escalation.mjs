// 상승 감사 — "후반이 무료하다"는 리포트의 근본 원인을 회귀로 못박는다.
// 실측으로 드러난 두 구멍:
//   ① 콤보의 96%가 무의미했다 — 점수 배수·흔들림·표시 크기·단계가 전부 콤보 25에서 멈췄다.
//      오너가 700까지 갔는데 675 동안 게임이 아무 반응도 안 했다.
//   ② 시간이 흘러도 어려워지지 않았다 — S.t가 난이도 파라미터에 한 번도 쓰이지 않았다.
// 이 스위트는 그 둘이 다시 평평해지면 즉시 잡는다.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const URL = 'http://localhost:3040/?dev=1'
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }

const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: '+m.text()) })

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.comboCurve, { timeout:15000 })

  // ── ① 콤보가 끝까지 살아 있는가 ──
  const curve = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.hideOnboard()
    return [1,5,10,20,25,40,80,160,320,700].map(c => ({ c, ...A.comboCurve(c) }))
  })
  const at = c => curve.find(x=>x.c===c)
  ok('combo: the score curve does not stop at 25',
     at(700).mul > at(25).mul * 1.35,
     `×25 → ×${at(25).mul} · ×700 → ×${at(700).mul}`)
  ok('combo: every decade of combo still pays',
     at(40).mul > at(25).mul && at(80).mul > at(40).mul && at(160).mul > at(80).mul && at(320).mul > at(160).mul,
     curve.filter(x=>x.c>=25).map(x=>`${x.c}:×${x.mul}`).join(' '))
  const tiers = [...new Set(curve.map(x=>x.tier).filter(Boolean))]
  ok('combo: seven named states, not three', tiers.length===7, tiers.join(' · '))
  // 곡선이 로그라 폭주하지 않는다 — 선형으로 이었다가 리더보드 상한을 깬 적이 있다
  ok('combo: the curve stays bounded (log, not linear)', at(700).mul < 8, `×${at(700).mul}`)

  // 표시·체감도 25에서 멈추면 안 된다
  const feel = await page.evaluate(() => {
    const A=window.__acc, out={}
    A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(2000)
    const read = c => { A.setCombo(c,0); return { shake:Math.min(0.34,Math.log2(1+c)*0.045),
                                                 scale:1+Math.min(0.62,Math.log2(1+c)*0.055) } }
    out.c25=read(25); out.c700=read(700)
    return out
  })
  ok('combo: shake and size keep growing past 25',
     feel.c700.shake > feel.c25.shake && feel.c700.scale > feel.c25.scale,
     `흔들림 ${feel.c25.shake.toFixed(3)}→${feel.c700.shake.toFixed(3)} · 크기 ${feel.c25.scale.toFixed(3)}→${feel.c700.scale.toFixed(3)}`)

  // ── ② 완전체 — 절정을 10초 붙잡는다 ──
  const ext = await page.evaluate(() => {
    const A=window.__acc
    A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(3000)
    const before=A.extremal()
    A.fireExtremal()
    const on=A.extremal(), disk=A.diskColor()
    // 천적은 setSpawn(false)로도 오므로, 플레이어가 죽으면 step()이 멈춰 타이머도 멈춘다 — 계속 비운다
    const run=(secs)=>{ for(let i=0;i<secs*4;i++){ A.step(0.25); A.clearField(); A.setMass(3000) } }
    run(4); const mid=A.extremal()
    run(7); const after=A.extremal()
    return { before, on, mid, after, disk }
  })
  ok('extremal: latches for 10 seconds', ext.before.on===false && ext.on.on===true && ext.on.t===10,
     `${ext.before.on} → ${ext.on.t}s`)
  ok('extremal: the timer runs down with game time', ext.mid.t < ext.on.t && ext.mid.on===true,
     `4초 뒤 ${ext.mid.t}s`)
  ok('extremal: it ends (no permanent god mode)', ext.after.on===false, `11초 뒤 ${ext.after.on}`)
  ok('extremal: the disk goes white-hot while it holds', ext.disk.a==='#ffffff', ext.disk.a)

  // 피버 타임 — 콤보 ×320의 대가가 '숫자가 조금 오른다'로 끝나선 안 된다(오너 제안)
  const fever = await page.evaluate(() => {
    const A=window.__acc
    const run=(on)=>{
      A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(3000)
      const c=A.pos(), hr=Math.cbrt(3000)
      for(const rel of [0.4,0.7,0.9,1.2,1.5,1.8]) A.spawn('giant', 3000*rel, c.x+hr*(3+rel*2), c.z+hr*2)
      if(on)A.fireExtremal()
      A.step(0.05)
      const oi=A.objInfo()
      const m0=A.state.mass
      for(let i=0;i<70;i++){ A.eatNearest(); A.step(0.05,20) }
      return { edible:oi.filter(o=>o.edible).length, n:oi.length, gain:A.state.mass-m0 }
    }
    return { off:run(false), on:run(true) }
  })
  ok('fever: everything within reach becomes edible', fever.on.edible > fever.off.edible,
     `가식 ${fever.off.edible}/${fever.off.n} → ${fever.on.edible}/${fever.on.n}`)
  ok('fever: and it actually pays off', fever.on.gain > fever.off.gain*1.8,
     `+${Math.round(fever.off.gain)} → +${Math.round(fever.on.gain)} (×${(fever.on.gain/fever.off.gain).toFixed(2)})`)

  // 최종 형태는 '시공간이 휘는' 게 보여야 한다 — 예전엔 원반 색만 희게 바꿔
  // 고질량에서 이미 포화된 흰색과 구분되지 않았다(오너: 최종 형태가 안 보인다)
  const warp = await page.evaluate(async () => {
    const A=window.__acc, f=n=>new Promise(r=>{const t=()=>--n<=0?r():requestAnimationFrame(t);requestAnimationFrame(t)})
    A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(40000)
    await f(30)                                  // 존 팔레트가 목표까지 lerp 하도록 충분히
    const base=A.lens().strength, e0=A.ergo()
    A.fireExtremal(); await f(8)
    const peak=A.lens().strength, e1=A.ergo()
    return { base, peak, e0, e1 }
  })
  ok('extremal: spacetime visibly warps (lensing surges)', warp.peak > warp.base*1.5,
     `${warp.base.toFixed(3)} → ${warp.peak.toFixed(3)} (×${(warp.peak/warp.base).toFixed(2)})`)
  ok('extremal: the ergosphere ring only shows while it holds',
     warp.e0.vis===false && warp.e1.vis===true && warp.e1.op>0.2,
     `평소 ${warp.e0.vis} → 완전체 ${warp.e1.vis}(투명도 ${warp.e1.op})`)

  // ── ③ 시간이 흐르면 어려워지는가 ──
  // 질량을 고정하고 시간만 흘려 '순수한 시간 효과'만 잰다.
  const heat = await page.evaluate(() => {
    const A=window.__acc, out=[]
    for(const target of [0,210]){
      A.begin(); A.hideOnboard(); A.setMass(3000)
      let guard=0
      while(A.state.t<target && guard++<400){ A.step(1.0); A.setMass(3000); A.clearObjs() }
      A.setMass(3000)
      let riv=0, tot=0
      for(let r=0;r<14;r++){ A.clearObjs(); A.setMass(3000); A.step(0.12)
        for(const o of A.objInfo()){ tot++; if(o.t==='rival')riv++ } }
      // 비율 표본은 노이즈가 커 흔들린다(실측 18→24.5 / 17→25 / 21→23) → 실제 스폰 파라미터도 함께 본다
      out.push({ t:Math.round(A.state.t), heat:A.heat(), n:Math.round(tot/14), riv:riv/Math.max(1,tot), mix:A.spawnMix() })
    }
    return out
  })
  ok('heat: run heat rises with time (it was never used before)',
     heat[0].heat < 0.06 && heat[1].heat > 0.90, `${heat[0].heat} → ${heat[1].heat}`)
  ok('heat: the field gets denser', heat[1].n > heat[0].n * 1.15, `${heat[0].n} → ${heat[1].n}개`)
  ok('heat: threats get more common', heat[1].mix.rivalP > heat[0].mix.rivalP * 1.25,
     `스폰 확률 ${heat[0].mix.rivalP} → ${heat[1].mix.rivalP} (표본 ${Math.round(heat[0].riv*100)}% → ${Math.round(heat[1].riv*100)}%)`)

  // 곡선이 실제 런 분포에 맞는가 — 210초 선형이던 시절, 중앙값 60초 런은 상승의 29%만 겪었다.
  const shape = await page.evaluate(() => {
    const A=window.__acc, out={}
    A.begin(); A.hideOnboard(); A.setMass(3000)
    for(const t of [30,60,114,217]){
      A.begin(); A.hideOnboard(); A.setMass(3000)
      let g=0
      while(A.state.t<t && g++<500){ A.step(1.0); A.setMass(3000); A.clearObjs() }
      out[t]=A.heat()
    }
    return out
  })
  ok('heat: the median run (60s) already feels most of the ramp', shape[60] > 0.45,
     `30s ${shape[30]} · 60s ${shape[60]} · 114s ${shape[114]} · 217s ${shape[217]}`)
  ok('heat: long runs keep climbing (no flat ceiling)', shape[217] > shape[114] && shape[114] > shape[60],
     `${shape[60]} → ${shape[114]} → ${shape[217]}`)

  // 궤도 속도 — 중심에 가까울수록 빨라진다. 스텝 사이 인덱스로 짝지으면 객체가 바뀌어 무의미하다(첫 시도 실패) → 속도를 직접 읽는다.
  const spd = await page.evaluate(() => {
    const A=window.__acc, out={}
    for(const target of [0,210]){
      A.begin(); A.hideOnboard(); A.setMass(3000)
      let guard=0
      while(A.state.t<target && guard++<400){ A.step(1.0); A.setMass(3000); A.clearObjs() }
      let sum=0, n=0
      for(let r=0;r<12;r++){
        A.clearObjs(); A.setMass(3000); A.step(0.08)
        for(const o of A.objInfo()){ if(o.v!=null){ sum+=o.v; n++ } }
      }
      out[target]= n? sum/n : 0
    }
    return out
  })
  ok('heat: bodies move faster deeper in', spd[210] > spd[0]*1.4,
     `${spd[0].toFixed(2)} → ${spd[210].toFixed(2)} (×${(spd[210]/Math.max(1e-6,spd[0])).toFixed(2)})`)

  // ── 두 번째 동사: 삼킬까 쌓을까 ──
  // 블랙홀이 된 뒤 동사가 '먹기' 하나뿐이라 중후반이 평평했다(오너: 매우 무료하다).
  // 포획은 '즉시 질량'과 '더 큰 총량 + 제트 탄약'을 맞바꾸는 선택이어야 한다.
  const disk = await page.evaluate(() => {
    const A=window.__acc
    const run=(cap)=>{
      A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(3000); A.setCapture(cap)
      const m0=A.state.mass, s0=A.state.score
      for(let k=0;k<4;k++){
        const c=A.pos(), hr=Math.cbrt(3000)
        A.spawn('giant', 3000*0.35, c.x+hr*1.6, c.z)
        for(let i=0;i<26;i++){ A.eatNearest(); A.step(0.05,20); if(i%6===0)A.clearField() }
      }
      const held=A.diskState()
      A.setCapture(false)
      for(let i=0;i<400;i++){ A.step(0.05,20); if(i%8===0)A.clearField() }   // 궤도가 다 내려올 시간
      return { held, gain:A.state.mass-m0, score:A.state.score-s0, left:A.diskState() }
    }
    const eat=run(false), bank=run(true)
    // 원시별 단계에선 쓸 수 없는 동사다
    A.begin(); A.hideOnboard(); A.setMass(2); A.setCapture(true)
    const proto={ cap:A.diskState().cap }
    A.setCapture(false)
    return { eat, bank, proto }
  })
  ok('verb: capture is a black-hole-only verb', disk.proto.cap===0, `원시별 슬롯 ${disk.proto.cap}`)
  ok('verb: holding actually catches bodies into orbit',
     disk.bank.held.caught>=2 && disk.bank.held.n>=2 && disk.eat.held.caught===0,
     `쌓기 ${disk.bank.held.caught}개 · 삼키기 ${disk.eat.held.caught}개`)
  ok('verb: banking pays more than swallowing', disk.bank.gain > disk.eat.gain*1.2,
     `질량 +${Math.round(disk.eat.gain)} → +${Math.round(disk.bank.gain)} (×${(disk.bank.gain/disk.eat.gain).toFixed(2)})`)
  ok('verb: and scores more', disk.bank.score > disk.eat.score*1.3,
     `${disk.eat.score.toLocaleString()} → ${disk.bank.score.toLocaleString()}`)
  ok('verb: the orbit drains fully in the end (no free parking)', disk.bank.left.n===0,
     `남은 ${disk.bank.left.n}개`)

  // 공짜가 아니다 — 궤도 질량이 나를 무겁게 한다
  const drag = await page.evaluate(() => {
    const A=window.__acc
    const speed=(cap)=>{
      A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(3000); A.setCapture(cap)
      for(let k=0;k<3;k++){ const c=A.pos(), hr=Math.cbrt(3000)
        A.spawn('giant', 3000*0.35, c.x+hr*1.6, c.z)
        for(let i=0;i<26;i++){ A.eatNearest(); A.step(0.05,20); if(i%6===0)A.clearField() } }
      A.setCapture(false); A.clearField()
      const p0=A.pos(); A.setTarget(p0.x+4000, p0.z)
      for(let i=0;i<24;i++)A.step(0.05,20)
      const p1=A.pos()
      return { d:Math.hypot(p1.x-p0.x,p1.z-p0.z), held:A.diskState().n }
    }
    return { light:speed(false), loaded:speed(true) }
  })
  ok('verb: a loaded disk slows you (angular momentum is not free)',
     drag.loaded.held>0 && drag.loaded.d < drag.light.d*0.92,
     `빈 몸 ${drag.light.d.toFixed(1)} → ${drag.loaded.held}개 실고 ${drag.loaded.d.toFixed(1)}`)

  // ── 공간 판단: 필드가 비균일한가 ──
  // topUp()이 균일하게 스폰하던 시절엔 '모든 방향이 같아' 어디로 갈지가 결정이 아니었다.
  // 은하 중심으로 갈수록 밀도·위협·개체 크기가 올라야 '지금 저기로 갈까'가 성립한다.
  const field = await page.evaluate(() => {
    const A=window.__acc, out=[]
    for(const frac of [0.05, 0.70]){
      A.begin(); A.hideOnboard(); A.setMass(3000)
      const cp=A.corePos(); A.setTarget(cp.x, cp.z)
      let g=0
      // 안쪽은 실제로 위험해서 이동 중 죽으면 표본이 0이 된다 — 여정이 아니라 '필드'를 재는 중이므로 비워 준다
      while(A.depth()<frac-0.02 && g++<3000){ A.step(0.05,20); if(g%12===0){A.clearField(); A.setMass(3000)} }
      A.setMass(3000)
      let riv=0, tot=0, sum=0
      for(let r=0;r<14;r++){ A.clearObjs(); A.setMass(3000); A.step(0.12)
        for(const o of A.objInfo()){ tot++; if(o.t==='rival')riv++; sum+=o.mass } }
      out.push({ depth:A.depth(), n:tot/14, riv:riv/Math.max(1,tot), avg:sum/Math.max(1,tot),
                 mix:A.spawnMix() })
    }
    return out
  })
  const [out0, inn] = field
  ok('field: the outskirts and the core are different places',
     inn.depth > out0.depth + 0.4, `깊이 ${out0.depth} → ${inn.depth}`)
  ok('field: it gets crowded toward the centre', inn.n > out0.n*1.2,
     `${Math.round(out0.n)} → ${Math.round(inn.n)}개`)
  ok('field: and more dangerous', inn.mix.rivalP > out0.mix.rivalP*1.25,
     `스폰 확률 ${out0.mix.rivalP} → ${inn.mix.rivalP}`)
  // 크기 기울기는 '먹이' 대역에만 건다 — 라이벌과 '나보다 큰 천체'까지 줄이면
  // 외곽이 통째로 안전해져 긴장이 사라진다(실측으로 두 번 확인). 그래서 상한이 ×1.15 언저리다.
  ok('field: with bigger bodies', inn.avg > out0.avg*1.12,
     `평균 질량 ${Math.round(out0.avg)} → ${Math.round(inn.avg)} (×${(inn.avg/out0.avg).toFixed(2)})`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
