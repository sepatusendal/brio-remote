#!/usr/bin/env bash
# Installs the Brio agent as an auto-starting background service on macOS.
#
# Usage (on the client's Mac, after copying the binary + this script over):
#   ./install-macos.sh /path/to/brio-agent-darwin-arm64
#
# What it does:
#   1. Copies the binary to ~/Library/Application Support/BrioAgent/
#   2. Installs a launchd plist so it starts on login and restarts on crash
#   3. Starts it immediately
#
# To uninstall: launchctl unload the plist and delete the files (see
# bottom of this script for the exact commands).

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-agent-binary>"
  exit 1
fi

BINARY_SRC="$1"
INSTALL_DIR="$HOME/Library/Application Support/BrioAgent"
BINARY_DEST="$INSTALL_DIR/brio-agent"
PLIST_DEST="$HOME/Library/LaunchAgents/com.wiramodepohon.brio-agent.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Brio agent..."

mkdir -p "$INSTALL_DIR"
cp "$BINARY_SRC" "$BINARY_DEST"
chmod +x "$BINARY_DEST"

sed "s|__BINARY_PATH__|$BINARY_DEST|g" \
  "$SCRIPT_DIR/com.wiramodepohon.brio-agent.plist" > "$PLIST_DEST"

launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo "✅ Installed and started."
echo ""
echo "Logs: /tmp/brio-agent.log and /tmp/brio-agent.error.log"
echo ""
echo "First run will prompt for Screen Recording + Accessibility"
echo "permissions in System Settings > Privacy & Security — approve both,"
echo "then restart the agent:"
echo "  launchctl unload '$PLIST_DEST' && launchctl load '$PLIST_DEST'"
echo ""
echo "To uninstall later:"
echo "  launchctl unload '$PLIST_DEST'"
echo "  rm '$PLIST_DEST'"
echo "  rm -rf '$INSTALL_DIR'"
