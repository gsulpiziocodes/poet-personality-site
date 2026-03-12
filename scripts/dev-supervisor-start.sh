#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p .run

if [[ -f .run/dev-supervisor.pid ]]; then
  PID="$(cat .run/dev-supervisor.pid)"
  if kill -0 "$PID" 2>/dev/null; then
    echo "dev supervisor already running (pid $PID)"
    exit 0
  fi
fi

nohup bash scripts/dev-supervisor.sh >/dev/null 2>&1 &
PID=$!
echo "$PID" > .run/dev-supervisor.pid

echo "started dev supervisor (pid $PID)"
echo "logs: $ROOT_DIR/.run/dev-supervisor.log"
