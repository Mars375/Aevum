#!/usr/bin/env bash
# Poser (ou retirer) le declencheur quotidien.
#
#   deploy/install-timer.sh          installe et demarre
#   deploy/install-timer.sh --remove retire tout
set -euo pipefail

UNITS="$HOME/.config/systemd/user"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ "${1:-}" = "--remove" ]; then
  systemctl --user disable --now ai-battle-world.timer 2>/dev/null || true
  rm -f "$UNITS/ai-battle-world.timer" "$UNITS/ai-battle-world.service"
  systemctl --user daemon-reload
  echo "Declencheur retire. Le monde n'avancera plus que sur commande."
  exit 0
fi

mkdir -p "$UNITS"
install -m 644 "$HERE/ai-battle-world.service" "$HERE/ai-battle-world.timer" "$UNITS/"
systemctl --user daemon-reload
systemctl --user enable --now ai-battle-world.timer

# Sans linger, un timer utilisateur s'arrete des la fin de la session — et le
# monde cesserait d'avancer sans que rien ne le dise.
if ! loginctl show-user "$USER" 2>/dev/null | grep -q "Linger=yes"; then
  echo "ATTENTION : le linger n'est pas actif, le timer ne tournera pas sans session ouverte."
  echo "Corriger avec : sudo loginctl enable-linger $USER"
fi

systemctl --user list-timers ai-battle-world.timer --no-pager
