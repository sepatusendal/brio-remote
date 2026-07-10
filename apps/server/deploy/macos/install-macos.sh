#!/usr/bin/env bash
# Installs the Brio server as an auto-starting background service on
# macOS, and builds the dashboard so the server can serve it directly.
#
# Usage:
#   ./install-macos.sh <your-brio-token>
#
# Run this from apps/server/deploy/macos/. After this, the whole app
# (server + dashboard, both) is reachable at http://<your-tailscale-ip>:3000
# from any device on your tailnet — nothing else needs to be running.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <your-brio-token>"
  echo "Pick any long random string — this is what the dashboard login screen asks for."
  exit 1
fi

BRIO_TOKEN="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$(cd "$SERVER_DIR/../dashboard" && pwd)"
NODE_PATH="$(command -v node)"
PLIST_DEST="$HOME/Library/LaunchAgents/com.wiramodepohon.brio-server.plist"

if [ -z "$NODE_PATH" ]; then
  echo "node not found on PATH — install Node.js first."
  exit 1
fi

echo "Building dashboard..."
( cd "$DASHBOARD_DIR" && npm install && npm run build )

echo "Installing server dependencies..."
( cd "$SERVER_DIR" && npm install --omit=dev )

echo "Registering launchd service..."
sed \
  -e "s|__NODE_PATH__|$NODE_PATH|g" \
  -e "s|__SERVER_INDEX_PATH__|$SERVER_DIR/src/index.js|g" \
  -e "s|__SERVER_DIR__|$SERVER_DIR|g" \
  -e "s|__BRIO_TOKEN__|$BRIO_TOKEN|g" \
  "$SCRIPT_DIR/com.wiramodepohon.brio-server.plist" > "$PLIST_DEST"

launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

TAILSCALE_IP=$(command -v tailscale >/dev/null 2>&1 && tailscale ip -4 2>/dev/null || echo "<run: tailscale ip -4>")

echo ""
echo "✅ Server installed and running in the background."
echo ""
echo "Access it from any device on your tailnet at:"
echo "  http://$TAILSCALE_IP:3000"
echo ""
echo "Login token: $BRIO_TOKEN"
echo ""
echo "Logs: /tmp/brio-server.log and /tmp/brio-server.error.log"
echo ""
echo "To uninstall:"
echo "  launchctl unload '$PLIST_DEST'"
echo "  rm '$PLIST_DEST'"
echo ""
echo "Note: if you edit dashboard code later, re-run 'npm run build' in"
echo "apps/dashboard and restart the service — the server serves whatever"
echo "is currently in apps/dashboard/dist."
