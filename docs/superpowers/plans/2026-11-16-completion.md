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

### Task 3: 실물 iPhone 이동·스킬 동시 입력
**Files:** index.html, scripts/verify-multitouch.ego.mjs, 필요시 집중 WebKit 회귀, docs/qa-20261116-mobile.md.
- 오너 최신 1f35e47 실물 Safari: 방향 조정 중 스킬 사용이 불가능한 것으로 보고. 충전/잠금 상태와 touch click 합성 누락을 구분해 재현.
- 이동 손가락 유지·두번째 손가락으로 준비된 각 스킬 사용을 지원. 발동 정확히1회·에너지1회차감·방향유지·각손가락해제/취소·재시작/모달/키보드보존.
- 기존 시험의 joy 유지8개는 스킬발동증거가 아님. 실제터치프로토콜 시험과 엔진회귀에서 발동부수효과를확인하고실물최종확인은별도.
- RED/GREEN, 스코프커밋·보고와독립재검토. 게임능력가격/충전속도·밸런스변경없음.

### Task 4: iPhone 웹 앱 실행과 최종 모바일 화면 검수 (11-17)
- 전체화면 API 실제 지원시 기존 버튼을 유지. iPhone 미지원에는 시작/정지 메뉴에서 홈 화면에 추가하여 주소창 없이 실행하는 안내를 KO/EN 제공. standalone 여부를 기능 검사하고 이미 해당모드면 설치안내 숨김. 과도한 팝업/강제설치 금지.
- 홈 화면 웹 앱에 필요한 상대 start_url/scope, standalone manifest와 적절한 아이콘·메타를 추가. 기존 단일파일 배포/패키지 경로와 호환, 새 캐시 서비스워커는 필요성 없이 추가하지 않는다. 기존 저장·계정·점수 보존.
- VisualViewport 가로/세로·주소창 펼침/접힘·safe-area 처리 검증. 지원/거부/미지원 전체화면과 standalone 일반탭 모두 테스트. 실제 iPhone Safari 및 홈화면 실행은 직접 확인 가능한 범위 실측. 설치 직접조작이 요구되면 정확히 그 단계만 root에 전달.
- 조작법 문구 최신화. 이동·스킬 동시 사용 회귀, 성공/재시작/언어/정지/소리, 실제 정상입력 완주영상과 사운드 확보. 기존 검수 성공을 재사용하되 수정 영향 경로는 다시 확인. 오류0·build/package확인 후 스코프커밋 및 보고.
