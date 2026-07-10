#!/usr/bin/env bash
# Installs the Brio agent as an auto-starting background service on Linux,
# using a systemd --user unit (no root required for the service itself).
#
# Usage:
#   ./install-linux.sh /path/to/brio-agent-linux-amd64
#
# What it does:
#   1. Copies the binary to ~/.local/bin/brio-agent
#   2. Installs + enables a systemd --user unit that starts on login and
#      restarts on crash
#   3. Tries to enable "lingering" so it can start even without an active
#      login session (needs sudo; screen capture still needs an active
#      graphical session regardless, so this mostly helps the WS connection
#      / heartbeat stay alive)

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-agent-binary>"
  exit 1
fi

BINARY_SRC="$1"
INSTALL_DIR="$HOME/.local/bin"
BINARY_DEST="$INSTALL_DIR/brio-agent"
SYSTEMD_DIR="$HOME/.config/systemd/user"
SERVICE_DEST="$SYSTEMD_DIR/brio-agent.service"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Brio agent..."

mkdir -p "$INSTALL_DIR" "$SYSTEMD_DIR"
cp "$BINARY_SRC" "$BINARY_DEST"
chmod +x "$BINARY_DEST"

sed "s|%h/.local/bin/brio-agent|$BINARY_DEST|" \
  "$SCRIPT_DIR/brio-agent.service" > "$SERVICE_DEST"

systemctl --user daemon-reload
systemctl --user enable --now brio-agent.service

if loginctl enable-linger "$USER" 2>/dev/null; then
  echo "Linger enabled — service can start even before login."
else
  echo "Note: couldn't enable linger (needs sudo: 'sudo loginctl enable-linger \$USER')."
  echo "Without it, the agent only runs while this user is logged in — fine for"
  echo "most desktop use, just something to know."
fi

echo ""
echo "✅ Installed and started."
echo ""
echo "Logs: journalctl --user -u brio-agent -f"
echo ""
echo "Note: screen capture needs an active graphical session (X11/Xwayland)."
echo "If this machine's DISPLAY isn't :0, edit:"
echo "  $SERVICE_DEST"
echo "then: systemctl --user daemon-reload && systemctl --user restart brio-agent"
echo ""
echo "To uninstall:"
echo "  systemctl --user disable --now brio-agent"
echo "  rm '$SERVICE_DEST' '$BINARY_DEST'"
