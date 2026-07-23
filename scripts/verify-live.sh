#!/bin/bash
# 라이브 배포 검증 표준 파이프라인 (검증 규약 1·5조 구현)
# 사용: scripts/verify-live.sh <URL> <필수 패턴(ERE)> [금지 패턴(ERE)]
# 규약: ① 빌드 게이팅은 호출측에서 `tsc && build && push && verify-live` 체인으로
#      ② 패턴은 SSR 주석(<!-- -->) 경계를 피해 클래스명·단일 표현식 덩어리로 잡는다
set -u
URL="$1"; MUST="$2"; BAN="${3:-}"
for i in $(seq 1 8); do
  H=$(curl -sL "${URL}$([[ "$URL" == *\?* ]] && echo '&' || echo '?')v=$(date +%s)")
  OK=$(echo "$H" | grep -Ec "$MUST" || true)
  BAD=0; [ -n "$BAN" ] && BAD=$(echo "$H" | grep -Ec "$BAN" || true)
  echo "try$i: must=$OK ban=$BAD"
  if [ "$OK" -ge 1 ] && [ "$BAD" -eq 0 ]; then echo "✓ live-verified: $URL"; exit 0; fi
  sleep 50
done
echo "✗ verify timeout: $URL — Vercel list_deployments로 빌드 상태 확인할 것"; exit 1
