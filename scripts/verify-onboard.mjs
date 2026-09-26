// 출시 정리(2026-09-26) — 시작 카드 단순화 · 동사 이름 통일(PULL) · 동사는 풀릴 때 가르친다 · 후반 중앙 정리.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const URL = 'http://localhost:3040/?dev=1&lang=en'
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }
const sleep = ms => new Promise(r=>setTimeout(r,ms))
const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport:{ width:1280, height:720 } })
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()) })
try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.state, { timeout:15000 })
  await page.evaluate(() => window.__acc.resetVerbs())

  // ── 시작 카드: 조종 + 대시 두 줄, 링 색 한 줄 ──
  await page.click('#startBtn'); await sleep(450)
  const card = await page.evaluate(() => ({ rows: document.querySelectorAll('#onb .ob-r').length, txt: document.getElementById('onb').innerText.replace(/\s+/g,' ') }))
  ok('start card: exactly two control rows (steer · dash)', card.rows===2, card.txt)
  ok('start card: no advanced verbs (pull/wave/hold)', !/SHIFT|PULL|WAVE|HOLD|FRAME|ORBIT|\bE\b|\bC\b/.test(card.txt), card.txt)
  ok('start card: halo legend kept in one row', /EDIBLE.*EATS YOU.*SHATTERS YOU/.test(card.txt))
  await page.keyboard.press('KeyD'); await sleep(150)

  // ── 동사 이름 통일: SHIFT = PULL (버튼 · 배너) ──
  ok('ability button reads PULL', await page.evaluate(() => document.getElementById('actPulse').textContent.trim())==='◉ PULL')
  const pullBanner = await page.evaluate(() => { const A=window.__acc; A.setEnergy(1); A.doPulse(); return A.msgList().map(m=>m.main).join('|') })
  ok('PULL fires a banner with the same name', /◉ PULL/.test(pullBanner), pullBanner)
  ok('no stray SPIN / COLLAPSE PULSE naming in the page source', await page.evaluate(() => !/◉ SPIN|COLLAPSE PULSE|frame drag<\/i>/.test(document.documentElement.innerHTML)))

  // ── 동사는 풀릴 때 가르친다: 에너지가 처음 차면 한 번 ──
  const hint = await page.evaluate(() => { const A=window.__acc; A.begin(); A.hideOnboard(); A.resetVerbs(); A.setEnergy(1); A.step(0.1); return A.msgList().map(m=>m.main) })
  ok('first full charge teaches the three abilities', hint.some(m=>/CHARGED/.test(m)), hint.join('|'))
  const again = await page.evaluate(() => { const A=window.__acc; A.setEnergy(0); A.step(0.1); A.setEnergy(1); A.step(0.1); return A.msgList().filter(m=>/CHARGED/.test(m.main)).length })
  ok('…only once per run', again<=1, String(again))
  const learned = await page.evaluate(() => { const A=window.__acc; A.setEnergy(1); A.doSurge(); A.step(1.2); A.setEnergy(1); A.doPulse(); A.step(0.3); A.setEnergy(1); A.doWave(); A.step(0.3)
    A.begin(); A.hideOnboard(); A.setEnergy(1); A.step(0.1); return { verbs:A.verbs(), hint:A.msgList().some(m=>/CHARGED/.test(m.main)) } })
  ok('once all three are used, the hint stops', learned.verbs.length===3 && !learned.hint, JSON.stringify(learned))

  // ── 후반 중앙 정리 ──
  const boon = await page.evaluate(() => { const A=window.__acc; A.begin(); A.hideOnboard(); A.setMass(3000); A.step(0.2); A.setCombo(40); A.noteBoon(); return { q:A.msgList().map(m=>m.main), flash:document.getElementById('combo').classList.contains('up') } })
  ok('combo stage-up flashes the counter instead of a duplicate banner', boon.flash && !boon.q.some(m=>/HYPERACCRETION|RELATIVISTIC BEAM|BLAZAR|SUPER-EDDINGTON|DISK FLARE|MAGNETOSPHERE/.test(m)), JSON.stringify(boon))
  const apex = await page.evaluate(async () => { const A=window.__acc; A.spawnNemesis(); A.setCombo(30); A.step(0.3); await new Promise(r=>setTimeout(r,400))
    const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom}}
    return { apex:box('apex'), combo:box('combo'), banner:box('banner'), on:document.getElementById('apex').classList.contains('on'), w:innerWidth } })
  const overlap=(a,b)=>a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b
  ok('APEX badge lives in the left column, not the centre stack', apex.on && apex.apex.r < apex.w*0.4, JSON.stringify(apex.apex))
  ok('APEX badge overlaps neither combo nor banner', !overlap(apex.apex,apex.combo) && !overlap(apex.apex,apex.banner))
  const ach = await page.evaluate(() => { const A=window.__acc, log=[], orig=window.banner
    window.banner=(m,s,p)=>{log.push([L(m),p||2]);return orig(m,s,p)}
    A.resetAwards(); A.begin(); A.hideOnboard(); A.setMass(150); A.step(0.2)
    window.banner=orig; return log.filter(x=>/^★/.test(x[0])&&!/SUPERNOVA/.test(x[0])) })
  ok('award toasts queue at the lowest priority', ach.length>0 && ach.every(x=>x[1]===1), JSON.stringify(ach))
  const cover = await page.evaluate(() => { const A=window.__acc; return { small:A.coverDamp(20,10), big:A.coverDamp(40,10), huge:A.coverDamp(200,10) } })
  ok('cover damping: normal bodies untouched, screen-filling ones fade to ≥0.5', cover.small===1 && cover.big<1 && cover.huge===0.5, JSON.stringify(cover))

  // ── 버전 표기: 플레이 중엔 숨김, 메뉴엔 v1.0.0 ──
  const ver = await page.evaluate(() => { const c=document.getElementById('credit'); return { txt:c.textContent, playing:getComputedStyle(c).display, proto:/prototype \d/i.test(document.body.innerText) } })
  ok('in-play HUD shows no version / prototype label', ver.playing==='none' && !ver.proto, JSON.stringify(ver))
  await page.evaluate(() => window.__acc.gameOver()); await sleep(300)
  ok('menu/results keep a small release label v1.0.0', await page.evaluate(() => { const c=document.getElementById('credit'); return c.textContent==='v1.0.0' && getComputedStyle(c).display!=='none' }))
  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) { console.error('FATAL', e); results.push([false,'fatal',String(e)]) }
finally { await browser.close() }
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
