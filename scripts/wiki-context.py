#!/usr/bin/env python3
"""SessionStart hook — accretion-wiki 컨텍스트 자동 주입.

매 세션 시작 시 위키의 index.md와 최근 log.md 일부를 읽어
hookSpecificOutput.additionalContext 로 세션 컨텍스트에 주입한다.
이렇게 해서 작업 중 프로젝트의 누적 지식(결정·아키텍처·서비스)을 항상 활용할 수 있다.

stdout 은 반드시 단일 JSON. 실패해도 세션을 막지 않도록 항상 exit 0.
"""
import json
import os
import sys

LOG_TAIL_LINES = 40  # 최근 로그 줄 수


def read_text(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return ""


def main() -> None:
    project = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    wiki = os.path.join(project, "accretion-wiki")
    index = read_text(os.path.join(wiki, "index.md"))
    log = read_text(os.path.join(wiki, "log.md"))

    if not index and not log:
        # 위키가 없으면 조용히 통과 (컨텍스트 추가 없음)
        print(json.dumps({}))
        return

    log_tail = "\n".join(log.splitlines()[:LOG_TAIL_LINES]) if log else ""

    context = (
        "# accretion-wiki (auto-loaded project knowledge)\n\n"
        "이 프로젝트는 LLM-wiki 패턴으로 결정·아키텍처·서비스 지식을 누적한다. "
        "작업 중 이 지식을 활용하고, 중요한 새 정보(결정/아키텍처/서비스 변화)가 나오면 "
        "`accretion-wiki/`에 기록하라(규칙: accretion-wiki/CLAUDE.md, "
        "또는 /wiki-ingest). 깊이 보려면 해당 페이지를 직접 읽어라.\n\n"
        "## Wiki Index\n" + index.strip() + "\n\n"
        "## Recent activity (log head)\n" + log_tail.strip() + "\n"
    )

    out = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context,
        }
    }
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 — 훅은 절대 세션을 막지 않는다
        print(json.dumps({"_error": str(exc)}))
    sys.exit(0)
