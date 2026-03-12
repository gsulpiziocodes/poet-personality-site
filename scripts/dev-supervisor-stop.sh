#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .run/dev-supervisor.pid ]]; then
  echo "no supervisor pid file found"
  exit 0
fi

PID="$(cat .run/dev-supervisor.pid)"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" || true
  sleep 0.5
fi

rm -f .run/dev-supervisor.pid
echo "stopped dev supervisor"
