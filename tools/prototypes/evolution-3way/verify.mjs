// 진화 3안 시안 검증 + 캡처. 실행: node tools/prototypes/evolution-3way/verify.mjs [baseURL]
// 서버: sh scripts/serve.sh (3040–3044 첫 빈 포트). headed Chromium = 실제 GPU(ANGLE Metal).
// SwiftShader 로 돌리려면 SWIFTSHADER=1.
import { createRequire } from 'module'
import { mkdirSync, statSync, readdirSync, unlinkSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url))
let chromium
for (const base of ['/Users/chodaehee/dev/keep-watching/package.json', '/Users/chodaehee/dev/nova-surge/toss/package.json', join(HERE, 'package.json')]) {
  try { chromium = createRequire(base)('playwright').chromium; break } catch (e) {}
}
if (!chromium) { console.error('playwright 를 찾지 못함'); process.exit(2) }
const BASE = (process.argv[2] || 'http://localhost:3040') + '/tools/prototypes/evolution-3way/'
const CAP = join(HERE, 'captures'); mkdirSync(CAP, { recursive: true })
const SW = !!process.env.SWIFTSHADER
const LAUNCH = SW ? { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
                  : { headless: false, args: ['--ignore-gpu-blocklist'] }
const MARKS = [['m1', 'protostar', 2.0], ['m2', 'ignition', 4.15], ['m3', 'star', 7.5], ['m4', 'collapse', 11.2], ['m5', 'blackhole', 14.5]]
const results = []; let fails = 0
const ok = (n, c, x = '') => { results.push([c, n, x]); if (!c) fails++; console.log(`${c ? '✓' : '✗'} ${n}${x ? '  ' + x : ''}`) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch(LAUNCH)

async function suite(label, ctxOpts, touch) {
  const ctx = await browser.newContext(ctxOpts)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message))
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()) })
  p.on('requestfailed', r => errs.push('REQFAIL ' + r.url()))
  p.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()) })
  await p.goto(BASE, { waitUntil: 'load' })
  await p.waitForFunction(() => window.__proto && __proto.views().every(v => v.renderedT >= 0))
  const gpu = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?' })
  ok(`[${label}] 로드 · GPU`, true, gpu)
  const title = await p.title(), badge = await p.textContent('#badge')
  ok(`[${label}] 라벨 「로컬 엔진 시안 · Meta 생성 아님」(제목·배지)`, title.includes('로컬 엔진 시안 · Meta 생성 아님') && badge.includes('로컬 엔진 시안 · Meta 생성 아님'))
  const tap = async sel => touch ? p.tap(sel) : p.click(sel)

  // 1) 재생/일시정지
  const t0 = await p.evaluate(() => __proto.t); await sleep(600); const t1 = await p.evaluate(() => __proto.t)
  ok(`[${label}] 자동 재생 중 시간 진행`, t1 > t0 + 0.3, `${t0.toFixed(2)}→${t1.toFixed(2)}`)
  await tap('#play'); const tp = await p.evaluate(() => __proto.t); await sleep(500); const tp2 = await p.evaluate(() => __proto.t)
  ok(`[${label}] 일시정지 → 시간 정지`, tp === tp2 && !(await p.evaluate(() => __proto.playing)), `${tp.toFixed(3)}=${tp2.toFixed(3)}`)
  await tap('#play'); await sleep(300); ok(`[${label}] 다시 재생`, await p.evaluate(() => __proto.playing))
  // 2) 처음부터
  await p.evaluate(() => __proto.setT(10)); await tap('#restart'); await sleep(50)
  const tr = await p.evaluate(() => __proto.t)
  ok(`[${label}] 처음부터`, tr < 0.4 && await p.evaluate(() => __proto.playing), `t=${tr.toFixed(2)}`)
  // 3) 스크럽(타임라인 50% 지점 클릭/탭)
  await tap('#play')
  const bb = await p.locator('#scrub').boundingBox()
  if (touch) await p.touchscreen.tap(bb.x + bb.width * 0.5, bb.y + bb.height / 2); else await p.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height / 2)
  await sleep(80)
  const ts = await p.evaluate(() => __proto.t)
  ok(`[${label}] 스크럽(50% 지점)`, Math.abs(ts - 9) < 0.8, `t=${ts.toFixed(2)}`)
  // 4) 단계 마커
  await tap('#marks button:nth-child(4)'); await sleep(60)
  const tm = await p.evaluate(() => __proto.t)
  ok(`[${label}] 마커 「붕괴」 점프`, Math.abs(tm - 11.2) < 0.01, `t=${tm}`)
  // 5) 안 전환 + 3안 동시
  for (const m of ['A', 'B', 'C', 'ALL']) {
    await tap(`[data-mode="${m}"]`); await sleep(120)
    const vis = (await p.evaluate(() => __proto.views())).filter(v => v.visible).map(v => v.id).join('')
    ok(`[${label}] 보기 전환 ${m}`, vis === (m === 'ALL' ? 'ABC' : m), vis)
  }
  // 6) 세 뷰 비어 있지 않음(픽셀) — 마커 5곳
  for (const [, nm, t] of MARKS) {
    await p.evaluate(t => __proto.setT(t), t)
    const pr = await p.evaluate(() => __proto.probe())
    ok(`[${label}] 픽셀 비어있지 않음 @${nm}`, pr.length === 3 && pr.every(v => v.std > 4 && v.mean > 2), pr.map(v => `${v.id}:μ${v.mean}/σ${v.std}`).join(' '))
  }
  // 7) 동기화 — 재생 중 같은 프레임의 렌더 시각 비교(훅 + DOM 타임스탬프)
  await p.evaluate(() => { __proto.setT(0); __proto.play() })
  let syncBad = 0, samples = 0, spread = 0
  for (let i = 0; i < 20; i++) {
    await sleep(140)
    const s = await p.evaluate(() => ({ v: __proto.views(), dom: [...document.querySelectorAll('.vov .tstamp')].map(e => e.textContent) }))
    const ts2 = s.v.map(v => v.renderedT), fr = s.v.map(v => v.frame)
    spread = Math.max(spread, Math.max(...ts2) - Math.min(...ts2))
    if (new Set(ts2).size !== 1 || new Set(fr).size !== 1 || new Set(s.dom).size !== 1) syncBad++
    samples++
  }
  ok(`[${label}] 3뷰 타임라인 동기(재생 중 ${samples}회 표본)`, syncBad === 0, `최대 차이 ${spread}s · 불일치 ${syncBad}`)
  // 8) 속도 0.5×/1×
  const rate = async sp => {
    await tap(`[data-speed="${sp}"]`); await p.evaluate(() => { __proto.setT(1); __proto.play() })
    const a = await p.evaluate(() => [__proto.t, performance.now()]); await sleep(1500)
    const b = await p.evaluate(() => [__proto.t, performance.now()])
    return (b[0] - a[0]) / ((b[1] - a[1]) / 1000)
  }
  const r1 = await rate(1), r05 = await rate(0.5)
  ok(`[${label}] 속도 0.5× / 1×`, Math.abs(r1 - 1) < 0.1 && Math.abs(r05 - 0.5) < 0.06, `1×→${r1.toFixed(3)} · 0.5×→${r05.toFixed(3)}`)
  await tap('[data-speed="1"]')
  // 9) 프레임레이트(3안 동시)
  await p.evaluate(() => { __proto.setT(9); __proto.play() }); await sleep(2600)
  const fps = await p.evaluate(() => __proto.fps)
  ok(`[${label}] 3안 동시 fps`, SW ? fps > 5 : fps >= 55, fps.toFixed(1))
  // 10) 가로 넘침 없음
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ok(`[${label}] 가로 스크롤 없음`, ov <= 0, `${ov}px`)
  ok(`[${label}] 콘솔/JS 에러 0`, errs.length === 0, errs.slice(0, 3).join(' | '))
  return { ctx, p, errs }
}

async function shots(p, prefix, single) {
  await p.evaluate(() => __proto.pause())
  if (single) {
    await p.evaluate(() => __proto.notes(false))
    for (const v of ['A', 'B', 'C']) {
      await p.evaluate(m => __proto.setMode(m), v)
      for (const [mk, nm, t] of MARKS) {
        await p.evaluate(t => __proto.setT(t), t); await sleep(90)
        await p.screenshot({ path: join(CAP, `${prefix}${v}_${mk}_${nm}.jpg`), type: 'jpeg', quality: 80 })
      }
    }
    await p.evaluate(() => __proto.notes(true))
  }
  await p.evaluate(() => __proto.setMode('ALL'))
  for (const [mk, nm, t] of MARKS) {
    await p.evaluate(t => __proto.setT(t), t); await sleep(90)
    await p.screenshot({ path: join(CAP, `${prefix}ALL_${mk}_${nm}.jpg`), type: 'jpeg', quality: 80 })
  }
}

// ── 데스크톱 1440×900 ──
for (const f of readdirSync(CAP)) if (/\.(jpg|png|mp4|webm)$/.test(f)) unlinkSync(join(CAP, f))
rmSync(join(CAP, '_vid'), { recursive: true, force: true })
{ const { ctx, p } = await suite('desktop 1440×900', { viewport: { width: 1440, height: 900 } }, false)
  await shots(p, 'desktop_', true); await ctx.close() }
// ── 폰 가로 844×390 (터치) ──
{ const { ctx, p } = await suite('phone 844×390 touch', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true)
  await shots(p, 'phone_', false)
  await p.evaluate(() => { __proto.setMode('C'); __proto.setT(11.2) }); await sleep(90)
  await p.screenshot({ path: join(CAP, 'phone_C_m4_collapse.jpg'), type: 'jpeg', quality: 80 })
  await ctx.close() }
// ── 영상: 3안 동시, 1× 전체 18초 ──
{ const vdir = join(CAP, '_vid'); mkdirSync(vdir, { recursive: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: vdir, size: { width: 1280, height: 800 } } })
  const p = await ctx.newPage(); const t0 = Date.now()
  await p.goto(BASE + '?paused=1'); await p.waitForFunction(() => window.__proto && __proto.views().every(v => v.renderedT >= 0))
  await sleep(400); const start = (Date.now() - t0) / 1000
  await p.evaluate(() => { __proto.setT(0); __proto.play() }); await sleep(18600)
  const vpath = await p.video().path(); await ctx.close()
  const out = join(CAP, 'side_by_side_3way.mp4')
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(start), '-i', vpath, '-t', '18.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '27', '-preset', 'slow', '-r', '30', '-movflags', '+faststart', out])
  unlinkSync(vpath); rmSync(vdir, { recursive: true, force: true }); ok('영상 저장', statSync(out).size > 100000, `${(statSync(out).size / 1e6).toFixed(2)}MB`) }
await browser.close()
let total = 0; for (const f of readdirSync(CAP)) { try { total += statSync(join(CAP, f)).size } catch (e) {} }
console.log(`\n캡처 ${readdirSync(CAP).filter(f => /\.(jpg|mp4)$/.test(f)).length}개 · 합계 ${(total / 1e6).toFixed(2)}MB · ${SW ? 'SwiftShader' : 'headed GPU'}`)
console.log(fails ? `✗ 실패 ${fails}건` : '✓ 전부 통과')
process.exit(fails ? 1 : 0)
