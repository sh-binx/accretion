// 한국어 완전성 — KO 모드에서 화면에 보이는 문자열에 번역 안 된 영어가 0건이어야 한다.
// 범위: 메뉴 · 시작 카드(데스크톱·터치) · 플레이 HUD · 배너/코덱스 토스트/팝업(발생 전량 수집) ·
//       진화 선택 카드 · 결과 화면(증발·포식) · 코덱스(39 전부 발견) · 업적 · 데일리.
// 허용: 고유명사·기호(ACCRETION 워드마크, TON 618, M87*, R136a1, LIGO, WASD 키캡, 단위 M☉·K·M·B, 버전).
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/toss/package.json')
const { chromium, devices } = require('playwright')
const BASE = 'http://localhost:3040/?dev=1&lang=ko'
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }
const sleep = ms => new Promise(r=>setTimeout(r,ms))
const ALLOW = /ACCRETION|TON\s?618|M87\*?|R136a1|LIGO|S2\b|WASD|\bv\d+\.\d+\.\d+|M☉|[0-9.,]+[KMB]\b|×\d+|\ba\s*=\s*M\b|\bA\*|\bE\b|\bC\b|\bF\b|\bW\b|\bA\b|\bS\b|\bD\b|X-1|\([A-Za-z -]+\)/g
const leftovers = s => (s.replace(ALLOW,' ').match(/[A-Za-z]{2,}(?:[ '’-][A-Za-z]{2,})*/g) || [])

// 페이지 안: 보이는 잎 텍스트 + 이후 나타나는 모든 메시지 채널 텍스트를 수집한다
const INSTALL = () => {
  window.__koSeen = new Set()
  const grab = el => { const t=(el.innerText||el.textContent||'').trim(); if(t) window.__koSeen.add(t) }
  const obs = new MutationObserver(ms => { for (const m of ms) { const el = m.target.nodeType===1 ? m.target : m.target.parentElement; if (el && el.closest && el.closest('#banner,#codex,#combo,#apex,.pop,#rankline,#over,#choice,#surge,#hud,#right,#massbar,#feedwrap,#milestone')) grab(el) } })
  obs.observe(document.body, { subtree:true, childList:true, characterData:true })
}
const VISIBLE = () => {   // 텍스트 노드 단위 — 자식이 섞인 버튼(예: 'CODEX <span>0/39</span>')의 자기 글자도 잡는다
  const out=[], seen=new Set()
  const tw=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n=tw.nextNode(); n; n=tw.nextNode()) {
    const t=n.nodeValue.trim(); if(!t) continue
    const e=n.parentElement; if(!e||/^(SCRIPT|STYLE|NOSCRIPT)$/.test(e.tagName)) continue
    let p=e, hidden=false; while(p&&p!==document.documentElement){ const c=getComputedStyle(p); if(c.display==='none'||c.visibility==='hidden'||+c.opacity===0){hidden=true;break} p=p.parentElement }
    if (hidden) continue
    const r=e.getBoundingClientRect(); if (r.width===0||r.height===0) continue
    if(!seen.has(t)){seen.add(t);out.push(t)}
  }
  return out
}

const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] })
const errors = []
const bad = {}
const note = (where, arr) => { for (const t of arr) { const l=leftovers(t); if (l.length) (bad[where] ||= new Set()).add(t.slice(0,90)+'  ⟶ '+l.join(',')) } }
try {
  // ── 데스크톱 ──
  const page = await browser.newPage({ viewport:{ width:1280, height:720 } })
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(BASE, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.state, { timeout:15000 })
  await page.evaluate(() => { localStorage.removeItem('acc_codex'); localStorage.removeItem('acc_ach'); localStorage.removeItem('acc_verbs'); localStorage.removeItem('acc_onboard') })
  await page.reload({ waitUntil:'networkidle' }); await page.waitForFunction(() => window.__acc && window.__acc.state)
  await page.evaluate(INSTALL)
  note('menu', await page.evaluate(VISIBLE))
  await page.click('#startBtn'); await sleep(500)
  note('start card', await page.evaluate(VISIBLE))
  await page.keyboard.press('KeyD'); await sleep(300)
  // 한 판을 티어별로 밀며 이벤트·배너·팝업을 최대한 발생시킨다
  await page.evaluate(async () => {
    const A=window.__acc, w=ms=>new Promise(r=>setTimeout(r,ms))
    const pump=async n=>{for(let i=0;i<n;i++){A.setInv(3);A.eatNearest();A.step(0.25);await w(10)}}
    await pump(20); A.setEnergy(1); await pump(8)
    for (const M of [6, 45, 150, 1500, 15000, 150000, 2e6]) { A.setMass(M); await pump(14); A.setEnergy(1); A.doPulse&&A.doPulse(); await pump(6) }
    A.spawnNemesis&&A.spawnNemesis(); await pump(10)
    A.doWave&&A.doWave(); A.doFlare&&A.doFlare(); A.fireExtremal&&A.fireExtremal(); await pump(10)
  })
  note('play (HUD)', await page.evaluate(VISIBLE))
  // 진화 선택 카드
  await page.evaluate(() => { const A=window.__acc; A.begin(); A.hideOnboard(); A.choiceReal(true); A.setMass(A.bhMass()*1.05); A.step(0.2); A.setMass(130); A.step(0.2) })
  await sleep(400)
  note('evolution choice', await page.evaluate(VISIBLE))
  await page.keyboard.press('Digit1'); await page.evaluate(() => window.__acc.choiceReal(false))
  // 카드는 무작위 3장이라 한 판에 다 안 나온다 — 6종 전부의 한국어 문구를 데이터에서 직접 확인한다
  note('evolution choice (all 6)', await page.evaluate(() => EVO_BOONS.flatMap(b=>[trk(b.n),T(b.sum),T(b.w),...b.fx.map(f=>trk(f[0]))])))
  // 콤보 단계·마일스톤·티어·업적·데일리 — 발생 여부와 무관하게 전부
  note('data tables', await page.evaluate(() => [...COMBO_BOONS.map(c=>trk(c.name)),...MASS_MARKS.flatMap(m=>[L('▲ '+m.n),L(m.d)]),...TIERS.flatMap(t=>[L('▲ '+t.n),L(t.d)]),
    ...DAILY_MODS.flatMap(m=>[trk(m.name),trk(m.desc)]),...Object.keys(ACH_KO).flatMap(k=>ACH_KO[k]),...Object.values(SKINS).map(x=>trk(x.name))]))
  ok('codex: Korean name + fact for all 39', await page.evaluate(() => CODEX_ORDER.every(k=>CODEX_KO[k]&&CODEX_KO[k][0]&&CODEX_KO[k][1])))
  ok('awards: Korean name + desc for all 20', await page.evaluate(() => ACH.every(a=>ACH_KO[a.id])))
  // 결과 화면 ×2
  await page.evaluate(() => { const A=window.__acc; A.setScore(1234); A.gameOver() }); await sleep(600)
  note('results (evaporated)', await page.evaluate(VISIBLE))
  await page.evaluate(() => { const A=window.__acc; A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearObjs(); A.setMass(5); A.spawn('rival', 400, 0, 0); for(let i=0;i<30;i++)A.step(0.1) }); await sleep(600)
  note('results (devoured)', await page.evaluate(VISIBLE))
  // 코덱스 — 전부 발견시킨 뒤
  await page.evaluate(() => { for (const k of window.__acc.codexKeys()) window.__acc.discover(k); window.__acc.openCodex() }); await sleep(300)
  const cdx = await page.evaluate(VISIBLE); note('codex (39)', cdx)
  const cdxGot = await page.evaluate(() => document.querySelectorAll('#codexGrid .cdx.got').length)
  await page.evaluate(() => { document.querySelector('#codexTabs .tab[data-ct="awards"]').click() }); await sleep(200)
  note('awards', await page.evaluate(VISIBLE))
  await page.evaluate(() => window.__acc.closeCodex())
  // 데일리
  await page.evaluate(() => { window.__acc.startDaily() }); await sleep(900)
  note('daily start', await page.evaluate(VISIBLE))
  note('messages seen during play', await page.evaluate(() => [...window.__koSeen]))
  const seen = await page.evaluate(() => window.__koSeen.size)
  ok('scanner collected in-play messages', seen>40, `${seen} distinct`)
  ok('codex screen shows all 39 entries (discovered)', cdxGot===39, String(cdxGot))
  await page.close()

  // ── 터치(가로 844×390) ──
  const ctx = await browser.newContext({ viewport:{width:844,height:390}, isMobile:true, hasTouch:true, deviceScaleFactor:2, userAgent:devices['iPhone 13'].userAgent })
  const mp = await ctx.newPage(); mp.on('pageerror', e => errors.push(e.message))
  await mp.goto(BASE, { waitUntil:'networkidle' }); await mp.waitForFunction(() => window.__acc && window.__acc.state)
  await mp.evaluate(INSTALL)
  note('touch menu', await mp.evaluate(VISIBLE))
  await mp.tap('#startBtn')
  await mp.waitForFunction(() => getComputedStyle(document.getElementById('onb')).opacity==='1', null, { timeout:5000 })
  const card = await mp.evaluate(VISIBLE); note('touch start card', card)
  ok('touch start card is shown and names no keyboard keys', card.some(t=>/드래그/.test(t)) && !card.some(t=>/SPACE|SHIFT|스페이스|시프트|WASD|아무 키/.test(t)), card.join(' | '))
  // 줄바꿈 판정: 텍스트 범위의 줄(서로 다른 top) 개수 — 한 글자씩 세로로 쪼개지던 회귀를 잡는다
  const wrap = await mp.evaluate(() => [...document.querySelectorAll('#onb *')].filter(e=>!e.children.length&&e.textContent.trim().length>1).map(e=>{const rg=document.createRange();rg.selectNodeContents(e);const tops=new Set([...rg.getClientRects()].map(r=>Math.round(r.top)));return {t:e.textContent.trim(),lines:tops.size}}).filter(x=>x.lines>1))
  ok('touch start card: no wrapped labels', wrap.length===0, JSON.stringify(wrap))
  await mp.touchscreen.tap(400,200); await sleep(200)
  await mp.evaluate(async () => { const A=window.__acc, w=ms=>new Promise(r=>setTimeout(r,ms)); A.hideOnboard(); A.setEnergy(1); for(let i=0;i<10;i++){A.setInv(3);A.eatNearest();A.step(0.25);await w(10)} A.setMass(A.bhMass()*1.1); for(let i=0;i<30;i++){A.setInv(3);A.step(0.1);await w(20)} })
  note('touch play', await mp.evaluate(VISIBLE))
  note('touch messages', await mp.evaluate(() => [...window.__koSeen]))
  await ctx.close()

  const total = Object.values(bad).reduce((n,s)=>n+s.size,0)
  for (const [w,s] of Object.entries(bad)) for (const t of s) console.log(`   · [${w}] ${t}`)
  ok('KO mode: zero untranslated strings (menu · start · HUD · messages · choice · results · codex · awards)', total===0, `${total} leftovers`)
  ok('no JS errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) { console.error('FATAL', e); results.push([false,'fatal',String(e)]) }
finally { await browser.close() }
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
