# 결정: 출시 빌드(v1.0.0) — 리더보드 OFF · 포털 요건 · 동사 이름 통일 (2026-09-26)

status: active · 결정자: 오너("권장대로 전부 수정") · 근거 실측: 2026-09-26 출시 점검

## 1. 글로벌 리더보드를 출시 빌드에서 끈다
- **무엇**: `index.html` 의 `const LB_ENABLED=false`. 보드 입구(메뉴 LEADERBOARD·RANK 칩·결과 화면 버튼)·순위 줄·"board offline"·파일럿 이름 칸을 숨기고 `LB.submit`/`LB._q` 가 네트워크를 타지 않는다. 개인 최고점(`acc_best`)은 로컬에 남는다.
- **왜**:
  - 백엔드가 죽어 있었다 — nova-surge 공유 Supabase 프로젝트 `znboesjyunfkfqepsumu` 가 `INACTIVE`, 호스트 `NXDOMAIN`(2026-09-26 MCP·curl 실측). 라이브 플레이어 전원이 "board offline" 을 보고 있었다.
  - Poki 는 외부 요청을 기본 차단한다([Poki requirements](https://developers.poki.com/guide/requirements-quality)).
  - CrazyGames 는 자체 백엔드를 쓰면 `userId` 로 연결하고, SDK 이벤트 밖의 데이터 수집엔 개인정보 고지가 필요하다([CG account integration](https://docs.crazygames.com/requirements/account-integration/) · [CG technical](https://docs.crazygames.com/requirements/technical/)).
  - 5.8·5.13·5.18 로 점수 경제가 바뀌었는데 `SCOREVER` 는 1.5 이후 '2' 그대로 — 옛 기록과 비교가 성립하지 않았다.
  - 안티치트는 점수/시간 비율(120k/s)뿐이라 `dur` 를 길게 적으면 위조가 가능했다.
- **부활 조건·방법**: ① Supabase 프로젝트 복구(또는 CG 리더보드 SDK로 이전) ② CG `userId` 연동·이름 입력은 CG 사용자명으로 대체 ③ 개인정보 고지 ④ 점수 버전 올리고 테이블 초기화 ⑤ `LB_ENABLED=true` + `verify-lb` 를 옛 계약(제출·순위·안티치트)으로 되돌린다(git 이력 `ef1e61a` 이전).

## 2. 포털 요건
- 일시정지: 탭 숨김·세로 회전 차단을 `PAUSE` 한 곳에서 판정 → 게임 루프·오디오 정지 + `gameplayStop`/`Start` 짝(연속 중복 금지 — Poki 규칙).
- 광고 뮤트는 `adStarted` 시점(CG ads 요건), 광고 중 메뉴 잠금.
- 언어는 CG SDK locale 우선(CG gameplay 요건 "Must use user's locale from SDK"), 사용자가 고른 것만 저장.
- 사이트락: CG 공식 판정식(라벨 끝 3칸 안 `crazygames`)에 TLD 형태 검사를 더했다 — 공식식은 `crazygames.evil.com` 도 통과시킨다(실측). [CG sitelock](https://docs.crazygames.com/resources/html5/sitelock/)
- DEV 게이트 `/[?&]dev=1(&|$)/` — 옛 `/[?&]dev/` 는 `?device=`·`?dev=0` 에도 치트 훅을 열었다(실측).

## 3. SHIFT 동사 = PULL(당기기)
- 카드 "frame drag" · 버튼 "SPIN" · 배너 "COLLAPSE PULSE" · 문서 "PULSE" — 한 동작에 이름이 넷이었다. 하는 일(먹이를 끌어들여 공전시킴)을 그대로 말하는 **PULL** 로 통일, 물리 이름(관성계 끌림 · frame dragging)은 배너 부제와 코덱스가 맡는다.
- 시작 카드는 조종·대시만. 나머지 동사는 풀리는 순간 가르친다(에너지 첫 충전 · 블랙홀 전이 · 퀘이사).
