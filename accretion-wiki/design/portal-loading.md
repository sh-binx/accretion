# 포털 로딩 완료 신호의 수명

2026-10-05 실측. `loadingStop`은 첫 렌더 완료를 알리는 신호이며, 프레임 루프 안에서 반복 전송하면 안 된다. 과거 구현은 매 프레임 별도 RAF를 예약해 SDK에 신호를 반복했다. 기존 portal 검사는 신호의 존재만 확인해 이 결함을 놓쳤다.

게임 준비(`loadingDone`)와 SDK 전달 완료(`loadingSent`)를 별도로 보관한다. 첫 성공 렌더가 준비를 표시하고, SDK가 늦게 도착하면 init이 미전달 신호를 재생한다. SDK 호출은 소유 객체에 붙인 채 실행하고, 성공 후만 전달 완료를 표시한다.

`verify-loading.mjs`는 실제 렌더 루프와 터치 가로 화면에서 SDK 도착 즉시/1500ms 지연을 검사한다. 수정 전 1.6초 동안 10회 전송되어 실패했고, 수정 후 각 1회·플레이 진입·JS 오류0을 확인했다. portal 23/23·제출 zip 11/11·저장소 normal/blocked/quota·긴 광고 계약 검증 통과.

CrazyGames QA에서 Loading Stop·Gameplay Start/Stop·Get Item 감지, 빠르게 진입한 실행의 로딩 3.9초·초기 0.3MB·총 0.9MB 확인. 제출 빌드 `c0a67576-af23-4d06-9b50-a7521c428513`은 Version History의 Active와 “currently live” 설명으로 확인했다.

10-04 신고 Android 단말의 로딩 문제와 이 결함의 인과는 미확정. 실물 Android/iOS·Microsoft Edge 검사는 QA에 No로 표시했다. 수정본 활성화는 Basic Launch의 Full Launch 전환을 뜻하지 않는다.

출처: 로컬 회귀 및 [CrazyGames 게임 상세](https://developer.crazygames.com/games/65da597c-d61a-4443-a2c2-8970e89069fa), 2026-10-05.
