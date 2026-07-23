# Activity Log (역시간순 — 최신 위)

## 2026-07-23 · 프로토 v0.1 — 코어 루프 동작 (10/10 검증)
- `src/index.html` — Three.js r128 단일 파일. 관성 활공·먹고 성장(질량^⅓ 반경)·**호킹 축소 타이머**(작을수록 빠름)·**더 큰 블랙홀에 먹힘**(조석 파괴)·티어(항성/중간/초대질량)·카메라 줌아웃.
- **중력 렌징 포스트프로세스**: 배경별 전용 RT → 프래그먼트 셰이더(1/r 편향 + 1/r² 확대 + 광자 고리 + 블루시프트). 질량 따라 강도↑. **배경별 휘어짐이 실제로 보임 = 시그니처(2D 불가) 확인.**
- 검증 `scripts/verify-proto.mjs` 10/10: 부트·성장·호킹축소·렌징강도·티어·증발게임오버·재시작·JS에러0. 스크린샷 실측(proto-lens-mid.png).
- 서버: `sh scripts/serve.sh src` → http://localhost:3040. three.min.js는 nova-surge slice.built에서 추출(r128, 589KB).
- 다음: **오너 손맛 판정**(축소압력·먹는 리듬 재밌나) → 튜닝. 이후 콘텐츠(데일리·코덱스·사운드)·배포.

## 2026-07-23 · 프로젝트 부트스트랩 + 컨셉 v1
- nova-surge(3D 슈터)가 CrazyGames에서 "차별화 부족"으로 거절 → 차기작으로 피벗. 오너 아이디어(우주·블랙홀 성장·교육) 기반.
- 경쟁 조사([research/competitive-2026-07-23.md](research/competitive-2026-07-23.md)): "움직이며 먹고 성장"(Holey.io/Osmos/Solar 2/Tasty Planet)은 포화. 단 **"과학이 곧 재미"인 아케이드**는 빈 곳. 오너 관찰로 정정: CG 직접 경쟁은 Holey.io 중심(Yumy 라이브 미확인·Black Hole Idle은 클리커).
- 결정 방향: 검증된 손맛(움직이며 먹기)은 유지 + **실제 물리를 규칙으로** 차별화(호킹 축소타이머·질량 위계·조석 파괴) + **3D 중력 렌징**(2D 클론 불가). 상세 [design/concept.md](design/concept.md).
- 스캐폴드: 포트 3040–3044, LLM 위키, AGENTS.md(게임 검증 규약 재활용), serve.sh. project-bootstrap 표준.
- 다음: 오너 컨셉 리뷰 → 코어 루프 프로토(움직임+먹기+호킹 축소+렌징 1샷)로 손맛 검증.
