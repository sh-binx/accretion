# ACCRETION — 포털 제출 가이드 (prototype 3.2, 2026-07-28)

빌드·SDK·에셋은 준비 완료. **계정 단계만 오너가 수행**하면 된다.

## 1. 제출 패키지

단일 파일 게임이라 빌드 단계가 없다.

```bash
cd ~/dev/accretion && zip -j accretion-v3.2-submission.zip index.html
```
- 산출: `index.html`이 zip 루트에 위치(포털 요구 형식)
- **실측 195KB 1파일** — Three.js·폰트(Anton/Martian Mono)·셰이더 전부 인라인, 외부 스크립트 의존 **0건**
- 유일한 외부 통신: 글로벌 리더보드(Supabase Edge Function). 차단돼도 게임은 정상 동작(제출 실패 시 조용히 폴백)

## 2. 포털 SDK

단일 빌드가 호스트로 자동 판별한다 — 별도 빌드가 필요 없다.

| 호스트 | 어댑터 |
|---|---|
| `*crazygames*` | CrazyGames SDK v3 |
| `*poki-gdn*`, `*poki.com*` | Poki SDK v2 |
| 그 외 | 로컬(no-op) |

QA 강제 전환: `?portal=cg` / `?portal=poki` / `?portal=local`

**연동 상태**
- ✅ 로딩 완료 신호 — 첫 프레임 렌더 직후
- ✅ 게임플레이 시작/종료 — `begin()` / `gameOver()`
- ✅ 미드게임 광고 — **AGAIN 버튼에서만**(자연 휴지점), 쿨다운 120s, 워치독 15s
- ✅ 리워디드 광고 — 워치독 20s, 광고 미시청 시 보상 없음
- ✅ 광고 중 강제 뮤트 → 원래 상태 복원(사이트 뮤트 우선권)
- ✅ CrazyGames Progress Save(Data Module) — 8키 이관 + localStorage 미러 이중화
- ✅ 모든 실패 경로에서 게임이 멈추지 않음(SDK 6s 타임아웃·전 메서드 try 격리·콜백 1회 보장)

검증: `node scripts/verify-portal.mjs` (12/12)

## 3. 복붙 메타데이터 (EN)

| 필드 | 값 |
|---|---|
| Title | **ACCRETION** |
| Tagline | become the black hole |
| Short description | Start as a collapsing cloud core. End as a TON 618-class giant. Real astrophysics is the rule set, not the flavour. |
| Category | Arcade / Casual (.io 아님) |
| Tags | black hole, space, physics, educational, arcade, survival, upgrade, science, atmospheric, single player |
| Controls | **WASD / arrows / drag — steer. SPACE — dash. SHIFT — pulse.** Mobile: drag to steer, on-screen DASH / PULSE. |
| Orientation | Landscape and portrait both supported |
| Players | 1 |
| Age | All ages |

### Long description (EN)

> You begin as a protostar — a collapsing cloud core, not yet a star — and end as a TON 618-class giant.
>
> Feeding carries you through a real stellar life cycle: ignite into a main-sequence star, collapse only once you pass 20 solar masses, become a black hole, and light relativistic jets at quasar mass.
>
> Real astrophysics is the rule set, not the flavour. The Eddington limit throttles how fast you can eat, so late growth has to come from merging with rival black holes. Cross into a larger hole's tidal zone and it strips your mass — but you can still tear free, because only the event horizon is final. Swallowing a body your own size takes time, the way an actual tidal disruption event does.
>
> A 23-entry science codex logs everything you meet, daily modifiers reshuffle the field, and an APEX rival hunts you once you reach black-hole tier.

### 한국어 소개

> 아직 별이 되지 못한 붕괴하는 구름 핵으로 시작해 TON 618급 거대 블랙홀로 끝난다.
>
> 먹으며 실제 항성의 일생을 통과한다 — 주계열성으로 점화하고, 20 태양질량을 넘어야 비로소 붕괴해 블랙홀이 되고, 퀘이사 질량에서 상대론적 제트가 켜진다.
>
> 실제 천체물리가 곧 규칙이다. 에딩턴 한계가 먹는 속도를 억제하므로 후반 성장은 라이벌 블랙홀과의 병합에서 나온다. 더 큰 블랙홀의 조석 영역에 들어가면 질량을 뜯기지만 벗어날 수 있다 — 되돌릴 수 없는 것은 사건지평선 안쪽뿐이다.

## 4. 에셋

`press/` 에 1600×900 PNG 원본.

| 파일 | 용도 |
|---|---|
| `09-title-clean.png` | **썸네일**(조작 크롬 제거) |
| `00-title.png` | 커버(실제 대기화면) |
| `01-protostar.png` | 스크린샷 1 — 원시별 |
| `02-ignition.png` | 스크린샷 2 — 점화 |
| `03-supernova.png` | 스크린샷 3 — 초신성 |
| `04-rivals.png` | 스크린샷 4 — 라이벌 블랙홀 |
| `05-quasar.png` | 스크린샷 5 — 퀘이사 제트 |
| `06-tidal.png` | 스크린샷 6 — 조석 영역 |

**규격 주의**: 정사각·4:3을 요구하는 포털에서는 워드마크가 하단에 있어 잘린다. 제출처 확정 후 해당 비율로 크롭 버전을 만들 것.

## 5. 남은 것 (제출 전)

- [ ] **모바일 실기 테스트** — 오너만 가능. 확인 항목: 가로/세로 · 드래그 조종 · 제트 켜진 뒤 프레임 · 소리(iOS는 첫 탭에서 오디오 해제)
- [ ] **30초 플레이 영상** — Poki 요구. **오너의 실기 화면 녹화가 유일한 현실적 방법**이다.
  - 헤드리스 캡처를 실제로 시도했고 실패했다: 소프트웨어 렌더링에서 게임 시간이 **실시간의 0.3배**(3초에 0.9초)로 흐르고, 영상 인코딩까지 겹치면 6분을 넘겨도 파일이 나오지 않았다. 나오더라도 20fps대를 3배로 당긴 화면이라 홍보물 품질이 안 된다.
  - 권장 촬영 시나리오(30초): 원시별 시작 → 점화 배너 → **초신성 붕괴** → 라이벌 블랙홀 병합 → **조석 영역 탈출** → 퀘이사 제트 점화. 이 여섯 장면이 이 게임의 전부다.
  - macOS는 `⇧⌘5`, iOS는 제어센터 화면 기록. 세로보다 **가로**로 찍을 것
- [ ] 포털별 규격 크롭
- [ ] 리더보드 초기화 여부 결정 — 2.6~3.2에서 성장 속도가 바뀌어 옛/새 점수가 직접 비교되지 않음

## 6. 계정 단계 (오너)

1. **CrazyGames** — developer.crazygames.com → 게임 등록 → zip 업로드 → QA 프리뷰에서 SDK 항목 점등 확인
2. **Poki** — poki.com/developers → 제출 → 영상 필요
3. 승인 후 `undefined-studio > projects`의 `href`를 포털 URL로 바꿀지 결정(현재는 GitHub Pages 직결)
