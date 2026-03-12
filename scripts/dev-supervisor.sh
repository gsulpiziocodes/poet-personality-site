#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p .run

while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] starting dev server" | tee -a .run/dev-supervisor.log
  npm run dev >> .run/dev-supervisor.log 2>&1 || true
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] dev server exited; restarting in 1s" | tee -a .run/dev-supervisor.log
  sleep 1
done
