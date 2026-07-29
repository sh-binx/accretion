// STEP 3 — achievements (second collection axis) + weekly leaderboard.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const URL = 'http://localhost:3040/?dev=1'
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }
const sleep = ms => new Promise(r=>setTimeout(r,ms))

const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: '+m.text()) })

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.awards, { timeout:15000 })
  ok('boot: meta hooks present', true)

  // ── achievements ──
  const a0 = await page.evaluate(() => { window.__acc.resetAwards(); return window.__acc.awards() })
  ok('awards reset to 0/20', a0.count===0 && a0.total===20, `${a0.count}/${a0.total}`)

  // milestones unlock from actual play state
  const earned = await page.evaluate(() => {
    const A=window.__acc; A.resetAwards(); A.begin()
    A.setMass(6);  A.step(0.06)          // → star  (ignite)
    A.setMass(21); A.step(0.06)          // → black hole via supernova (collapse)
    A.setMass(150); A.step(0.06)         // (m100)
    A.setMass(1200); A.step(0.06)        // (m1000)
    return A.awards()
  })
  for (const id of ['ignite','collapse','m100','m1000'])
    ok(`unlocks ${id}`, earned.got.includes(id), earned.got.join(','))

  // counters drive their own achievements
  const counters = await page.evaluate(() => {
    const A=window.__acc; A.resetAwards(); A.begin(); A.setMass(60); A.step(0.06)
    // 서지는 지속 0.9초 동안 재발동이 막히므로 그만큼 진행시켜야 실제로 10회 발동한다
    // 가만히 서 있으면 라이벌에게 잡히므로(그러면 doSurge가 막힘) 매 회차 필드를 비운다
    for (let i=0;i<11;i++){ A.clearObjs(); A.setMass(60); A.setEnergy(1); A.doSurge(); A.step(1.0) }
    return { got:A.awards().got, alive:A.state.alive, n:A.surgeCount?A.surgeCount():null }
  })
  ok('unlocks surge10 from real surges', counters.got.includes('surge10'), `alive=${counters.alive} got=${counters.got.join(',')}`)

  // persists across reload
  await page.reload({ waitUntil:'networkidle' })
  await page.waitForFunction(() => window.__acc && window.__acc.awards, { timeout:15000 })
  const persisted = await page.evaluate(() => window.__acc.awards())
  ok('awards persist across reload', persisted.count>0, `${persisted.count}/${persisted.total}`)

  // awards screen renders earned vs locked
  await page.evaluate(() => { window.__acc.setCodexTab('awards'); window.__acc.openCodex() })
  await sleep(300)
  const grid = await page.evaluate(() => ({
    tabs: document.querySelectorAll('#codexTabs .tab').length,
    total: document.querySelectorAll('#codexGrid .cdx').length,
    got: document.querySelectorAll('#codexGrid .cdx.got').length,
    sub: document.getElementById('codexSub').textContent,
  }))
  ok('codex screen has 2 tabs', grid.tabs===2)
  ok('awards grid lists all 20', grid.total===20, `${grid.total}`)
  ok('awards grid marks earned ones', grid.got>0 && grid.got<20, `${grid.got} earned`)
  ok('awards subtitle shows progress', /EARNED/.test(grid.sub), grid.sub)

  // switching back to codex restores the skin picker
  await page.evaluate(() => window.__acc.setCodexTab('codex'))
  await sleep(200)
  const back = await page.evaluate(() => ({ skins: document.querySelectorAll('#skinRow .skin').length, entries: document.querySelectorAll('#codexGrid .cdx').length }))
  ok('codex tab restores skin picker', back.skins===3, `${back.skins} skins`)
  ok('codex tab shows codex entries', back.entries===33, `${back.entries}`)
  await page.evaluate(() => window.__acc.closeCodex())

  // ── weekly leaderboard ──
  const wk = await page.evaluate(() => window.__acc.weekStart())
  ok('week start is a Monday (UTC)', new Date(wk).getUTCDay()===1, wk)

  await page.evaluate(() => window.__acc.openBoardMode('weekly'))
  await sleep(1400)
  const wb = await page.evaluate(() => ({
    mode: window.__acc.boardMode(),
    tabs: document.querySelectorAll('#boardTabs .tab').length,
    title: document.getElementById('boardTitle').textContent,
    sub: document.getElementById('boardSub').textContent,
  }))
  ok('board has 3 modes', wb.tabs===3, `${wb.tabs} tabs`)
  ok('weekly mode selected', wb.mode==='weekly')
  ok('weekly board titled', /WEEKLY/.test(wb.title) && /THIS WEEK/.test(wb.sub), `${wb.title} / ${wb.sub}`)

  // 주간 보드 경로 검증. 2026-07-28부터 DEV 제출은 QA 보드(2000-01-01)로 강제되므로
  // '내 행이 주간 보드에 뜬다'로는 확인할 수 없다(그렇게 하려면 프로덕션에 써야 한다).
  // 대신 ① 제출 경로가 살아있고 ② 주간 보드가 실제 데이터를 최신순으로 돌려주는지를 본다.
  await page.evaluate(() => window.__acc.setName('WEEK_QA'))
  const sub = await page.evaluate(() => window.__acc.LB.submit(4321, 9, 'INTERMEDIATE', 44, null, null))
  ok('submit ok', !!(sub && sub.ok), JSON.stringify(sub))
  await sleep(800)
  const wkBoard = await page.evaluate(async () => {
    const rows = await window.__acc.LB.topWeek(100)
    return { n: rows.length, sorted: rows.every((r,i)=>i===0||rows[i-1].score>=r.score), qaLeak: rows.some(r=>/QA/.test(r.name||'')) }
  })
  ok('weekly board returns rows', wkBoard.n>0, `${wkBoard.n} rows`)
  ok('weekly board is score-sorted', wkBoard.sorted===true)
  ok('QA 제출이 주간 보드에 새지 않는다', wkBoard.qaLeak===false)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
