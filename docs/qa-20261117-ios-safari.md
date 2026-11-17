# 11-17 iOS Safari 추가 검수

제품 75b97e5 기반 공개 URL https://sh-binx.github.io/accretion/ 를 iPhone 17 / iOS 27.2 Simulator에서 실제 Safari UI로 확인했다. 실물 기기 결과와 구분한다.

- Safari 주소창이 보이는 가로 화면에서 시작, 하단 소리·정지·3개 스킬 표시와 정지 진입 확인.
- 세로 Safari 메뉴 → 공유 → View More → Add to Home Screen → Open as Web App 켜짐을 확인하고 설치. 홈 화면 아이콘 실행 뒤 가로 전환에서 주소창 없이 시작·플레이·일시정지 정상, 하단 조작 버튼 스크롤 없이 전부 보임.
- 설치 안내는 현재 Open as Web App 옵션을 명시하지 않는다. 기본 ON을 확인했으나 OFF 사용자를 위해 조건 문구 보강 후보로 기록한다.
- 홈 화면 앱은 Safari 탭과 다른 저장 공간이었다(탭 Codex 1/39, 설치 앱 0/39). 기존 기록이 자동 승계된다고 안내하면 안 된다.
- 조이스틱 실물 멀티터치는 이번 시험 대상 아님. 이전 사용자 동시 이동·스킬 성공 회신과 별도.

## 엔진 비교

iOS 26.2 iPhone 16e Simulator에서는 WebKit 프로세스의 JSRopeString / DFG 크래시와 반복 페이지 오류가 났다. 동일 공개 자산의 iOS 27.2 Safari와 설치 앱은 정상 실행했다. 실제 iOS 26.2 기기 결함으로 단정하지 않는다. 상세 진단 /tmp/accretion-ios-crash-diagnosis-20261117.md.

## 증거

- artifacts/ios-safari-20261117/ios27-landscape-pause.png
- artifacts/ios-safari-20261117/ios27-add-web-app.png
- artifacts/ios-safari-20261117/ios27-home-screen-play.png
- artifacts/ios-safari-20261117/safari-repeated-problem.png (26.2)

Simulator 정상 Quit 후 booted 기기 빈 목록·Simulator 프로세스 소멸 확인, 검수 기기 lease 해제. 실물 iPhone 설정은 변경하지 않았다.
