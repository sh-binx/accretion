# Ports — accretion

대역: **3040–3044** (정적 Three.js 게임 서버)

`scripts/serve.sh` 가 이 대역에서 **비어있는 첫 포트를 자동 선택**한다 — 점유된 포트는 건드리지 않는다.

## 실행
```bash
sh scripts/serve.sh          # 3040–3044 중 첫 빈 포트로 정적 서버 (게임=repo root, 보통 http://localhost:3040)
```

| 용도 | 포트 | 비고 |
|---|---|---|
| dev 정적 서버 | 3040–3044 중 첫 빈 포트 | `scripts/serve.sh <dir>` (python http.server, 자동 선택) |
| e2e/헤드리스 검증 | dev 서버 재사용 | Playwright + SwiftShader GL 플래그 |

## 동작
- `serve.sh` 가 `lsof` 로 LISTEN 중인 포트를 건너뛰고 첫 빈 포트에서 `python3 -m http.server` 실행.
- 대역이 다 차면 에러로 멈춤 — 다른 포트/프로젝트를 덮어쓰지 않음.
- 번들러(vite 등) 도입 시 `scripts/dev.sh 3040 3044 <cmd>` 표준 포트픽커 사용.
