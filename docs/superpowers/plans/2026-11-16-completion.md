# Accretion 클라이맥스 완결 구현 계획
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
**Goal:** 핵 흡수 목표에 명확한 성공·후속 선택을 연결한다.
**Architecture:** 기존 단일HTML 게임 상태와 정지 시스템에 전용 성공 오버레이를 연결, 별도 영구 저장/서비스 추가 없음.
**Tech Stack:** Three.js/HTML/JavaScript, ego 브라우저 검증.
**Spec:** ../specs/2026-11-16-completion-design.md
## Global Constraints
기존 장르·수익모델 유지. 새 지출·고객발송·main 푸시 금지. 승인된 작업브랜치만. 브라우저 ego만, 쿠키/캐시 전체삭제 금지. 실제 완주와 개발 준비 시험 구분. KO/EN, 터치46px 이상.
## Review Focus
- 성공 보상 중복/계속 시 상태유실
- 성공과 진화선택 모달 중첩
- 숨김탭에서 돌아올 때 물리 재개
- 키보드 focus와 작은 가로 화면
- 실패/새런 뒤 성공 UI 잔존
### Task 1: 핵 흡수 성공 루프
**Files:** index.html, scripts/verify-core-completion.ego.mjs, accretion-wiki/log.md
**Interfaces:** 기존 updateCore(dt), begin(), gameOver(), PAUSE, choiceOpen 연결. 추가 함수/상태는 구현자가 실제 기존 구조에 맞춰 명시.
- [ ] 기존 핵 흡수 후 성공UI 부재를 재현하고 실패 증거 보존.
- [ ] 성공 패널·런 요약·계속/새판을 구현. 모달 중첩을 막고 입력·정지·포커스 보존.
- [ ] ego 준비 시험에서 성공1회/보상1회, continue 상태 동일, 새판 초기화, 실패재시작, 탭정지, KO/EN과2폭 검증. 실제 이벤트로 버튼 작동.
- [ ] 기존 핵심진행/멀티터치 회귀 실행, 정상입력 핵 흡수→성공 UI까지 녹화.
- [ ] 스코프 커밋, 보고파일에 근거·제약·명령 결과 기록.

### Task 2: 실물 Safari 하단 가림과 전체화면 경로
**Files:** index.html, scripts/verify-mobile-viewport.ego.mjs(신규), docs/qa-20261116-mobile.md(신규).
- [ ] 오너 실물 보고와 기존 고정 위치·innerHeight 기준을 추적하고 Safari 툴바 변화 시 가시 영역 차이를 재현/측정. 현재 QA phone-current copy는 fa0e8ad임을 명시.
- [ ] canvas/HUD/조작부/메뉴의 가시 높이·좌표를 일관되게 적용, 회전·주소창 펼침/접힘·짧은가로·safe area를 검사. 원인 입증 후 최소 수정.
- [ ] 지원 API feature detect 전체화면 진입/해제와 거부처리, 미지원에서 허위버튼 없음. KO/EN·46px 목표·기존모달스크롤/멀티터치 보존.
- [ ] 실제 브라우저 검수 및 제한을 구분, 기존 core/pause/멀티터치/package 회귀·스코프커밋·보고. 실물 최종재확인은 root가 오너도움과 미러링으로 이어감.
