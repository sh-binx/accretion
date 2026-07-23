#!/usr/bin/env sh
# Run a command on the first FREE port in this project's range.
# Stays inside the assigned block; never overwrites a port already in use.
# The chosen port is appended as `-p <port>`.
# usage: sh scripts/dev.sh <start> <end> <cmd> [args...]
START="$1"; END="$2"; shift 2
P="$START"
while [ "$P" -le "$END" ]; do
  if ! lsof -iTCP:"$P" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "▶ $* -p $P  (range $START-$END)"
    exec "$@" -p "$P"
  fi
  P=$((P + 1))
done
echo "✗ no free port in $START-$END (all in use)" >&2
exit 1
