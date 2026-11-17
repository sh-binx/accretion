# Accretion b5511e3 데스크톱 플레이 검수 · 2026-11-16

`git archive b5511e3 index.html three.min.js`로 분리한 고정 소스를 로컬 3040에서 제공했다. 제공된 `index.html` SHA256은 `355df29a9fb3b94b5a0b63c79f438b3e5ec8a969322e6123d71c34b6c1977ba4`다. Ego Lite Profile 1의 `?lang=en&qa=…` 기본 프로덕션 경로에서 960×600으로 진행했다.

월드 좌표와 주변 천체를 읽어 경로를 고르는 자동 플레이였다. 시작·조향·진화·스킬은 실제 클릭과 키로 입력했다. 게임 상태·질량·시간·난수·천체를 직접 수정한 곳은 없다. 수집한 페이지 예외와 오류 수준 콘솔 이벤트는 0건이다. 프로덕션의 `window.__acc`는 `undefined`였고 재관찰에서도 `__acc` 접두 훅이 없었다.

- 첫 판은 퀘이사로 성장해 핵 근처까지 접근한 뒤 115.931게임초에 사망했다.
- 두 번째 판은 76.917게임초에 은하 핵을 흡수했고 `Galactic core consumed` 성공 패널이 열렸다. 당시 최고 질량 2,003,625.118 M☉, 점수 36,653,890. 진화는 Thick Disk, Magnetic Arrest, Relativistic Jets, Rapid Spin이었다.
- `Continue growing`으로 핵 흡수·진화·질량을 유지했다. Escape로 정지하고 800ms 뒤 같은 게임 시간임을 확인했다. `Resume run` 후 500ms에 재개를 판정하는 스크립트가 시간 전진을 잡지 못해 종료 코드 1을 냈다. 같은 판을 재관찰하니 정지가 해제됐고 게임 시간이 81.183초까지 진행한 뒤 사망했다.
- 사망 화면의 `Play again`을 클릭하자 새 판이 시간 0, 질량 1.2, 진화 0개, 핵 미흡수 상태로 시작했다. W 입력으로 게임 시간이 전진했다. 성공 패널에는 `Start a new run` 버튼도 표시됐다. 새 판 초기화는 사망 화면의 버튼으로 확인했다.

## 영상과 기록

증거 경로는 `artifacts/20261116-latest-b5511e3/`다. 저장소의 기존 규칙에 따라 이 디렉터리는 로컬 산출물이다.

- `normal-input-with-game-audio.mp4`는 92.516초, 960×600의 HUD와 게임 음향을 담았다. 원본 화면 537장을 관찰 시각 순서대로 이었다. 캡처 간격 중앙값 0.141초, 최대 2.274초이며 캡처율은 평균 약 5.9장/초다. 이 수치는 실제 게임 렌더 FPS로 쓸 수 없다.
- 실제 게임 오디오는 같은 판의 `run-1-canvas.webm`에서 가져왔다. 이 원본은 DOM HUD를 제외한다. 시작 메뉴에서 첫 게임 화면으로 바뀌는 구간에 맞춰 오디오에 1.9초 지연을 적용했다. 프레임 단위 동기 오차는 측정하지 않았다.
- MP4와 성공 판 WebM 모두 전체 디코드를 실행해 오류 출력 0을 확인했다. MP4는 영상 538프레임을 읽었다. 영상 전체 구간을 3초 간격 화면과 주요 전환 PNG로 검토했다. 게임 오디오는 시작 메뉴 직후부터 마지막까지 10초 구간별 파형 레벨을 측정했고, 청취 검수는 도구의 오디오 입력 제한으로 수행하지 못했다.
- `run-1-final.png`는 성공 패널, `run-1-paused.png`는 정지, `run-1-after-resume.png`와 `run-1-restart.png`는 재개 후 사망과 새 판의 온보딩이다. 재개 확인과 새 판은 후속 실행에서 기록했다.
- `play.log`, `report.json`, `recheck.json`, `restart.json`, `video-timing.json`, `media-probe.json`, `audio-segments.txt`가 측정 근거다. `report.json`의 두 번째 판은 중단 전 로그·성공 PNG와 동일 페이지의 후속 관찰을 합쳐 기록했다.

## 실행 및 검수 범위

임시 서버 3040에서 `ego-browser nodejs < artifacts/20261116-latest-b5511e3/play.ego.mjs`를 실행했다. 후속 관찰과 재시작에는 같은 디렉터리의 `accretion-latest-recover.mjs`, `accretion-latest-restart.mjs`를 같은 방식으로 썼다. 스크립트에 들어간 작업 공간 ID와 임시 고정 사본 경로는 해당 실행값이다. 영상 인코딩은 `python3 artifacts/20261116-latest-b5511e3/encode.py artifacts/20261116-latest-b5511e3`와 아래 명령을 사용했다.

```sh
ffmpeg -i normal-input-to-success.mp4 -i run-1-canvas.webm \
  -map 0:v:0 -map 1:a:0 -af 'adelay=1900:all=1,apad' \
  -c:v copy -c:a aac -b:a 160k -t 92.516 -movflags +faststart \
  normal-input-with-game-audio.mp4
ffmpeg -v error -xerror -i normal-input-with-game-audio.mp4 \
  -fps_mode passthrough -enc_time_base 1:1000 -f null -
```

이전 iPhone Safari 실물의 이동·스킬 동시 사용은 오너가 정상 확인했다. Safari 주소창이 실제로 보일 때 하단 정지·음소거가 전부 노출되는지는 이번에도 미확인이다. 사용자 난이도와 유지율도 이 자동 플레이로 판단할 수 없다. 작업 공간과 임시 서버 소멸, 두 lease 해제는 `cleanup.txt`에 기록했다.
