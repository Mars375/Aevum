#!/usr/bin/env bash
# Live the world a little every day, then publish it.
#
# This is what separates a demo from a place: the world advances whether or not
# anyone is watching. Run by a timer, it lives a bounded number of years per
# pass, re-indexes, and refreshes the container that serves the chronicle.
#
# Bounded on purpose. The free tier is a call budget, not a rate limit — a
# measurement this project paid for twice — so a pass that tries to live a
# century will spend the day's quota and leave nothing for tomorrow.
#
#   scripts/tend-world.sh [world-name] [years]
set -euo pipefail

cd "$(dirname "$0")/.."

WORLD="${1:-premier}"
YEARS="${2:-40}"
LOG_DIR="${ABS_LOG_DIR:-$HOME/.local/state/ai-battle-simulator}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/tend-$(date +%Y-%m-%d).log"

# One pass at a time. A second pass starting while the first still holds the
# journal would write years the engine never lived.
exec 9>"$LOG_DIR/tend.lock"
if ! flock -n 9; then
  echo "$(date -Is) une passe est deja en cours, on laisse faire" >>"$LOG"
  exit 0
fi

echo "$(date -Is) --- passe sur '$WORLD', $YEARS annees" >>"$LOG"

# Wall-clock belongs here and never in the journal: the world is deterministic
# and knows nothing of dates. This file is about the machine tending it, which
# is a different question and deserves a different place.
STATUS="worlds/status.json"
write_status() {
  printf '{\n  "ranAt": "%s",\n  "world": "%s",\n  "ok": %s,\n  "years": %s,\n  "error": %s\n}\n' \
    "$(date -Is)" "$WORLD" "$1" "$2" "$3" >"$STATUS"
}

if npm run --silent live -- --ticks "$YEARS" --world "$WORLD" >>"$LOG" 2>&1; then
  npm run --silent index-worlds >>"$LOG" 2>&1
  # The container serves ./worlds read-only from the host, so a new journal is
  # visible without rebuilding anything. Only the catalogue needs regenerating.
  write_status true "$YEARS" null
  echo "$(date -Is) passe terminee" >>"$LOG"
else
  # A pass that fails quietly is worse than no pass at all: the page would keep
  # showing a frozen world and say nothing. The status file is what lets the
  # chronicle admit it.
  write_status false 0 "\"la passe a echoue, voir $LOG\""
  npm run --silent index-worlds >>"$LOG" 2>&1 || true
  echo "$(date -Is) ECHEC — voir ci-dessus" >>"$LOG"
  exit 1
fi

# Keep a fortnight. Logs are for diagnosing the last failure, not for history —
# the journal is the history.
find "$LOG_DIR" -name 'tend-*.log' -mtime +14 -delete
