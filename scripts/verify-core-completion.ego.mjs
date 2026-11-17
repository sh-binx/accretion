// 개발 준비 시험. 실행 시 현재 Ego 공간 번호와 절대 증거 폴더를 먼저 선언한다. 로컬 포트 기본값은 3040이다.
// { printf 'const spaceId = 1234, output = "/absolute/artifacts";\n'; cat scripts/verify-core-completion.ego.mjs; } | ego-browser nodejs
const {strict: assert} = await import('node:assert');
const {mkdir} = await import('node:fs/promises');
const task = await taskSpace(spaceId);
const page = task.page('p1');
const port = typeof testPort === 'number' ? testPort : 3040;
await mkdir(output, {recursive: true});

async function resize(width, height, mobile) {
  await page.cdp('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
}

async function prepare({lang, width, height, touch, mass = 40000}) {
  await resize(width, height, touch);
  await page.cdp('Emulation.setTouchEmulationEnabled', {enabled: touch, maxTouchPoints: touch ? 2 : 1});
  await page.goto('http://127.0.0.1:' + port + '/?dev=1&lang=' + lang + '&qa=' + Date.now());
  await page.waitForFunction(() => !!window.__acc);
  await page.evaluate(()=>{localStorage.removeItem('acc_up')});
  await page.cdp('Runtime.enable');
  await page.click('#startBtn', {label: '시험 런 시작'});
  return page.evaluate(m => {
    __acc.hideOnboard();
    for (const object of objects.slice()) releaseObj(object);
    __acc.setSpawn(false);
    __acc.setMass(m);
    __acc.choiceReal(true);
    __acc.giveBoon('spin');
    __acc.setCombo(5, 80);
    applyForm(2);
    Object.assign(S, {formIdx: 2, tierIdx: 2, markIdx: 5, t: 67, score: 1234, energy: 0.31});
    nemPending = 100;
    hole.position.copy(galCore.position);
    return {mass: S.mass, best: STATS.best};
  }, mass);
}

async function resultRun(config) {
  const before = await prepare(config);
  await page.waitForFunction(() => coreEaten && choiceOpen);
  const reward = await page.evaluate(() => ({
    mass: S.mass, score: S.score, result: !!document.querySelector('#coreResult:not(.off)'),
  }));
  assert(Math.abs(reward.mass - (before.mass + 1935000)) < 1, '핵 질량 보상은 한 번 지급한다');
  assert.equal(reward.score, 2175234, '퀘이사 승격과 핵 보상을 한 번씩 지급한다');
  assert(!reward.result, '이미 열린 진화 선택을 먼저 보여준다');
  await page.screenshot({path: output + '/' + config.lang + '-choice-first.png'});
  await page.keyboard.press('Digit1');
  await page.waitForFunction((lang) => choiceOpen && $('choiceSub').textContent.includes(lang === 'en' ? 'ULTRAMASSIVE' : '극대질량'), config.lang);
  await page.click('#choiceWrap button:first-child', {label: '극대질량 진화 선택'});
  try {
    await page.waitForFunction(() => !!document.querySelector('#coreResult:not(.off)'), undefined, {timeout: 4000});
  } catch (error) {
    await page.screenshot({path: output + '/missing-result.png'});
    console.log(await page.evaluate(() => ({coreEaten, choiceOpen, mass: S.mass, score: S.score, alive: S.alive})));
    assert.fail('핵을 흡수하고 진화를 골랐지만 성공 결과가 열리지 않았다');
  }
  await page.screenshot({path: output + '/' + config.lang + '-result.png'});
  const shown = await page.evaluate(() => ({
    t: S.t, mass: S.mass, peak: S.peak, score: S.score, combo: S.combo, energy: S.energy,
    x: hole.position.x, z: hole.position.z, tier: S.tierIdx, alive: S.alive,
    boons: S.boons.map(b => L(b.n)), listed: [...$('coreResultBoons').children].map(b => b.textContent),
    values: [...$('coreResultStat').querySelectorAll('dd')].map(el => el.textContent),
    labels: [...$('coreResultStat').querySelectorAll('dt')].map(el => el.textContent),
    title: $('coreResultTitle').textContent, focus: document.activeElement.id,
    pause: PAUSE.result, choice: choiceOpen, gameplay: gpActive, view: [innerWidth, innerHeight],
    buttons: [...$('coreResult').querySelectorAll('button')].map(button => {
      const r = button.getBoundingClientRect();
      return {size: [r.width, r.height], visible: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth};
    }),
  }));
  assert.deepEqual(shown.view, [config.width, config.height], '시험 뷰포트');
  assert.equal(shown.title, config.lang === 'en' ? 'Galactic core consumed' : '은하 중심 흡수 완료');
  assert.deepEqual(shown.labels, config.lang === 'en' ? ['Time', 'Peak mass', 'Score'] : ['시간', '최고 질량', '점수']);
  assert.equal(shown.t.toFixed(1), '67.0');
  assert.equal(shown.score, 4150234, '흡수·두 진화·왜소은하 도달 점수를 한 번씩 집계한다');
  assert.equal(shown.peak, shown.mass);
  assert.deepEqual(shown.values, [config.lang === 'en' ? '67.0s' : '67.0초', '1.97M M☉', '4,150,234']);
  assert.equal(shown.boons.length, 3, '기존 진화와 겹쳐 열린 두 선택을 보존한다');
  assert.deepEqual(shown.listed, shown.boons);
  assert(shown.alive && shown.pause && !shown.choice && !shown.gameplay);
  assert.equal(shown.focus, 'coreResultTitle');
  assert(shown.buttons.every(button => button.visible && button.size.every(n => n >= 46)), '결과 버튼은 화면 안에서 46px 이상이다');
  return { ...shown, previousBest: before.best };
}

async function focusIs(id) {
  assert.equal(await page.evaluate(() => document.activeElement.id), id);
}
async function gameplayState() {
  return page.evaluate(() => ({
    t: S.t, mass: S.mass, score: S.score, peak: S.peak, energy: S.energy, combo: S.combo,
    x: hole.position.x, z: hole.position.z, alive: S.alive, tier: S.tierIdx,
    boons: S.boons.map(b => L(b.n)),
  }));
}
const pluck = s => {
  const {t, mass, score, peak, energy, combo, x, z, alive, tier, boons} = s;
  return {t, mass, score, peak, energy, combo, x, z, alive, tier, boons};
};
// Ego는 다른 탭을 활성화해도 검사 탭을 visible로 유지한다. 문서의 visibilitychange 경로를 모의한다.
async function visibility(hidden) {
  await page.evaluate(value => {
    if (value) Object.defineProperty(document, 'hidden', {value: true, configurable: true});
    else delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}
async function verifyCoveredResult(expected, description) {
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Space');
  assert(await page.evaluate(() => PAUSE.result && !gpActive),
    description + ' 뒤에서 실제 키 입력으로 결과를 닫거나 새 판을 시작할 수 없다');
  assert(!await page.evaluate(() => $('coreResult').contains(document.activeElement)),
    description + ' 뒤의 결과에 포커스가 남지 않는다');
  assert.deepEqual(await gameplayState(), pluck(expected));
}

const koreanViewport = {lang: 'ko', width: 667, height: 375, touch: true};
const rotated = await resultRun(koreanViewport);
await page.keyboard.press('Tab');
await focusIs('coreContinue');
await resize(375, 667, true);
await page.waitForFunction(() => !PAUSE.orient && !$('rotate').classList.contains('on') && cam.aspect < 1);
await page.screenshot({path: output + '/ko-portrait.png'});
assert(await page.evaluate(() => PAUSE.result && !PAUSE.interrupted && document.activeElement.id === 'coreContinue'));
assert.deepEqual(await gameplayState(), pluck(rotated));

// 회전을 끝내도 숨김 정지가 남아 있는 동안은 결과를 조작할 수 없다.
await visibility(true);
await resize(667, 375, true);
await page.waitForFunction(() => !PAUSE.orient && PAUSE.hidden);
await verifyCoveredResult(rotated, '탭 숨김');
await visibility(false);
await focusIs('coreContinue');
await page.keyboard.press('Enter');
await page.waitForFunction(t => S.t > t && !PAUSE.result && gpActive, rotated.t);
console.log('세로 결과 유지 및 탭 숨김 중 Tab·Enter·Space 차단, 가로·표시 복귀 후 초점과 Enter 계속 동작 통과');

const english = await resultRun({lang: 'en', width: 960, height: 600, touch: false});
const settledEnglish=await page.evaluate(()=>[dustBal(),readRecord('acc_runs')]);
assert(await page.evaluate(()=>S.dustSettlement.total>0&&$('coreDust').textContent.includes('STARDUST')));

// 키를 누르고 애니메이션보다 오래 기다려도 물리·위협·타이머·보상이 멈춘다.
await page.keyboard.down('KeyW');
await page.keyboard.press('Space');
await page.keyboard.press('Escape');
await page.waitForTimeout(1450);
await page.keyboard.up('KeyW');
const repeat = await page.evaluate(() => {
  updateCore(.016);
  updateCore(.016);
  return {coreEaten, manual: PAUSE.manual, steering: steer().mag, result: PAUSE.result};
});
assert.deepEqual(repeat, {coreEaten: true, manual: false, steering: 0, result: true});
assert.deepEqual(await gameplayState(), pluck(english));

await page.keyboard.press('Shift+Tab');
await focusIs('coreRestart');
await visibility(true);
assert(await page.evaluate(() => PAUSE.hidden && !PAUSE.orient));
await verifyCoveredResult(english, '회전 없이 탭 숨김');
await visibility(false);
await focusIs('coreRestart');
assert(await page.evaluate(() => !PAUSE.hidden && PAUSE.result && !gpActive));

await page.keyboard.press('Tab');
await focusIs('coreContinue');
await page.keyboard.press('Shift+Tab');
await focusIs('coreRestart');
await page.keyboard.press('Tab');
await focusIs('coreContinue');
// 계속 핸들러의 마지막에 기록한다. 다음 물리 프레임의 자연스러운 시간 경과와 구별한다.
await page.evaluate(() => {
  $('coreContinue').addEventListener('click', () => {
    window.resumeState = {
      t: S.t, mass: S.mass, score: S.score, peak: S.peak, energy: S.energy, combo: S.combo,
      x: hole.position.x, z: hole.position.z, alive: S.alive, tier: S.tierIdx, boons: S.boons.map(b => L(b.n)),
    };
  }, {once: true});
});
await page.keyboard.press('Enter');
assert.deepEqual(await page.evaluate(() => window.resumeState), pluck(english));
await page.waitForFunction(t => S.t > t && !PAUSE.on && gpActive && document.activeElement === renderer.domElement, english.t);
assert(await page.evaluate(() => comboOn()), '계속하기 직후 콤보 연쇄도 유지한다');
await visibility(true);
const hiddenRun = await gameplayState();
await page.waitForTimeout(120);
assert(await page.evaluate(() => PAUSE.hidden && !PAUSE.result && !gpActive));
assert.deepEqual(await gameplayState(), hiddenRun);
await visibility(false);
await page.waitForFunction(t => S.t > t && gpActive, hiddenRun.t);
await page.evaluate(() => __acc.setMass(.01));
await page.waitForSelector('#over:not(.off)', {state: 'visible'});
assert.equal(await page.evaluate(() => $('overTitle').textContent), 'EVAPORATED');
assert.deepEqual(await page.evaluate(()=>[dustBal(),readRecord('acc_runs')]),settledEnglish,'실제 핵 성공→계속→실패 중복 정산 없음');
await page.click('#retryBtn', {label: '실패 뒤 다시 시작'});
await page.waitForFunction(() => S.alive && !coreEaten && galCore.visible && !PAUSE.result && S.t === 0);
assert.deepEqual(await page.evaluate(() => [S.mass, S.peak, S.score, S.boons.length, PAUSE.manual]), [1.2, 1.2, 0, 0, false]);
console.log('EN 960×600 · 결과 정지·탭 정지·초점 순환·계속 상태·실패 재시작 통과');

const korean = await resultRun(koreanViewport);
const settledKorean=await page.evaluate(()=>[dustBal(),readRecord('acc_runs')]);
const hit = await page.evaluate(() => {
  const r = $('coreRestart').getBoundingClientRect();
  return {x: r.x + r.width / 2, y: r.y + r.height / 2};
});
await page.cdp('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [hit]});
await page.cdp('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
await page.waitForFunction(() => S.alive && !coreEaten && galCore.visible && !PAUSE.result && S.t === 0);
assert.deepEqual(await page.evaluate(() => [S.mass, S.peak, S.score, S.boons.length, PAUSE.manual]), [1.2, 1.2, 0, 0, false]);
assert.equal(await page.evaluate(() => STATS.best), Math.max(korean.previousBest, korean.score));
assert.deepEqual(await page.evaluate(()=>[dustBal(),readRecord('acc_runs')]),settledKorean,'핵 성공→새 판 정산 보존');
console.log('KO 667×375 · 결과 접근·46px 터치·새 판 초기화·최고점 보존 통과');

await prepare({lang: 'en', width: 960, height: 600, touch: false, mass: 3000});
await page.waitForFunction(() => !S.alive && !$('over').classList.contains('off'));
assert.equal(await page.evaluate(() => $('overTitle').textContent), 'DEVOURED');
assert(await page.evaluate(() => !coreEaten && !PAUSE.result));
console.log('퀘이사 미만의 핵 접촉은 기존 실패 화면으로 이어짐을 확인');

const exceptions = (await page.events()).filter(event => event.method === 'Runtime.exceptionThrown');
assert.deepEqual(exceptions, [], '브라우저 스크립트 예외');
