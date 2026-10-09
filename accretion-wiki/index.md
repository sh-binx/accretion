# accretion-wiki — 지식 인덱스

> Schema/기록 규칙: **[CLAUDE.md](CLAUDE.md)** (이 위키 루트). 폴더: design / decisions / research.

교육형 3D 블랙홀 아케이드. 코드명 **ACCRETION**(변경 가능). Three.js r128, nova-surge slice 파이프라인 재활용, 포트 3040–3044.

## Design
- [design/portal-loading.md](design/portal-loading.md) — 로딩 준비와 SDK 전달 분리 · 프레임별 중복 신호 회귀 · 실제 포털 확인 범위
- [design/concept.md](design/concept.md) — **핵심 기획**: 코어 루프(움직이며 먹고 성장) + 실제 물리를 규칙으로(호킹 복사 축소타이머·질량 위계·조석 파괴·중력 렌징) + 3D 차별점 + 프로토 스코프

## Decisions
- [decisions/2026-10-09-v1.1-fun-retention.md](decisions/2026-10-09-v1.1-fun-retention.md) — v1.1: 초보 10초 사망·세로 차단·GPU 누수 실측 → 생존 기회·유예·세로·별먼지 업그레이드·데일리 연속
- [decisions/2026-09-26-release-build.md](decisions/2026-09-26-release-build.md) — 출시 빌드 v1.0.0: 글로벌 리더보드 OFF(부활 조건) · 포털 요건(일시정지·광고 뮤트·locale·사이트락·DEV 게이트) · SHIFT 동사 = PULL

## Research
- [research/competitive-2026-07-23.md](research/competitive-2026-07-23.md) — 경쟁 조사: "먹고 성장" 장르 포화도 + 차별화 여지(교육·3D 물리) · 과학 정확성 정정

## 상태
- 2026-10-09: **CrazyGames 반려(10-06, 성과 미달) → v1.1 재미·잔존 패스** 브랜치 `fun-v1.1`(로컬 검증 완료 · 재제출은 오너 결정)
- 2026-10-05: **Basic Launch** — 로딩 신호/광고 워치독/저장소 보호 수정본 라이브. Desktop 9/15, 수동 검토 대기. Full Launch·수익화 승인 전.
- 2026-09-26: **v1.0.0 출시 후보** — 제출 패키지·에셋 준비 완료, 계정 제출만 남음(`SUBMISSION.md`)
- 2026-07-23: 프로젝트 부트스트랩 + 컨셉 v1 (프로토 착수 전, 오너 리뷰 대기)
