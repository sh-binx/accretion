# ACCRETION — 포털 제출 가이드 (v1.0.0, 2026-09-26)

빌드·SDK·에셋은 준비 완료. **계정 단계만 오너가 수행**한다. (이전판은 prototype 3.2 기준 — 크기·검증 수·에셋이 모두 낡아 전면 교체했다.)

## 1. 제출 패키지

```bash
cd ~/dev/accretion && sh scripts/package.sh
```
- 산출: **`dist/accretion-submission.zip`** — zip 루트에 `index.html` + `three.min.js` 2파일(폴더 없음, 상대 경로만)
- 실측(2026-09-26): zip **286KB** · 풀면 index.html 339KB + three.min.js 603KB = **약 0.94MB**. 폰트(Anton·Martian Mono)·셰이더·텍스처는 전부 인라인/절차 생성.
- 포털 빌드는 GitHub Pages 전용 메타(canonical·og·twitter·site_name)를 뺀다.
- 스크립트 끝에서 **스모크 테스트**가 자동으로 돈다(`scripts/verify-package.mjs`): 임시 폴더에 풀어 3040–3044 중 빈 포트로 띄우고 실제 플레이 → 404 0 · 콘솔 에러 0 · 외부 요청 0 · 치트 훅 없음.
- ⚠️ `index.html` 한 파일만 zip 하면 **부팅하지 않는다**(three.min.js 404 → `THREE is not defined`, 2026-09-26 실측). 반드시 위 스크립트를 쓴다.

## 2. 포털 연동 상태

단일 빌드가 호스트로 자동 판별한다(`*crazygames*` → CrazyGames SDK v3 · `*poki-gdn*`/`poki.com` → Poki SDK v2 · 그 외 → 로컬 no-op). QA 강제: `?portal=cg|poki|local`.

| 항목 | 상태 |
|---|---|
| 로딩 완료 신호 | 첫 프레임 렌더 직후 |
| gameplayStart / Stop | 판 시작·종료 + **탭 숨김·세로 회전 차단 때 Stop, 복귀 때 Start**(연속 중복 없음) |
| 미드게임 광고 | AGAIN 버튼에서만(자연 휴지점) · 쿨다운 120s · 워치독 15s · 광고 중 메뉴 잠금 |
| 광고 뮤트 | **`adStarted` 시점에** 뮤트, 끝나면 원래 상태로 복원(요청만 하고 안 채워지면 소리를 끊지 않는다) |
| 리워디드 광고 | 어댑터만 있음 — **게임 내 배치는 없다(오너 결정 대기)** |
| 언어 | CrazyGames 에선 `SDK.user.systemInfo.locale` 을 따른다(ko → 한국어, 그 외 영어). 사용자가 메뉴에서 고른 언어·`?lang=` 이 우선 |
| Progress Save | CG Data Module 8키 + localStorage 미러 |
| 사이트락 | localhost · sh-binx.github.io · CG 도메인군(`crazygames.com` 서브도메인·국가 TLD·앱 origin) · poki.com / poki-gdn.com / poki.dev 만 부팅 |
| 외부 네트워크 | **0건**(포털 SDK 제외). 글로벌 리더보드는 출시 빌드에서 꺼져 있다 — 아래 3 |
| 치트 훅 | `?dev=1` 정확히 일치할 때만 `window.__acc`. 프로덕션·`?device=` 등에선 undefined(실측) |
| iOS 오디오 | 전화·알림으로 끊긴 AudioContext 를 다음 touchend 에서 재개 |

## 3. 리더보드 — 출시 빌드에서 OFF (2026-09-26 오너 결정)

- `index.html` 의 `LB_ENABLED=false` 한 줄. 보드 입구·순위 줄·"board offline"·파일럿 이름 칸이 전부 숨겨지고 Supabase 요청 0건.
- 이유: 백엔드(nova-surge 공유 Supabase)가 비활성(INACTIVE·NXDOMAIN) · Poki 는 외부 요청 기본 차단 · CG 는 자체 백엔드면 userId 연동과 개인정보 고지가 필요.
- **개인 최고점(BEST)은 로컬에 남는다.** 부활 방법은 `accretion-wiki/decisions/2026-09-26-release-build.md`.

## 4. 복붙 메타데이터 (EN)

| 필드 | 값 |
|---|---|
| Title | **ACCRETION** |
| Tagline | become the black hole |
| Short description | Start as a collapsing cloud core. End as a TON 618-class giant. Real astrophysics is the rule set, not the flavour. |
| Category | Arcade / Casual (.io 아님 — 싱글 플레이) |
| Tags | black hole, space, physics, educational, arcade, survival, science, atmospheric, single player |
| Controls | **WASD / arrows / drag — steer · SPACE — dash · SHIFT — pull · E — wave · C (hold) — bank into orbit · F — jet** (hold & jet unlock as you grow). Mobile: drag to steer, on-screen DASH / PULL / WAVE / HOLD / JET buttons. |
| Orientation | **Phones: landscape only**(세로면 회전 안내가 뜨고 일시정지) · Desktop: 아무 비율 |
| Languages | English, 한국어(전 화면 — `verify-ko` 가 남은 영어 0건을 강제) |
| Players | 1 |
| Age | All ages |

### Long description (EN)

> You begin as a protostar — a collapsing cloud core, not yet a star — and end as a TON 618-class giant.
>
> Feeding carries you through a real stellar life cycle: ignite into a main-sequence star, collapse only once you pass 40 solar masses, become a black hole, and light relativistic jets at quasar mass.
>
> Real astrophysics is the rule set, not the flavour. The Eddington limit throttles how fast you can eat, so late growth has to come from merging with rival black holes. Cross into a larger hole's tidal zone and it strips your mass — but you can still tear free, because only the event horizon is final. Swallowing a body your own size takes time, the way an actual tidal disruption event does. Once you are a black hole you can bank prey into an accretion disk instead of swallowing it — slower, but worth far more.
>
> A 39-entry science codex logs everything you meet, 20 awards track how you play, daily modifiers reshuffle the field, and an APEX rival hunts you once you reach black-hole tier.

### 한국어 소개

> 아직 별이 되지 못한 붕괴하는 구름 핵으로 시작해 TON 618급 거대 블랙홀로 끝난다.
>
> 먹으며 실제 항성의 일생을 통과한다 — 주계열성으로 점화하고, 40 태양질량을 넘어야 비로소 붕괴해 블랙홀이 되고, 퀘이사 질량에서 상대론적 제트가 켜진다.
>
> 실제 천체물리가 곧 규칙이다. 에딩턴 한계가 먹는 속도를 억제하므로 후반 성장은 라이벌 블랙홀과의 병합에서 나온다. 더 큰 블랙홀의 조석 영역에 들어가면 질량을 뜯기지만 벗어날 수 있다 — 되돌릴 수 없는 것은 사건의 지평선 안쪽뿐이다. 블랙홀이 되면 먹이를 곧장 삼키는 대신 강착원반에 붙잡아 쌓을 수 있다 — 느리지만 훨씬 많이 번다.

## 5. 에셋 (`press/`, 전부 v1.0.0 현재 빌드에서 촬영)

| 파일 | 규격 | 용도 |
|---|---|---|
| `cover-1920x1080.png` | 16:9 | CG 가로 커버(필수) |
| `cover-800x1200.png` | 2:3 | CG 세로 커버(필수) |
| `cover-800x800.png` | 1:1 | CG 정사각 커버(필수) |
| `accretion-trailer-1920x1080.mp4` | 16.8s · 30fps · 무음 · 13.9MB | CG 가로 프리뷰 영상(필수) |
| `accretion-trailer-1080x1620.mp4` | 16.8s · 30fps · 무음 · 9.4MB | CG 세로 프리뷰 영상(필수) |
| `screenshot-01…06-*.jpg` | 1920×1080 | 원시별 · 점화 · 초신성 · 렌징 · 퀘이사 제트 · 포식자 |

- 커버: 제목 외 문구 없음 · 테두리·아이콘·블랙바 없음. 게임 엔진에서 렌더한 **렌징 블랙홀 + 별의 일생 아크**(암석→행성→항성→적색거성→백색왜성→펄서) — Holey.io 류(도시를 먹는 구멍)와 첫눈에 구별되게.
- 영상: **첫 프레임 = 가로/세로 커버**(차이 평균 1.0/255) → 0.5s 크로스페이드 → 원시별 · 점화 · 초신성 · 블랙홀 렌징 · 퀘이사 제트. GPU 헤드리스 실시간 캡처(CDP screencast, 약 98fps 수집 → 30fps CFR) — **게임 시간 = 영상 시간, 빨리감기 없음**. 커서·소리·"Play now" 없음.
- 재촬영: 커버는 엔진 플레이트(4K)에서 비율별로 잘라 워드마크를 얹는 방식, 영상은 세그먼트별 `?dev=1` 훅으로 상황을 만든 뒤 실제 조종(자동 조준)으로 찍었다.

## 6. 검증 (제출 전 한 번 더)

```bash
sh scripts/serve.sh &                      # 3040
for f in scripts/verify-*.mjs; do node $f || echo "FAIL $f"; done   # verify-package 는 zip 경로 필요 → package.sh 가 돌린다
sh scripts/package.sh                      # zip + 스모크
```

## 7. 남은 것 — 오너만 가능

- [ ] **CrazyGames** — developer.crazygames.com 로그인 → 게임 등록 → `dist/accretion-submission.zip` 업로드 → 위 메타·커버 3종·영상 2종 → QA 프리뷰에서 SDK 항목 점등 확인 → 제출
- [ ] **Poki** — poki.com/developers 제출(CG 트랙션 후가 현실적 — daehee-wiki games/portals.md)
- [ ] **실기기 확인** — iPhone/Android 가로: 드래그 조종 + HOLD 멀티터치(한 손가락 조종 중 다른 손가락으로 ◍ HOLD), 제트 뒤 프레임, 첫 탭 소리
- [ ] 리워디드 광고를 둘지·어디에 둘지(현재 없음)
- [ ] 리더보드 부활 여부(부활 시 백엔드 복구 + CG userId 연동 + 개인정보 고지 필요)
