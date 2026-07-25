// Daily challenge verification (P#3) — modifiers, daily board scoping, day/global separation.
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
  await page.waitForFunction(() => window.__acc && window.__acc.todayMod, { timeout:15000 })
  ok('boot: daily hooks present', true)

  // today's modifier is deterministic + dayKey format
  const t = await page.evaluate(() => ({ a: window.__acc.todayMod(), b: window.__acc.todayMod(), day: window.__acc.dayKey() }))
  ok('todayMod deterministic', t.a.id===t.b.id, t.a.id)
  ok('dayKey is YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(t.day), t.day)

  // each modifier actually applies its gameplay effect
  const modFx = await page.evaluate(() => {
    const A = window.__acc, out = {}
    A.forceDaily('SWARM');      out.swarm  = A.mods().density
    A.forceDaily('DARK_FOREST');out.forest = A.mods().rivals
    A.forceDaily('FAMINE');     out.famine = A.mods().evap
    A.forceDaily('HUNTED');     out.hunted = A.mods().hunted
    A.forceDaily('FRENZY');     out.frenzy = A.mods().frenzy
    A.setDaily(false); A.begin(); out.normal = A.mods()
    return out
  })
  ok('SWARM → density 1.5', modFx.swarm===1.5, `${modFx.swarm}`)
  ok('DARK FOREST → rivals >1', modFx.forest>1.3, `${modFx.forest}`)
  ok('FAMINE → evap 1.7', modFx.famine===1.7, `${modFx.famine}`)
  ok('HUNTED → hunted flag', modFx.hunted===true)
  ok('FRENZY → frenzy flag', modFx.frenzy===true)
  ok('normal run resets all mods', modFx.normal.density===1 && modFx.normal.rivals===1 && modFx.normal.evap===1 && !modFx.normal.hunted && !modFx.normal.frenzy, JSON.stringify(modFx.normal))

  // HUNTED spawns the apex from the start (tier 0)
  const huntedApex = await page.evaluate(() => { const A=window.__acc; A.forceDaily('HUNTED'); A.setMass(2); A.step(0.3); return A.nemesis() })
  ok('HUNTED: apex hunts from stellar tier', huntedApex!==null, JSON.stringify(huntedApex))

  // daily submit lands on the DAILY board, and is scoped out of the GLOBAL board
  await page.evaluate(() => window.__acc.setName('DAILY_QA'))
  const sub = await page.evaluate(() => window.__acc.submitDaily(4242, 9, 'INTERMEDIATE', 55))
  ok('daily submit ok + rank', !!(sub && sub.ok && sub.rank>=1), JSON.stringify(sub))
  await sleep(700)
  const boards = await page.evaluate(async () => {
    const A = window.__acc
    const daily = await A.topDaily(100)
    const global = await A.LB.top(100)
    return { inDaily: daily.some(r=>r.name==='DAILY_QA'), inGlobal: global.some(r=>r.name==='DAILY_QA'), dailyMod: (daily.find(r=>r.name==='DAILY_QA')||{}).modifier }
  })
  ok('daily run appears on DAILY board', boards.inDaily===true)
  ok('daily run NOT on GLOBAL board (scoped)', boards.inGlobal===false)
  ok('daily run carries its modifier tag', !!boards.dailyMod, boards.dailyMod)

  // regression: normal growth still works
  const grew = await page.evaluate(async () => { const A=window.__acc; A.setDaily(false); A.begin(); const m0=A.state.mass; for(let k=0;k<12;k++){A.eatNearest();A.step(0.4)} return {m0,m1:A.state.mass} })
  ok('regression: growth intact', grew.m1>grew.m0, `${grew.m0} → ${grew.m1}`)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
