// 제출 zip 스모크 — 임시 폴더에 풀고, 3040–3044 중 빈 포트로 띄워, 실제 부팅·플레이를 확인한다.
// 계약: zip 루트에 index.html · 404 0건 · 콘솔 에러 0건 · 외부 요청 0건 · 치트 훅 없음 · Pages 메타 없음.
import { createRequire } from 'module'
import { execFileSync, spawn } from 'child_process'
import fs from 'fs'; import os from 'os'; import path from 'path'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const ZIP = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../dist/accretion-submission.zip')
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }
const sleep = ms => new Promise(r=>setTimeout(r,ms))
// serve.sh 와 같은 판정(lsof LISTEN) — bind 시험은 *:포트 로 떠 있는 서버를 못 본다(macOS 실측: 3040 점유 중에도 127.0.0.1 bind 성공)
const free = async p => { try { execFileSync('lsof', ['-iTCP:'+p, '-sTCP:LISTEN', '-t'], { stdio:'pipe' }); return false } catch { return true } }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-zip-'))
let srv = null, browser = null
try {
  ok('zip exists', fs.existsSync(ZIP), ZIP)
  const list = execFileSync('unzip', ['-Z1', ZIP]).toString().trim().split('\n')
  ok('zip root holds index.html (+ three.min.js), no folders', list.includes('index.html') && list.includes('three.min.js') && list.every(f=>!f.includes('/')), list.join(', '))
  execFileSync('unzip', ['-q', ZIP, '-d', dir])
  const html = fs.readFileSync(path.join(dir,'index.html'),'utf8')
  ok('portal build has no GitHub Pages meta (canonical/og/twitter)', !/rel="canonical"|property="og:|name="twitter:/.test(html))
  ok('only relative asset paths', /<script src="three\.min\.js">/.test(html) && !/src="\/|src="https?:\/\/[^"]*three/.test(html))
  let port = 0; for (let p=3040;p<=3044;p++) if (await free(p)) { port=p; break }   // 점유된 포트는 건드리지 않는다
  ok('found a free port in 3040–3044', port>0, String(port))
  srv = spawn('python3', ['-m','http.server',String(port),'--bind','127.0.0.1','--directory',dir], { stdio:'ignore' })
  for (let i=0;i<40 && await free(port);i++) await sleep(100)

  browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'] })
  const page = await browser.newPage({ viewport:{ width:1280, height:720 } })
  const errors=[], bad=[], ext=[]
  page.on('pageerror', e => errors.push('PAGEERR: '+e.message))
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()) })
  page.on('response', r => { if (r.status()>=400) bad.push(r.status()+' '+r.url()) })
  page.on('request', r => { const u=r.url(); if (!u.startsWith(`http://localhost:${port}/`) && !/^(data|blob):/.test(u)) ext.push(u) })
  const t0 = Date.now()
  await page.goto(`http://localhost:${port}/`, { waitUntil:'load', timeout:30000 })
  await page.waitForSelector('#startBtn', { state:'visible', timeout:15000 })
  ok('boots to the title screen', true, `${Date.now()-t0} ms`)
  await page.click('#startBtn'); await sleep(600)
  await page.keyboard.press('KeyD')
  for (let i=0;i<20;i++){ const k=['KeyW','KeyD','KeyS','KeyA'][i%4]; await page.keyboard.down(k); await sleep(150); await page.keyboard.up(k) }
  ok('run in progress (HUD live)', await page.evaluate(() => document.body.classList.contains('playing')))
  ok('no cheat hooks in the shipped build', await page.evaluate(() => typeof window.__acc==='undefined'))
  ok('0 × 404 / HTTP errors', bad.length===0, bad.slice(0,3).join(' | '))
  ok('0 console errors', errors.length===0, errors.slice(0,3).join(' | '))
  ok('0 external requests', ext.length===0, ext.slice(0,3).join(' | '))
} catch (e) { console.error('FATAL', e); results.push([false,'fatal',String(e)]) }
finally {
  if (browser) await browser.close()
  if (srv) srv.kill()
  fs.rmSync(dir, { recursive:true, force:true })
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
