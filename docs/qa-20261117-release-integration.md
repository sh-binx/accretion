# 운영판 보존 통합 검수 — 2026-11-17

제품 고정 커밋 `75b97e5`는 운영 main `3d639e5`와 고도화 후보 `16b3b3a`의 병합이다. 별먼지·업그레이드·연속·생존·세로/FOV·지형 GPU 해제를 보존하고 핵 성공 정산을 런당 한 번으로 연결했다. 실제 공개 응답은 기존 main과 같으며 배포하지 않았다.

- index SHA-256: `c58eea1dbbd668e892d20254593f2e3be71626a3f6704414d1637d3081958853`.
- 기존/신규 회귀39스위트 통과. 최종 세로 CSS 후 영향 UI15/15(겹침0), 패키지12/12, 실제 세로 동시터치·정지·가로왕복·업그레이드 내부스크롤 재검증.
- 지형 소유기하/재질 해제: 웜홀2/3·잔해1/2·성운0/7, 공유기하·텍스처해제0. 새런20회 GPU기하10 유지.
- 최종 정상 키 입력으로 게임49.0284초에 핵 성공, 점수11,367,115·질량1,960,443·별먼지46. 성공→계속 후 정산/런 상태 보존. DEV훅 없음·런타임 오류0.
- 영상: `artifacts/release-integration/final-play/normal-play-with-hud-and-game-audio.mp4`,960×600/57.725초, 실제HUD+게임음,1,161프레임/평균20.11fps. 보간없음. 전체디코드오류0,6시점시각검수,음량평균−29.5/최대−11.7dBFS. 영상FPS는기기성능아님.
- 상세시험명령/실패후수정/시도별해시/한계: `.superpowers/sdd/2026-11-16-completion/release-fix-report.md`; 개별로그·스크립트·해시는 `artifacts/release-integration/`.
- ego9939·자체서버PID47689 종료 및 소멸 확인. `.codex/` 미추적 보존.

최신 실물 iPhone Safari 주소창/홈화면·장시간 성능, 실계정 클라우드 저장, 인간 초심자 재미/유지율은 미검증이다. 준비시험과 실제입력 자동파일럿의 근거를 실물 검증으로 확대하지 않는다. root의 집중 독립검토 후 배포판정을 받는다.

## 운영 배포 확인

2026-11-17 10:54 KST 기존 PR #1을 병합했다. 운영 커밋은 `5818ec9b47effe2b54dcf6448822ca5e322a9b47`, GitHub Pages build 상태는 `built`다. 10:57 KST 공개 index.html·manifest·manifest에 명시된 아이콘 두 개 모두 HTTP 200, MIME 정상, 검수본과 바이트가 일치했다. index SHA-256은 `c58eea1dbbd668e892d20254593f2e3be71626a3f6704414d1637d3081958853`. 증거는 `artifacts/release-integration/production-http.json`. 공개 주소는 https://sh-binx.github.io/accretion/ 이다.

이전 운영 기준 `3d639e5132265a81b10b7f0eb96145595af3847c`를 보존한다. 회귀 발생 시 병합 커밋의 첫 부모 기준 revert를 별도 브랜치/PR로 검증해 복구한다. 공개 브라우저 실플레이 확인은 별도 후속이며 HTTP 성공만으로 이를 대신하지 않는다.

공개 브라우저 확인도 완료했다. ego #10034에서 실제 Begin run 클릭→W/D 입력→Escape 정지→Resume run→자연 증발 실패→Play again→정지 대화상자를 확인했다. `public-play.png`, `public-pause.png`, `public-mobile-restart.png`가 증거다. 844×390은 CDP 화면 크기 모사이며 실물 iPhone 검증이 아니다. 이 짧은 배포 스모크로 전체 완주·콘솔 전수 검사를 주장하지 않는다. 정상 전편은 앞선 동일 바이트 고정본 영상이 근거다. 공간은 정상 종료 후 새 목록 소멸 확인했다.
