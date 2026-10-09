// 소크 봇 — 실제 입력 경로로 여러 판을 실시간으로 돌리며 페이지 에러를 모은다(CrazyGames gameplay crash 3.2% 추적, 2026-10-09).
// 실기기에서 흔한 사건도 섞는다: 탭 숨김/복귀 · 회전(리사이즈) · WebGL 컨텍스트 소실/복구 · 진화 카드 선택 · 능력 키.
// 사용: node scripts/soak-bot.mjs [base=http://localhost:3041] [secondsPerProfile=180] [--events]
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/toss/package.json')
const { chromium } = require('playwright')

const BASE = process.argv[2] || 'http://localhost:3041'
const SECS = +(process.argv[3] || 180)
const EVENTS = process.argv.includes('--events')
const PROFILES = [
  { name: 'desktop', ctx: { viewport: { width: 1280, height: 720 } } },
  { name: 'phone-land', ctx: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: 'phone-port', ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
]
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })

async function run(p) {
  const ctx = await browser.newContext(p.ctx)
  const page = await ctx.newPage()
  const errs = new Map(), stats = { runs: 0, deaths: [], peaks: [], choices: 0, events: [] }
  const add = (k, v) => { const e = errs.get(k) || { n: 0, sample: v }; e.n++; errs.set(k, e) }
  page.on('pageerror', e => add('PAGEERR ' + e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) add('CONSOLE ' + m.text().slice(0, 160), '') })
  await page.goto(BASE + '/?dev=1', { waitUntil: 'load' })
  await page.waitForFunction(() => window.__acc, { timeout: 20000 })
  const t0 = Date.now()
  let lastEvent = Date.now(), wasAlive = false, ctxLoss = null
  while (Date.now() - t0 < SECS * 1000) {
    const st = await page.evaluate(() => {
      const A = window.__acc, s = A.state
      const ch = document.getElementById('choice')?.classList.contains('on')
      return { s, ch, info: s.alive ? A.objInfo().filter(o => !o.eaten) : [], pos: A.pos() }
    }).catch(e => ({ err: e.message }))
    if (st.err) { add('EVAL ' + st.err, ''); await sleep(500); continue }
    if (!st.s.alive) {
      if (wasAlive) { stats.deaths.push(st.s.t); stats.peaks.push(st.s.peak) }
      wasAlive = false; stats.runs++
      await page.evaluate(() => window.__acc.begin()); await sleep(300); continue
    }
    wasAlive = true
    if (st.ch) { await page.keyboard.press('Digit' + (1 + Math.floor(Math.random() * 3))); stats.choices++; continue }
    // 조종: 위협(못 먹는 라이벌) 가까우면 반대로, 아니면 가까운 먹이 중 큰 것
    const threats = st.info.filter(o => !o.edible && o.t === 'rival' && o.d < 40)
    let tx, tz
    if (threats.length) { const t = threats.sort((a, b) => a.d - b.d)[0]; tx = st.pos.x - (t.x - st.pos.x) * 3; tz = st.pos.z - (t.z - st.pos.z) * 3 }
    else { const food = st.info.filter(o => o.edible).sort((a, b) => (a.d / (1 + a.mass)) - (b.d / (1 + b.mass)))[0]
      if (food) { tx = food.x; tz = food.z } else { tx = st.pos.x + 50; tz = st.pos.z } }
    await page.evaluate(([x, z]) => window.__acc.setTarget(x, z), [tx, tz])
    const r = Math.random()
    if (r < 0.04) await page.keyboard.press('Space'); else if (r < 0.06) await page.keyboard.press('ShiftLeft'); else if (r < 0.07) await page.keyboard.press('KeyE'); else if (r < 0.08) await page.keyboard.press('KeyF')
    if (EVENTS && Date.now() - lastEvent > 15000) {
      lastEvent = Date.now(); const k = ['hide', 'resize', 'ctxloss'][Math.floor(Math.random() * 3)]; stats.events.push(k)
      if (k === 'hide') { await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }); await sleep(1500)
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }) }
      if (k === 'resize') { const v = page.viewportSize(); await page.setViewportSize({ width: v.height, height: v.width }); await sleep(1200); await page.setViewportSize(v) }
      if (k === 'ctxloss') { ctxLoss = await page.evaluate(async () => { const c = document.querySelector('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_lose_context'); if (!ext) return 'noext'
        ext.loseContext(); await new Promise(r => setTimeout(r, 1500)); ext.restoreContext(); await new Promise(r => setTimeout(r, 1500)); return gl.isContextLost() ? 'still-lost' : 'restored' }) }
    }
    await sleep(150)
  }
  const fps = await page.evaluate(() => window.__acc.state).catch(() => null)
  await ctx.close()
  return { profile: p.name, ...stats, ctxLoss, errors: [...errs.entries()].map(([k, v]) => ({ k, n: v.n, sample: v.sample })) }
}
const out = await Promise.all(PROFILES.map(run))
await browser.close()
for (const r of out) {
  console.log(`\n=== ${r.profile}: runs=${r.runs} deaths(t)=${r.deaths.map(x => Math.round(x)).join(',')} peaks=${r.peaks.map(x => Math.round(x)).join(',')} choices=${r.choices} events=${r.events.join(',')} ctxLoss=${r.ctxLoss}`)
  for (const e of r.errors) console.log(`  ✗ x${e.n} ${e.k}\n      ${e.sample}`)
  if (!r.errors.length) console.log('  ✓ 에러 0')
}
