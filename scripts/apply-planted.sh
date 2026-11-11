#!/usr/bin/env bash
# Copy intentionally broken fixtures into src/ (for eval branch).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cp "$ROOT/eval/planted/src/search.js" "$ROOT/src/search.js"
cp "$ROOT/eval/planted/src/server.js" "$ROOT/src/server.js"
echo "Planted eval fixtures into src/"
