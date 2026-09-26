# ACCRETION

교육형 3D 블랙홀 아케이드 (코드명 · 변경 가능).

**당신은 블랙홀이다.** 우주를 미끄러지며 먹어치워 커지되, 끊임없이 증발한다 — 멈추면 사라진다. Holey.io식 손맛 + **실제 천체물리를 게임 규칙으로**(호킹 복사 축소 타이머·질량 위계·조석 파괴·중력 렌징) + 3D 렌징 비주얼(2D 클론이 못 하는 것).

- 기획: [`accretion-wiki/design/concept.md`](accretion-wiki/design/concept.md)
- 경쟁 조사: [`accretion-wiki/research/competitive-2026-07-23.md`](accretion-wiki/research/competitive-2026-07-23.md)
- 스택: Three.js r128 (`index.html` 단일 파일 + `three.min.js`, nova-surge slice 파이프라인 재활용)
- 포트: 3040–3044 (`sh scripts/serve.sh` — 게임이 repo root)

## 플레이 (라이브)
**https://sh-binx.github.io/accretion/** — GitHub Pages가 이 리포 root의 `index.html`을 서빙.

## 개발
```bash
sh scripts/serve.sh            # 로컬 정적 서버 (http://localhost:3040)
node scripts/verify-p4.mjs     # 헤드리스 검증(서지·존) — 그 외 verify-*.mjs
```
- 배포 = **`git push` (별도 복사·데모 리포 없음 — Pages가 root를 직접 서빙)**
- DEV 훅: URL에 정확히 `?dev=1` → `window.__acc` (검증·측정용 · 그 외 파라미터/프로덕션에선 undefined)

## 상태 (2026-09-26) — v1.0.0 출시 후보
포털 제출 준비 완료(계정 단계만 남음) — **[`SUBMISSION.md`](SUBMISSION.md)**. 진화 아크(원시별→주계열성→초신성→블랙홀 5티어) · 동사 5종(대시·당기기·중력파·붙잡기·제트) · 과학 코덱스 39 · 업적 20 · 데일리 · 한/영 전 화면 · CrazyGames/Poki SDK 어댑터 · 사이트락. **글로벌 리더보드는 출시 빌드에서 OFF**(`LB_ENABLED`, 결정: [`accretion-wiki/decisions/2026-09-26-release-build.md`](accretion-wiki/decisions/2026-09-26-release-build.md)). 진행 로그 = [`accretion-wiki/log.md`](accretion-wiki/log.md).

## 제출 패키지
```bash
sh scripts/package.sh          # dist/accretion-submission.zip (index.html + three.min.js) + 압축 해제 스모크 테스트
```
