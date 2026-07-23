# ACCRETION

교육형 3D 블랙홀 아케이드 (코드명 · 변경 가능).

**당신은 블랙홀이다.** 우주를 미끄러지며 먹어치워 커지되, 끊임없이 증발한다 — 멈추면 사라진다. Holey.io식 손맛 + **실제 천체물리를 게임 규칙으로**(호킹 복사 축소 타이머·질량 위계·조석 파괴·중력 렌징) + 3D 렌징 비주얼(2D 클론이 못 하는 것).

- 기획: [`accretion-wiki/design/concept.md`](accretion-wiki/design/concept.md)
- 경쟁 조사: [`accretion-wiki/research/competitive-2026-07-23.md`](accretion-wiki/research/competitive-2026-07-23.md)
- 스택: Three.js r128 (`index.html` 단일 파일 + `three.min.js`, nova-surge slice 파이프라인 재활용)
- 포트: 3040–3044 (`sh scripts/serve.sh` — 게임이 repo root)

## 플레이 (라이브)
**https://sh-binx.github.io/accretion/** — GitHub Pages가 이 리포 root의 `index.html`을 서빙.

## 개발
```bash
sh scripts/serve.sh            # 로컬 정적 서버 (http://localhost:3040)
node scripts/verify-p4.mjs     # 헤드리스 검증(서지·존) — 그 외 verify-*.mjs
```
- 배포 = **`git push` (별도 복사·데모 리포 없음 — Pages가 root를 직접 서빙)**
- DEV 훅: URL에 `?dev=1` → `window.__acc` (검증·측정용)

## 상태 (2026-07-23)
플레이 가능. **P1** 사운드·주스 · **P2** 콘텐츠 다양성(중성자별·펄서·라이벌 AI)+과학 코덱스 · **P3** 글로벌 리더보드(Supabase·안티치트) · **P4** 서지 대시+티어별 비주얼 존. 진행 로그·다음 계획 = [`accretion-wiki/log.md`](accretion-wiki/log.md).
