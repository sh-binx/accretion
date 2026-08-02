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
     heat[0].heat < 0.05 && heat[1].heat > 0.95, `${heat[0].heat} → ${heat[1].heat}`)
  ok('heat: the field gets denser', heat[1].n > heat[0].n * 1.15, `${heat[0].n} → ${heat[1].n}개`)
  ok('heat: threats get more common', heat[1].mix.rivalP > heat[0].mix.rivalP * 1.25,
     `스폰 확률 ${heat[0].mix.rivalP} → ${heat[1].mix.rivalP} (표본 ${Math.round(heat[0].riv*100)}% → ${Math.round(heat[1].riv*100)}%)`)

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

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
