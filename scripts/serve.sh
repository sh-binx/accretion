#!/usr/bin/env sh
# Serve the static game on the first FREE port in this project's range (3040-3044).
# Stays inside the assigned block; never overwrites a port already in use.
# usage: sh scripts/serve.sh [dir]   (default dir: repo root — 게임이 root에 있음)
START=3040; END=3044
DIR="${1:-.}"
P="$START"
while [ "$P" -le "$END" ]; do
  if ! lsof -iTCP:"$P" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "▶ serving $DIR on http://localhost:$P  (range $START-$END)"
    exec python3 -m http.server "$P" --directory "$DIR"
  fi
  P=$((P + 1))
done
echo "✗ no free port in $START-$END (all in use)" >&2
exit 1
