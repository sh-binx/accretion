// v1.1 재미·잔존 패스 검증(2026-10-09) — 생존 기회 · 초반 유예 · 별먼지/업그레이드/연속 · 세로 플레이 · GPU 누수.
// 배경: CrazyGames Basic Launch 반려(D1 2.3% · 전환 55% · 모바일 40% · 평균 4분 43초 · gameplay crash 3.2%).
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/toss/package.json')
const { chromium } = require('playwright')
const URL = 'http://localhost:3040/?dev=1'
const results = []
const ok = (n, c, x = '') => { results.push([c, n, x]); console.log(`${c ? '✓' : '✗'} ${n}${x ? '  ' + x : ''}`) }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'] })
const errors = []
try {
  const page = await browser.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForFunction(() => window.__acc, { timeout: 15000 })
  await page.evaluate(() => localStorage.clear())

  // 1) 생존 기회 — 첫 사건지평선 접촉은 살아남고(질량 손실·밀려남), 두 번째는 죽는다
  const save = await page.evaluate(() => {
    const A = window.__acc; A.begin(); A.hideOnboard(); A.setSpawn(false); A.clearField(); A.setMass(100); A.step(0.1); A.setInv(0)
    const sh0 = A.shield(), m0 = A.state.mass, q = A.pos()
    A.spawn('rival', 400, q.x + 0.2, q.z); A.step(0.05)
    const first = { alive: A.state.alive, saves: A.saves(), shield: A.shield(), mass: A.state.mass }
    A.clearObjs(); A.setInv(0); const q2 = A.pos(); A.spawn('rival', 400, q2.x + 0.2, q2.z); A.step(0.05)
    A.setSpawn(true)
    return { sh0, m0, first, second: A.state.alive }
  })
  ok('판마다 생존 기회 1회', save.sh0 === 1, `shield=${save.sh0}`)
  ok('첫 접촉은 살아남고 기회를 쓴다', save.first.alive && save.first.saves === 1 && save.first.shield === 0, JSON.stringify(save.first))
  ok('살아남는 대가로 질량을 잃는다', save.first.mass < save.m0 * 0.75, `${save.m0} → ${save.first.mass}`)
  ok('기회를 다 쓰면 다음 접촉은 죽는다', save.second === false)

  // 2) 초반 유예 — 처음 세 판은 14초까지 최저(0.15), 50초에 1. 그 뒤 판은 8초·30초. 블랙홀은 유예 없음
  const ramp = await page.evaluate(() => {
    const A = window.__acc; const out = {}
    localStorage.removeItem('acc_runs'); A.begin(); S.t = 5; out.fresh5 = A.huntRamp(); S.t = 50; out.fresh50 = A.huntRamp()
    localStorage.setItem('acc_runs', '5'); S.t = 5; out.vet5 = A.huntRamp(); S.t = 30; out.vet30 = A.huntRamp()
    S.formIdx = 2; S.bhAt = null; S.t = 1; out.bh = A.huntRamp(); S.bhAt = 40; S.t = 41; out.bhNew = A.huntRamp(); S.t = 53; out.bhLate = A.huntRamp(); return out })
  ok('신규: 초반엔 라이벌이 거의 쫓지 않는다', ramp.fresh5 <= 0.15 && ramp.fresh50 === 1, JSON.stringify(ramp))
  ok('경험자: 유예가 짧다', ramp.vet5 <= 0.15 && ramp.vet30 === 1)
  ok('블랙홀이 된 직후 12초는 추격이 서서히 오른다', ramp.bh === 1 && ramp.bhNew < 0.5 && ramp.bhLate === 1, JSON.stringify({bh:ramp.bh,bhNew:ramp.bhNew,bhLate:ramp.bhLate}))

  // 3) 별먼지 정산 · 하루 첫 판 연속 보너스는 한 번 · 구매 · 다음 판 반영 · 저장 키
  const meta = await page.evaluate(() => {
    const A = window.__acc; localStorage.clear(); const o = {}
    A.begin(); S.peak = 500; S.t = 95; A.gameOver(); o.d1 = dustBal(); o.txt = document.getElementById('overDust').innerText
    A.begin(); S.peak = 2; S.t = 10; A.gameOver(); o.d2 = dustBal()
    localStorage.setItem('acc_streak', localDay(-1) + '|3'); A.begin(); S.peak = 2; S.t = 10; A.gameOver(); o.streak = streakInfo().n; o.d3 = dustBal()
    o.buy = buyUp('head'); o.lv = metaLv('head'); A.begin(); o.start = S.mass
    o.evap0 = 1; o.evapBuy = (localStorage.setItem('acc_dust', '999'), buyUp('evap')); A.begin(); o.modEvap = S.modEvap
    o.shieldBuy = buyUp('shield'); A.begin(); o.shield = A.shield()
    o.keys = ['acc_dust', 'acc_up', 'acc_streak', 'acc_runs'].every(k => localStorage.getItem(k) != null)
    A.gameOver(); return o })
  ok('판이 끝나면 별먼지를 받는다(하루 첫 판 연속 보너스 포함)', meta.d1 > 20 && /STARDUST|별먼지/.test(meta.txt), `${meta.d1} · ${meta.txt.split('\n')[0]}`)
  ok('같은 날 두 번째 판엔 연속 보너스가 없다', meta.d2 - meta.d1 < 10, `+${meta.d2 - meta.d1}`)
  ok('어제 이어서 오면 연속이 늘고 보너스가 커진다', meta.streak === 4 && meta.d3 - meta.d2 >= 10 + 4 * 3, `streak=${meta.streak} +${meta.d3 - meta.d2}`)
  ok('업그레이드 구매가 다음 판에 반영된다(시작 질량)', meta.buy && meta.lv === 1 && meta.start === 1.5, `start=${meta.start}`)
  ok('증발 업그레이드가 드레인을 줄인다', meta.evapBuy && meta.modEvap < 1, `modEvap=${meta.modEvap}`)
  ok('두 번째 기회 업그레이드 = 판마다 2회', meta.shieldBuy && meta.shield === 2)
  ok('메타 값이 저장 키(클라우드 동기 대상)에 남는다', meta.keys)

  // 4) 세로 화면 — 회전 강제 없이 플레이, 좌우 시야 보정
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const pp = await ctx.newPage(); pp.on('pageerror', e => errors.push('portrait: ' + e.message))
  await pp.goto(URL, { waitUntil: 'networkidle' }); await pp.waitForFunction(() => window.__acc)
  const por = await pp.evaluate(() => { window.__acc.begin(); window.__acc.step(0.5)
    return { rotate: document.getElementById('rotate').classList.contains('on'), paused: window.__acc.pauseState().orient, fov: +cam.fov.toFixed(1), alive: window.__acc.state.alive, t: window.__acc.state.t } })
  ok('세로: 회전 안내로 막지 않는다', !por.rotate && !por.paused, JSON.stringify(por))
  ok('세로: 화각을 넓혀 좌우 시야를 보정', por.fov > 80 && por.fov < 95, `fov=${por.fov}`)
  ok('세로: 판이 진행된다', por.alive && por.t > 0.4)
  await ctx.close()

  // 5) GPU 누수 — 천체 수천 개를 만들고 치워도 지오메트리가 쌓이지 않는다
  const leak = await page.evaluate(() => { const A = window.__acc; A.begin(); A.setSpawn(false); const g0 = A.mem().geo
    for (let k = 0; k < 40; k++) { for (let i = 0; i < 30; i++) A.spawn(['planet', 'star', 'neutron', 'pulsar', 'comet', 'rival'][i % 6], 1 + i); A.step(0.02); A.clearObjs(); A.step(0.02) }
    const g1 = A.mem().geo; A.setSpawn(true); return { g0, g1 } })
  ok('천체 1,200개 생성·해제 뒤 지오메트리가 늘지 않는다', leak.g1 <= leak.g0 + 25, `${leak.g0} → ${leak.g1}`)
  ok('no JS errors', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) { ok('harness', false, e.message) }
await browser.close()
const pass = results.filter(r => r[0]).length
console.log(`\n${pass}/${results.length} passed`)
process.exit(pass === results.length ? 0 : 1)
