#!/usr/bin/env bash
# Screenshot the deployed player at several widths.
#
# The system chromium never completes on this Raspberry Pi — it times out
# whatever flags it is given. Playwright's bundled headless_shell does work, so
# that is what this uses. This is what finally closed QA defect D6, which had
# stood since the first audit with the honest note that nobody had ever seen
# these interfaces.
#
#   scripts/screenshot.sh [url] [outdir]
set -euo pipefail

URL="${1:-http://localhost:8088/}"
OUT="${2:-/tmp/abs-shots}"
SHELL_BIN="$HOME/.cache/ms-playwright/chromium_headless_shell-1234/chrome-linux/headless_shell"

[ -x "$SHELL_BIN" ] || { echo "headless_shell introuvable: $SHELL_BIN" >&2; exit 1; }
mkdir -p "$OUT"

for w in 375 900 1440; do
  "$SHELL_BIN" --no-sandbox --disable-gpu --disable-dev-shm-usage --hide-scrollbars \
    --virtual-time-budget=6000 --window-size="$w,1000" \
    --screenshot="$OUT/shot-$w.png" "$URL" >/dev/null 2>&1
  echo "  $w px -> $OUT/shot-$w.png"
done
