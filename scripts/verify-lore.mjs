// 세계관 정확성 — "실제 천체물리를 게임 규칙으로"라는 약속을 테스트로 고정한다.
// 별은 암석을 모아 태어나지 않고(원시별=붕괴하는 가스 구름 핵),
// 약 20 태양질량 이상인 별만 붕괴해 블랙홀이 된다.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const URL='http://localhost:3040/?dev=1'
const results=[]
const ok=(n,c,x='')=>{results.push([c,n,x]);console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`)}

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage']})
const page=await browser.newPage()
const errors=[]
page.on('pageerror',e=>errors.push('PAGEERR: '+e.message))
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('CONSOLE: '+m.text())})

try{
  await page.goto(URL,{waitUntil:'networkidle',timeout:30000})
  await page.waitForFunction(()=>window.__acc&&window.__acc.form,{timeout:15000})
  ok('boot',true)

  // ── 1단계 = 원시별 ──
  const s0=await page.evaluate(()=>{const A=window.__acc;A.begin();A.step(0.05)
    return {f:A.form(),v:A.formVis(),drain:document.querySelector('#massbar .t')?.textContent||''}})
  ok('시작 형태가 PROTOSTAR', s0.f.name==='PROTOSTAR'&&s0.f.idx===0, s0.f.name)
  ok('원시별 메시가 표시되고 항성·블랙홀 파츠는 숨김', s0.v.rock===true&&s0.v.star===false&&s0.v.bh===false, JSON.stringify(s0.v))
  ok('드레인 문구가 OUTFLOWS(쌍극류) — 침식이 아니다', /OUTFLOW/.test(s0.drain), s0.drain.trim())

  // ── 20 M☉ 미만은 블랙홀이 되지 않는다 ──
  const under=await page.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(19.4);A.step(0.05);A.step(0.05)
    return {name:A.form().name,idx:A.form().idx,mass:+A.state.mass.toFixed(1)}})
  ok('19.4 M☉ → 아직 MAIN SEQUENCE (블랙홀 아님)', under.name==='MAIN SEQUENCE'&&under.idx===1, `${under.name} @${under.mass}`)

  const mid=await page.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(13);A.step(0.05)
    return A.form().name})
  ok('13 M☉도 MAIN SEQUENCE — 옛 임계값(12)에서 넘어가지 않는다', mid==='MAIN SEQUENCE', mid)

  // ── 20을 넘으면 초신성 1회 후 블랙홀 ──
  const over=await page.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(6);A.step(0.05);A.setMass(20.6);A.step(0.06)
    return {name:A.form().name,idx:A.form().idx,shock:A.shockOn(),nova:A.novaCount(),v:A.formVis()}})
  ok('20.6 M☉ → BLACK HOLE 전이', over.name==='BLACK HOLE'&&over.idx===2, over.name)
  ok('전이 순간 초신성이 터진다', over.nova===1&&over.shock===true, `초신성 ${over.nova}회 · 충격파 ${over.shock}`)
  ok('블랙홀 파츠로 교체된다', over.v.bh===true&&over.v.rock===false&&over.v.star===false, JSON.stringify(over.v))

  // 초신성은 한 번뿐(질량이 오르내려도 되돌아가지 않는다)
  const novas=await page.evaluate(()=>{const A=window.__acc;A.begin();A.setMass(6);A.step(0.05);A.setMass(20.6);A.step(0.06)
    for(let i=0;i<10;i++){A.setMass(19.4);A.step(0.06);A.setMass(20.7);A.step(0.06)}
    return {n:A.novaCount(),name:A.form().name}})
  ok('임계값을 오르내려도 초신성은 한 번뿐 · 형태 단조 증가', novas.n===1&&novas.name==='BLACK HOLE', `초신성 ${novas.n}회`)

  // ── 코덱스 ──
  const cdx=await page.evaluate(()=>{const A=window.__acc;A.resetCodex();A.begin();A.step(0.05)
    return {seen:A.codex().seen,total:A.codex().total}})
  ok('PROTOSTAR 코덱스가 첫 판에 열린다', cdx.seen.includes('protostar'), cdx.seen.join(','))
  ok('코덱스 33항목', cdx.total===33, `${cdx.total}`)

  const fact=await page.evaluate(()=>{const A=window.__acc;A.discover('protostar');A.openCodex()
    const t=document.getElementById('codexGrid')?.textContent||'';A.closeCodex();return t})
  ok('코덱스에 "암석에서 태어나지 않는다"는 사실이 실린다', /never gathered from rock/i.test(fact))

  // ── 진화 사슬 전체가 실제 항성 생애주기와 일치 ──
  const chain=await page.evaluate(()=>{const A=window.__acc;A.begin();const seq=[]
    for(const m of [1.5,6,25,300]){A.setMass(m);A.step(0.06);const n=A.form().name;if(seq[seq.length-1]!==n)seq.push(n)}
    return seq})
  ok('사슬 = PROTOSTAR → MAIN SEQUENCE → BLACK HOLE', chain.join('>')==='PROTOSTAR>MAIN SEQUENCE>BLACK HOLE', chain.join(' → '))

  // 혜성 꼬리는 광원 반대쪽을 향한다(복사압·항성풍). 코덱스가 그렇게 가르치는데
  // 정작 게임은 아무 방향으로나 뻗어 있었다(오너 리포트: "화살표 같은 게 뭐냐").
  {
    const r = await page.evaluate(async () => {
      const A = window.__acc
      A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(1.8)
      const c = A.pos()
      const P = [[0,10],[9,5],[-9,5],[7,-6],[-7,-6],[0,-11]]
      for (const [x,z] of P) A.spawn('comet', 0.5, c.x+x, c.z+z)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      return A.cometTails()
    })
    const bad = r.filter(v => v.err > 0.12)
    ok('혜성 꼬리가 광원(플레이어) 반대쪽을 향함', r.length >= 5 && bad.length === 0,
       'n=' + r.length + (bad.length ? ' 최대오차 ' + Math.max(...bad.map(b => b.err)).toFixed(2) : ''))
    await page.evaluate(() => window.__acc.setSpawn(true))
  }

  ok('no JS/console errors',errors.length===0,errors.slice(0,3).join(' | '))
}catch(e){console.error('FATAL',e);results.push([false,'fatal',String(e)])}
finally{await browser.close()}
const passed=results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length?0:1)
