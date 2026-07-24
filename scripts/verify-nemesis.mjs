// Nemesis (apex predator) + climax verification (P#2 goals/climax).
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const URL = 'http://localhost:3040/?dev=1'
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }

const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: '+m.text()) })

try {
  await page.goto(URL, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForFunction(() => window.__acc && window.__acc.nemesis, { timeout:15000 })
  ok('boot: nemesis hooks present', true)

  // no nemesis below INTERMEDIATE (stellar-mass)
  const low = await page.evaluate(() => { const A=window.__acc; A.begin(); A.setMass(3); A.step(0.2); return A.nemesis() })
  ok('no apex in early game (stellar)', low===null)

  // reaching INTERMEDIATE spawns the apex, bigger than you (hunting)
  const spawned = await page.evaluate(() => { const A=window.__acc; A.begin(); A.setMass(12); A.step(0.3); return A.nemesis() })
  ok('apex spawns at INTERMEDIATE', spawned!==null, JSON.stringify(spawned))
  ok('apex is bigger than you (hunts)', spawned && spawned.mass>12 && spawned.vuln===false, spawned&&`mass=${spawned.mass} vuln=${spawned.vuln}`)

  // it hunts — distance closes when you hold still
  const hunt = await page.evaluate(() => { const A=window.__acc; const d0=A.nemesis().dist; for(let i=0;i<8;i++){A.setMass(12);A.step(0.2)} return { d0, d1:A.nemesis().dist } })
  ok('apex hunts (closes distance)', hunt.d1 < hunt.d0, `${hunt.d0} → ${hunt.d1}`)

  // outgrowing it (mass spike) flips it to VULNERABLE (its mass lags)
  const vuln = await page.evaluate(() => { const A=window.__acc; A.setMass(40); A.step(0.1); return A.nemesis() })
  ok('mass spike → apex VULNERABLE (lag)', vuln && vuln.vuln===true, JSON.stringify(vuln))

  // consuming it = climax: score+, apexKill+, QUASAR discovered, then a bigger one rises
  const climax = await page.evaluate(() => {
    const A=window.__acc; A.resetCodex()
    const before=A.state.score, k0=A.apexKills()
    const ate=A.eatNemesis()
    const after=A.state.score, k1=A.apexKills(), gone=A.nemesis()
    const quasar=A.codex().seen.includes('quasar')
    // step past the respawn delay → a new (bigger) apex rises
    for(let i=0;i<20;i++){A.setMass(40);A.step(0.2)}
    return { ate, gain:after-before, k0, k1, goneRightAfter:gone, quasar, respawned:A.nemesis() }
  })
  ok('consume apex → apexKill++', climax.ate===true && climax.k1===climax.k0+1, `k ${climax.k0}→${climax.k1}`)
  ok('consume apex → big score bonus', climax.gain>0, `+${climax.gain}`)
  ok('consume apex → QUASAR codex discovered', climax.quasar===true)
  ok('a bigger apex rises after delay', climax.respawned!==null, JSON.stringify(climax.respawned))

  // apex can kill you (threat) — hold still tiny while a big apex closes
  const death = await page.evaluate(() => {
    const A=window.__acc; A.begin(); A.setMass(12); A.step(0.3)
    for(let i=0;i<60 && A.state.alive;i++){ A.setMass(12); A.step(0.2) } // it eventually catches a stationary hole
    return { alive:A.state.alive }
  })
  ok('apex is lethal if you sit still', death.alive===false)

  // regression: reset clears nemesis
  const reset = await page.evaluate(() => { const A=window.__acc; A.begin(); return A.nemesis() })
  ok('begin() clears nemesis', reset===null)

  ok('no JS/console errors', errors.length===0, errors.slice(0,3).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
