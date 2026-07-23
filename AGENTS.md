# accretion — 교육형 3D 블랙홀 아케이드

Three.js r128 기반 웹게임. "움직이며 먹고 성장"(Holey.io식 손맛) + **실제 천체물리를 게임 규칙으로**(질량 위계·호킹 복사·조석 파괴·중력 렌징). 파이프라인은 nova-surge `slice3.html`(단일 HTML 빌드) 방식을 재활용. 상세 기획: `accretion-wiki/design/concept.md`.

# Project knowledge wiki (accretion-wiki)

이 레포는 LLM-wiki 패턴으로 프로젝트 컨텍스트를 누적한다. 위키는 `accretion-wiki/`, 규칙은 `accretion-wiki/CLAUDE.md`.

**자동 활용:** 세션 시작 시 `SessionStart` 훅(`scripts/wiki-context.py`)이 위키 `index.md`+최근 `log.md`를 컨텍스트에 자동 주입한다. 작업 중 이 지식을 우선 활용하고, 더 깊이 필요하면 해당 페이지를 직접 읽어라.

**자동 기록 (중요):** 작업 중 아래에 해당하는 **중요한 정보가 나오면 즉시 위키에 기록**하라(휘발 금지):
- 방향을 정하는 **결정**(코어 메커닉·재미 방향·과학 스코프·포지셔닝·타깃 플랫폼) → `accretion-wiki/decisions/`
- 비자명한 **설계/규칙**(게임 루프·물리 규칙 매핑·튜닝 상수·아키텍처) → `accretion-wiki/design/`
- **경쟁 조사·과학 사실**(정확성이 곧 제품 — 출처 필수) → `accretion-wiki/research/`

매 기록은 `index.md`(신규 시)·`log.md`(항상, 역시간순)에 반영. 코드·git로 자명한 것, 일회성 대화는 기록하지 않는다(부풀리기 금지).

# 게임 검증 규약 (nova-surge에서 확립 — 재활용)

1. **헤드리스 검증은 필수 GL 플래그**: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. SwiftShader는 실속도보다 느리니 델타캡 유의(측정용 `__fast` 가속기 패턴 재활용).
2. **DEV 훅은 `?dev=1` 게이트**: 상태 노출(`window.__slice`류)·강제 스폰·측정 레버는 프로덕션에서 전부 `undefined`여야 함(치팅 방지). 제출 전 실측 확인.
3. **밸런스·시스템 변경 = 봇 스모크 + 스크린샷 실측**. "고쳤다"는 말만 X — before/after 시각 증거(Playwright 캡처)로 보고.
4. **오너의 같은 지적이 2회 넘으면 국소 패치 중단** — 기저 설계를 첫 원리에서 재검토.
5. **시장 조사는 검색 요약 말고 1차 출처로 검증** (2026-07-23 교훈 — 검색 요약이 라이브 상태를 오판).
6. **멀티세션 협업**: 작업 전 `git status`로 미커밋 변경 확인, **git add는 스코프 지정만(전면 -A 금지)**.
7. **커밋·푸시는 검증 종료코드 게이팅**(`&&`), grep 파이프 성공판정 금지.
