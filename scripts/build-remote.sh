#!/usr/bin/env bash
# Triggers the cross-platform agent build on GitHub Actions and downloads
# the result — no need to open the GitHub website at all.
#
# Requires the GitHub CLI (https://cli.github.com), already authenticated
# (`gh auth login` once, if you haven't).
#
# Usage:
#   ./build-remote.sh windows ws://100.84.122.109:3000
#   ./build-remote.sh linux ws://100.84.122.109:3000
#   ./build-remote.sh macos ws://100.84.122.109:3000

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <windows|linux|macos> <server-url>"
  echo "Example: $0 windows ws://100.84.122.109:3000"
  exit 1
fi

PLATFORM="$1"
SERVER_URL="$2"

case "$PLATFORM" in
  windows) ARTIFACT="brio-agent-windows-amd64.exe" ;;
  linux)   ARTIFACT="brio-agent-linux-amd64" ;;
  macos)   ARTIFACT="brio-agent-darwin-arm64" ;;
  *) echo "Unknown platform: $PLATFORM (use windows, linux, or macos)"; exit 1 ;;
esac

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI not found. Install it: brew install gh"
  echo "Then: gh auth login"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "Triggering build (server_url=$SERVER_URL)..."
gh workflow run build-agent.yml -f server_url="$SERVER_URL"

echo "Waiting for the run to appear..."
sleep 5
RUN_ID=$(gh run list --workflow=build-agent.yml --limit=1 --json databaseId --jq '.[0].databaseId')

echo "Watching run $RUN_ID (this takes a couple minutes)..."
gh run watch "$RUN_ID" --exit-status

echo "Downloading $ARTIFACT..."
mkdir -p downloaded
gh run download "$RUN_ID" -n "$ARTIFACT" -D downloaded

if [ "$PLATFORM" = "windows" ]; then
  echo "Downloading BrioAgentSetup.exe (proper GUI installer)..."
  gh run download "$RUN_ID" -n "BrioAgentSetup.exe" -D downloaded || \
    echo "(installer artifact not found — fine if this run predates the installer step)"
fi

echo ""
echo "✅ Done."
if [ "$PLATFORM" = "windows" ] && [ -f "downloaded/BrioAgentSetup.exe" ]; then
  echo "Send downloaded/BrioAgentSetup.exe to the client — they just double-click it."
  echo "(downloaded/$ARTIFACT is also there if you ever need the raw binary instead.)"
else
  echo "Send downloaded/$ARTIFACT to the client's machine and run the platform installer."
fi
