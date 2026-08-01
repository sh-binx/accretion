// 언어 감사 — 포털(CrazyGames·Poki) 요건은 '영어로 플레이 가능할 것'이다.
// 영어 모드에서 화면에 한글이 한 글자라도 남으면 제출에서 문제가 된다. 그걸 자동으로 막는다.
import { createRequire } from 'module'
const require = createRequire('/Users/chodaehee/dev/nova-surge/package.json')
const { chromium } = require('playwright')
const results = []
const ok = (n,c,x='') => { results.push([c,n,x]); console.log(`${c?'✓':'✗'} ${n}${x?'  '+x:''}`) }
const HAN = /[가-힣ㄱ-ㅎㅏ-ㅣ]/

const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })
const errors = []

// 화면에 실제로 들어가는 모든 텍스트를 긁는다 — 숨은 패널·동적 카드까지 열어서
async function sweep(page){
  return page.evaluate(async () => {
    const A=window.__acc
    A.choiceReal(true); A.begin(); A.hideOnboard()
    A.setMass(A.tierMass(1)); A.step(0.2)          // 진화 선택 카드
    const seen=[]
    const SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1,TEMPLATE:1}   // 소스 코드는 화면이 아니다(주석은 한글로 남는다)
    const grab=()=>{ for(const e of document.querySelectorAll('body *')){
      if(SKIP[e.tagName]) continue
      if(e.children.length) continue                // 잎 노드만 — 중복 제거
      const t=(e.textContent||'').trim()
      if(t) seen.push({t, id:e.id||e.className||e.tagName}) } }
    grab()
    A.takeBoon(0)                                   // 배너(보온 이름·요약)
    A.step(0.1); grab()
    A.forceUI('c'); await new Promise(r=>setTimeout(r,300)); grab()   // 코덱스
    A.forceUI('b'); await new Promise(r=>setTimeout(r,300)); grab()   // 배너
    A.gameOver(); await new Promise(r=>setTimeout(r,500)); grab()     // 결과 화면
    return seen
  })
}

try {
  // ── 영어 브라우저(기본) ──
  {
    const p = await browser.newPage({ locale:'en-US' })
    p.on('pageerror', e => errors.push('PAGEERR: '+e.message))
    await p.goto('http://localhost:3040/?dev=1', { waitUntil:'networkidle', timeout:30000 })
    await p.waitForFunction(() => window.__acc && window.__acc.lang, { timeout:15000 })
    ok('en browser defaults to English', await p.evaluate(()=>window.__acc.lang())==='en')
    const seen = await sweep(p)
    const bad = seen.filter(x=>HAN.test(x.t))
    ok('no Korean anywhere in English mode', bad.length===0,
       bad.length ? bad.slice(0,3).map(b=>`${b.id}: ${b.t.slice(0,40)}`).join(' | ') : `${seen.length}개 텍스트 검사`)
    await p.close()
  }
  // ── 한국어 브라우저 ──
  {
    const p = await browser.newPage({ locale:'ko-KR' })
    p.on('pageerror', e => errors.push('PAGEERR: '+e.message))
    await p.goto('http://localhost:3040/?dev=1', { waitUntil:'networkidle', timeout:30000 })
    await p.waitForFunction(() => window.__acc && window.__acc.lang, { timeout:15000 })
    ok('ko browser defaults to Korean', await p.evaluate(()=>window.__acc.lang())==='ko')
    const seen = await sweep(p)
    ok('Korean is still there for Korean players', seen.some(x=>HAN.test(x.t)),
       `한글 ${seen.filter(x=>HAN.test(x.t)).length}건`)
    await p.close()
  }
  // ── ?lang= 강제 · 토글 · 저장 ──
  {
    const p = await browser.newPage({ locale:'ko-KR' })
    p.on('pageerror', e => errors.push('PAGEERR: '+e.message))
    await p.goto('http://localhost:3040/?dev=1&lang=en', { waitUntil:'networkidle', timeout:30000 })
    await p.waitForFunction(() => window.__acc && window.__acc.lang, { timeout:15000 })
    ok('?lang=en overrides a Korean browser', await p.evaluate(()=>window.__acc.lang())==='en')
    const t = await p.evaluate(() => {
      const b=document.getElementById('startLang'), before=b.textContent
      b.click(); const after=b.textContent
      return { before, after, lang:window.__acc.lang(),
               stored:localStorage.getItem('acc_lang'), visible:!!b.offsetParent }
    })
    ok('menu toggle flips the language and its label', t.lang==='ko'&&t.before!==t.after, `${t.before} → ${t.after}`)
    ok('choice persists to localStorage', t.stored==='ko', String(t.stored))
    ok('toggle is reachable on the start screen', t.visible===true, String(t.visible))
    await p.close()
  }
  // ── 번역 누락이 없는가(데이터 차원) ──
  {
    const p = await browser.newPage({ locale:'en-US' })
    await p.goto('http://localhost:3040/?dev=1', { waitUntil:'networkidle', timeout:30000 })
    await p.waitForFunction(() => window.__acc && window.__acc.boonPool, { timeout:15000 })
    const pool = await p.evaluate(()=>window.__acc.boonPool())
    const miss = pool.filter(b=>!(b.sum&&b.sum.en&&b.sum.ko&&b.w&&b.w.en&&b.w.ko))
    ok('every boon has both languages', pool.length===6&&miss.length===0,
       miss.map(b=>b.id).join(',')||`${pool.length}종 × (요약+근거) × 2언어`)
    const hanInEn = pool.filter(b=>HAN.test(b.sum.en)||HAN.test(b.w.en))
    ok('English strings contain no Korean', hanInEn.length===0, hanInEn.map(b=>b.id).join(',')||'없음')
    await p.close()
  }
  ok('no JS errors', errors.length===0, errors.slice(0,2).join(' | '))
} catch (e) {
  console.error('FATAL', e); results.push([false,'fatal',String(e)])
} finally {
  await browser.close()
}
const passed = results.filter(r=>r[0]).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed===results.length ? 0 : 1)
