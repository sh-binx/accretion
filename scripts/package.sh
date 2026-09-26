#!/bin/sh
# 포털 제출 패키지 — dist/accretion-submission.zip (index.html + three.min.js, zip 루트)
# 포털 빌드는 GitHub Pages 전용 메타(canonical·og·twitter·site_name)를 뺀다 — 포털 페이지에 외부 도메인 흔적을 남기지 않는다.
# 사용: sh scripts/package.sh   (끝에 압축을 풀어 띄우는 스모크 테스트까지 돈다 — 실패하면 종료코드 ≠ 0)
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/dist"; STAGE="$OUT/portal"; ZIP="$OUT/accretion-submission.zip"
rm -rf "$STAGE" "$ZIP"; mkdir -p "$STAGE"
python3 - "$ROOT/index.html" "$STAGE/index.html" <<'PY'
import sys,re
src=open(sys.argv[1],encoding='utf-8').read()
out=re.sub(r'^<link rel="canonical"[^\n]*\n','',src,flags=re.M)
out=re.sub(r'^<meta (property="og:[^"]*"|name="twitter:[^"]*")[^\n]*\n','',out,flags=re.M)
assert 'sh-binx.github.io' not in out.split('<script')[0], 'head still references github.io'
open(sys.argv[2],'w',encoding='utf-8').write(out)
print(f'  index.html  {len(src.encode())} → {len(out.encode())} bytes (Pages 메타 제거)')
PY
cp "$ROOT/three.min.js" "$STAGE/three.min.js"
( cd "$STAGE" && zip -q -X "$ZIP" index.html three.min.js )
echo "  ✓ $ZIP  ($(wc -c < "$ZIP" | tr -d ' ') bytes · $(unzip -l "$ZIP" | tail -1 | awk '{print $2}') files)"
node "$ROOT/scripts/verify-package.mjs" "$ZIP"
