# accretion-wiki — 기록 규칙 (LLM 위키 v2.1)

Karpathy LLM-wiki 패턴. "위키 = 코드베이스, LLM = 프로그래머". 프로젝트의 누적 지식(결정·설계·조사)을 여기 쌓는다.

## 스키마 (이 문서가 schema 문서 — index.md 상단에서 참조)

**3계층**: raw(원자료·조사 스냅샷) / wiki(정제 지식) / schema(이 규칙). 폴더:
- `design/` — 게임 루프·물리 규칙 매핑·튜닝·아키텍처
- `decisions/` — 방향을 정하는 결정(코어 메커닉·재미·과학 스코프·타깃)
- `research/` — 경쟁 조사·과학 사실(정확성=제품이므로 **출처 필수**)

## 불변 규칙 (코어)

- **index.md + log.md** 항상 유지. log는 **역시간순**(최신 위), grep 가능한 날짜 헤더.
- **사실마다 출처(citation)** — 특히 과학/경쟁 사실. 출처 없는 주장 금지.
- **supersession**: 확정 기록은 삭제하지 않는다 → `status: superseded` + 새 페이지 링크.
- **write-gate**: 코드·git로 자명한 것, 일회성 대화, 중복은 기록 안 함(부풀리기 금지).
- **6주 노화**: 미참조 항목은 축약/archive 제안.

## v2.1 델타

- **Confidence 태그**: 불확실·시효성 사실에 `(추정)` 또는 `(재확인 필요·YYYY-MM)`. 확인된 사실은 무표기.
- **Typed link(옵션)**: 관계가 의미를 가질 때만 `supersedes::` `depends::` `uses::` `contradicts::` [[link]]. 기본은 `[[link]]`.

## 배제 (부품 최소 — 재고 방지)

벡터 임베딩·별도 그래프DB·자동 감쇠 tiers **도입 안 함**. 대체: index.md+grep · `[[wikilink]]`+Obsidian 그래프뷰 · 6주 노화. 수천 페이지로 커져 검색이 실제 병목이 되면 재검토.

## 절차

기록 시: 해당 폴더에 페이지 생성/갱신 → `index.md`(신규 링크) + `log.md`(활동 한 줄) 반영. 원본(undefined-studio-wiki)의 표준이 진화하면 project-bootstrap 스킬과 동기.
