// Main menu (cinematic hero) verification — HUD gating, hero layout, stat strip.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const URL = 'http://localhost:3040/?dev=1'
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }
const sleep = ms => new Promise(r=>setTimeout(r,ms))

const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] })
const errors = []
// opacity는 0.35s 트랜지션이라 즉시 읽으면 중간값 → 목표치에 수렴할 때까지 폴링
const hudOpacity = p => p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('hud')).opacity))
async function hudSettles(p, want) {
  for (let i=0;i<25;i++){ const o=await hudOpacity(p); if (want ? o>0.95 : o<0.05) return true; await sleep(60) }
  return false
}

try {
  // ── wide desktop: hero layout ──
  const page = await browser.newPage({ viewport:{width:1600,height:900} })
  page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: '+m.text()) })
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.state, { timeout:15000 })
  ok('boot', true)

  // HUD hidden on menu (the leak the owner spotted)
  ok('menu: HUD hidden', await hudSettles(page,false))
  ok('menu: body has no .playing', (await page.evaluate(() => document.body.classList.contains('playing')))===false)

  // stat strip present + populated
  await page.evaluate(() => { const A=window.__acc; A.resetCodex(); ['rock','planet','star'].forEach(t=>A.discover(t))
    try{localStorage.setItem('acc_best','12345');localStorage.setItem('acc_rank','7')}catch(e){} })
  await page.reload({ waitUntil:'networkidle' })
  await page.waitForFunction(() => window.__acc && window.__acc.state, { timeout:15000 })
  const strip = await page.evaluate(() => ({
    play: !!document.getElementById('startBtn'),
    codex: document.getElementById('chipCodex').textContent,
    best: document.getElementById('chipBest').textContent,
    rank: document.getElementById('chipRank').textContent,
    ribbon: document.getElementById('ribbonTxt').textContent,
  }))
  ok('menu: PLAY button present', strip.play===true)
  ok('chip shows codex progress', /^3\/33$/.test(strip.codex), strip.codex)
  ok('chip shows personal best', strip.best==='12.3K', strip.best)
  ok('chip shows global rank', strip.rank==='#7', strip.rank)
  ok('ribbon shows today\'s modifier', strip.ribbon.length>6, strip.ribbon)

  // hero: black hole pushed right (camera offset) and clear of the UI column
  await sleep(2200)
  const heroPos = await page.evaluate(() => window.__acc.holeScreen ? window.__acc.holeScreen() : null)
  if (heroPos) ok('hero: hole sits in the upper area', heroPos.y<0.46, `y=${heroPos.y.toFixed(2)}`)

  // playing: HUD returns
  // 3.8.2부터 인트로 카드가 뜨는 동안 게임이 멈추고 HUD도 숨는다(모달).
  // 실제 플레이 흐름대로 카드를 닫은 뒤 HUD를 확인한다.
  await page.evaluate(() => { window.__acc.begin(); window.__acc.hideOnboard() })
  await sleep(250)
  ok('playing: HUD visible', await hudSettles(page,true))
  ok('playing: body has .playing', (await page.evaluate(() => document.body.classList.contains('playing')))===true)

  // game over: HUD hides again + best updates
  await page.evaluate(() => { window.__acc.setScore(99999); window.__acc.gameOver() })
  await sleep(300)
  ok('gameover: HUD hidden again', await hudSettles(page,false))
  ok('gameover: personal best updated', (await page.evaluate(() => window.__acc.bestScore()))===99999)
  await page.close()

  // ── narrow: falls back to centered layout, strip hidden (no overlap with the hole) ──
  const narrow = await browser.newPage({ viewport:{width:760,height:900} })
  narrow.on('pageerror', e => errors.push('PAGEERR(narrow): '+e.message))
  await narrow.goto(URL, { waitUntil:'networkidle' })
  await narrow.waitForFunction(() => window.__acc && window.__acc.state, { timeout:15000 })
  const n = await narrow.evaluate(() => {
    const r=document.querySelector('#start .col').getBoundingClientRect()
    return { align: getComputedStyle(document.getElementById('start')).alignItems, fits: r.top>=-1 && r.bottom<=innerHeight+1 }
  })
  ok('narrow: centered layout', n.align==='center', n.align)
  ok('narrow: menu fits viewport', n.fits===true)
  await narrow.close()

  // ── mobile landscape: nothing overflows the viewport ──
  const mob = await browser.newPage({ viewport:{width:844,height:390}, isMobile:true, hasTouch:true })
  mob.on('pageerror', e => errors.push('PAGEERR(mobile): '+e.message))
  await mob.goto(URL, { waitUntil:'networkidle' })
  await mob.waitForFunction(() => window.__acc && window.__acc.state, { timeout:15000 })
  const fits = await mob.evaluate(() => { const r=document.querySelector('#start .col').getBoundingClientRect(); return r.top>=-1 && r.bottom<=innerHeight+1 })
  ok('mobile landscape: menu fits viewport', fits===true)
  await mob.close()

  // 우주 자(격자)는 게임플레이 전용이다. 히어로 구도는 카메라가 격자 평면 높이에 놓여
  // 지평선(가로선)·시선축 격자선(세로선)이 '십자 아티팩트'로 보였다(오너 리포트).
  {
    const g = await browser.newPage()
    await g.goto(URL, { waitUntil:'networkidle' })
    await g.waitForFunction(() => window.__acc && window.__acc.gridState, { timeout:15000 })
    await g.waitForTimeout(1200)
    const menu = await g.evaluate(() => window.__acc.gridState())
    ok('메뉴: 격자 비가시(십자 아티팩트 없음)', menu.vis===false && menu.op<0.01, JSON.stringify(menu))
    await g.evaluate(() => { window.__acc.begin(); window.__acc.hideOnboard() })
    // SwiftShader는 게임시간이 0.3배로 흘러 페이드가 늦다 — 벽시계 대기 대신 수렴을 기다린다
    await g.waitForFunction(() => window.__acc.gridState().op > 0.3, { timeout:20000 }).catch(()=>{})
    const play = await g.evaluate(() => window.__acc.gridState())
    ok('플레이: 격자 복귀(성장 기준자 유지)', play.vis===true && play.op>0.3, JSON.stringify(play))
    await g.close()
  }

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
