// Leaderboard verification (P3) — headless Playwright + SwiftShader GL.
// Checks: boot/no-errors, name persist, submit(valid+anti-cheat), board render,
// XSS escape, gameOver rank reveal, typing-guard, board buttons.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const URL = 'http://localhost:3040/?dev=1'

const results = []
const ok = (n, c, extra='') => { results.push([c, n, extra]); console.log(`${c?'✓':'✗'} ${n}${extra?'  '+extra:''}`) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch({
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage']
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
// note: 안티치트가 거부한 요청은 HTTP 422 → 브라우저가 "Failed to load resource"로 콘솔에 찍지만
// 이는 정상 응답(LB.submit이 catch해 null 반환)이지 JS 에러가 아니므로 제외.
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: '+m.text()) })

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.state, { timeout:15000 })
  ok('boot: __acc present', true)

  // 1) name persistence across reload
  await page.evaluate(() => window.__acc.setName('QA_PILOT'))
  await page.reload({ waitUntil:'networkidle' })
  await page.waitForFunction(() => window.__acc && window.__acc.LB, { timeout:15000 })
  const persisted = await page.evaluate(() => window.__acc.LB.name)
  ok('name persists across reload', persisted==='QA_PILOT', `got "${persisted}"`)

  // 2) valid submit → ok + rank
  const sub = await page.evaluate(() => window.__acc.submitRun(1500, 5.5, 'INTERMEDIATE', 40, '2000-01-01'))  // QA 전용 날짜 보드(2000-01-01)로 보낸다 — 글로벌은 day IS NULL만 집계하므로 오염되지 않는다
  ok('valid submit returns ok+rank', !!(sub && sub.ok && sub.rank>=1), JSON.stringify(sub))

  // 3) anti-cheat: instant huge score rejected (server responds ok:false + reason)
  const cheat = await page.evaluate(() => window.__acc.submitRun(9999999, 5, 'x', 1))
  ok('anti-cheat rejects instant high score', !!(cheat && cheat.ok===false && cheat.reason), JSON.stringify(cheat))

  // 4) board opens, lists rows, contains our name
  await page.evaluate(() => window.__acc.openBoard())
  await sleep(1200)
  const bOpen = await page.evaluate(() => window.__acc.boardOpen())
  const rows = await page.evaluate(() => window.__acc.boardRows())
  const html = await page.evaluate(() => window.__acc.boardHTML())
  ok('board overlay opens', bOpen===true)
  ok('board lists >=1 row', rows>=1, `rows=${rows}`)
  // QA 제출은 2000-01-01 보드로 격리되므로 글로벌 보드에 뜨지 않는 것이 정상.
  // 렌더 자체는 위의 'board lists >=1 row'가, 제출 성공은 'valid submit returns ok+rank'가 담당한다.
  ok('QA 제출이 글로벌 보드를 오염시키지 않는다', !/QA_PILOT/.test(html))

  // 5) XSS escape — 렌더 함수를 직접 먹여 검사한다.
  //    예전엔 실제 제출로 확인했는데, (a) 라이브 리더보드에 매 실행마다 행이 쌓였고
  //    (b) 보드가 차면 그 행이 밀려나 오탐이 났다(2026-07-27 QA행 50건 삭제).
  const html2 = await page.evaluate(() => window.__acc.rowHTML({name:'<b>HAX', tier:'<i>T', score:1200}))
  ok('XSS: name escaped (&lt;b&gt;)', html2.includes('&lt;b&gt;HAX'), html2.slice(0,90))
  ok('XSS: tier escaped', html2.includes('&lt;i&gt;T'))
  ok('XSS: no raw <b> injected', !/<b>HAX/.test(html2))
  await page.evaluate(() => window.__acc.closeBoard())

  // 6) gameOver → rank reveal in rankline
  await page.evaluate(() => window.__acc.setName('QA_PILOT'))
  await page.evaluate(() => window.__acc.begin())
  await page.evaluate(() => window.__acc.setScore(1500))
  await page.evaluate(() => window.__acc.gameOver())
  await sleep(1400)
  const rank = await page.evaluate(() => window.__acc.rankText())
  ok('gameOver reveals global rank', /RANK\s*#\d+/i.test(rank), `"${rank}"`)

  // 7) typing guard — on a FRESH start screen (input visible), pressing a game key
  //    while the name field is focused must NOT toggle mute.
  await page.reload({ waitUntil:'networkidle' })
  await page.waitForFunction(() => window.__acc && window.__acc.LB, { timeout:15000 })
  const inputVisible = await page.isVisible('#pname')
  const beforeMute = await page.evaluate(() => window.__acc.state.muted)
  await page.focus('#pname')
  await page.keyboard.press('KeyM')
  const afterMute = await page.evaluate(() => window.__acc.state.muted)
  ok('typing guard: M in name field does not toggle mute', inputVisible && beforeMute===afterMute, `vis=${inputVisible} ${beforeMute}->${afterMute}`)

  // 8) board buttons — CLOSE hides, PLAY starts a run
  await page.evaluate(() => window.__acc.openBoard())
  await sleep(300)
  await page.click('#boardClose')
  const closed = await page.evaluate(() => window.__acc.boardOpen())
  ok('board CLOSE hides overlay', closed===false)
  await page.evaluate(() => window.__acc.openBoard())
  await sleep(300)
  await page.click('#boardPlay')
  await sleep(200)
  const playing = await page.evaluate(() => window.__acc.state.alive)
  ok('board PLAY starts a run', playing===true)

  // 9) no JS errors overall
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
