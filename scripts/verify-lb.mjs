// 리더보드 — 출시 빌드에선 꺼져 있다(2026-09-26 오너 결정: 백엔드 비활성 + 포털 정책 부담).
// 계약: ① 보드로 가는 입구·제출 UI가 전부 숨겨진다 ② 외부 네트워크 요청 0건 ③ 개인 최고점은 로컬에 남는다
// ④ 부활을 대비해 남긴 렌더 코드의 이스케이프는 여전히 안전하다.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const BASE = 'http://localhost:3040/'

const results = []
const ok = (n, c, extra='') => { results.push([c, n, extra]); console.log(`${c?'✓':'✗'} ${n}${extra?'  '+extra:''}`) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const vis = (page, sel) => page.evaluate(s => { const e=document.querySelector(s); if(!e) return false; const r=e.getBoundingClientRect(); return getComputedStyle(e).display!=='none' && r.width>0 && r.height>0 }, sel)

const browser = await chromium.launch({
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage']
})
const errors = [], external = []
const watch = page => {
  page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()) })
  page.on('request', r => { const u=r.url(); if (!/^(data:|blob:|http:\/\/localhost:3040\/)/.test(u)) external.push(u) })
}
try {
  // ── A. 프로덕션 모드(?dev 없음): 메뉴 → 실제 플레이 → 결과 화면까지 외부 요청 0건 ──
  const prod = await browser.newPage({ viewport:{ width:1280, height:720 } }); watch(prod)
  await prod.goto(BASE, { waitUntil:'networkidle', timeout:30000 })
  await sleep(600)
  ok('menu: LEADERBOARD entry hidden', !(await vis(prod, '#startBoard')))
  ok('menu: RANK chip hidden', !(await vis(prod, '#startDailyBoard')))
  ok('menu: pilot-name field hidden (only fed the board)', !(await vis(prod, '.namerow')))
  ok('menu: BEST chip still shown (local best kept)', await vis(prod, '#chipBest'))
  await prod.click('#startBtn'); await sleep(500)
  await prod.keyboard.press('KeyD')
  for (let i=0;i<16;i++){ await prod.keyboard.down(i%2?'KeyW':'KeyD'); await sleep(120); await prod.keyboard.up(i%2?'KeyW':'KeyD') }
  ok('prod: no __acc cheat hooks', await prod.evaluate(() => typeof window.__acc==='undefined'))
  await prod.close()

  // ── B. DEV 훅으로 결과 화면 경로를 강제한다 ──
  const page = await browser.newPage({ viewport:{ width:1280, height:720 } }); watch(page)
  await page.goto(BASE+'?dev=1', { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.state, { timeout:15000 })
  ok('flag: LB_ENABLED is false in the release build', await page.evaluate(() => window.__acc.lbEnabled()===false))

  const sub = await page.evaluate(() => window.__acc.submitRun(1500, 5.5, 'INTERMEDIATE', 40, '2000-01-01'))
  ok('LB.submit is inert (disabled, no request)', !!(sub && sub.ok===false && sub.reason==='disabled'), JSON.stringify(sub))
  const rows = await page.evaluate(async () => (await window.__acc.LB.top(100)).length)
  ok('LB.top returns nothing', rows===0, `rows=${rows}`)

  await page.evaluate(() => window.__acc.openBoard())
  await sleep(300)
  ok('openBoard is a no-op', await page.evaluate(() => !window.__acc.boardOpen()))

  await page.evaluate(() => { localStorage.removeItem('acc_best'); const A=window.__acc; A.begin(); A.setScore(4321); A.gameOver() })
  await sleep(900)
  ok('results: no leaderboard button', !(await vis(page, '#overBoard')))
  ok('results: no rank/"board offline" line', !(await vis(page, '#rankline')) && (await page.evaluate(() => window.__acc.rankText()))==='', `"${await page.evaluate(() => window.__acc.rankText())}"`)
  ok('results: AGAIN still offered', await vis(page, '#retryBtn'))
  ok('personal best saved locally', await page.evaluate(() => window.__acc.bestScore())===4321)
  await page.reload({ waitUntil:'networkidle' })
  await page.waitForFunction(() => window.__acc && window.__acc.state, { timeout:15000 })
  ok('personal best survives reload', await page.evaluate(() => window.__acc.bestScore())===4321)

  // 부활 대비 코드 — 이스케이프 회귀
  const html2 = await page.evaluate(() => window.__acc.rowHTML({name:'<b>HAX', tier:'<i>T', score:1200}))
  ok('XSS: name escaped (&lt;b&gt;)', html2.includes('&lt;b&gt;HAX'), html2.slice(0,90))
  ok('XSS: tier escaped', html2.includes('&lt;i&gt;T'))
  ok('XSS: no raw <b> injected', !/<b>HAX/.test(html2))

  ok('zero external network requests (menu · play · results)', external.length===0, external.slice(0,3).join(' | '))
  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e)
  results.push([false, 'fatal', String(e)])
} finally {
  await browser.close()
}

const passed = results.filter(r => r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
