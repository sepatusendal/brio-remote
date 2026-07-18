#!/usr/bin/env bash
# Builds a standalone Brio agent binary for the CURRENT machine's OS/arch.
#
# IMPORTANT: because the agent uses cgo (robotgo needs a C compiler for
# mouse/keyboard control), this must be run natively on a machine matching
# your target OS — you can't reliably cross-compile "GOOS=windows" from a
# Mac and get a working binary. If you need Windows/Linux builds, use
# .github/workflows/build-agent.yml instead (runs on real OS-native CI
# runners for each platform).
#
# Usage:
#   BRIO_TOKEN=... ./build.sh                              # bake in the access token (required — the
#                                                            # server rejects any agent without it)
#   BRIO_SERVER_URL=wss://... BRIO_TOKEN=... ./build.sh    # also bake in a default server URL

set -euo pipefail

cd "$(dirname "$0")"

OUT_DIR="dist"
mkdir -p "$OUT_DIR"

OS=$(go env GOOS)
ARCH=$(go env GOARCH)
OUT="$OUT_DIR/brio-agent-$OS-$ARCH"

if [ "$OS" = "windows" ]; then
  OUT="$OUT.exe"
fi

echo "Building for $OS/$ARCH..."

LDFLAGS=""
if [ -n "${BRIO_SERVER_URL:-}" ]; then
  echo "Baking in default server URL: $BRIO_SERVER_URL"
  LDFLAGS="-X main.defaultServerURL=$BRIO_SERVER_URL"
fi
if [ -n "${BRIO_TOKEN:-}" ]; then
  echo "Baking in access token"
  LDFLAGS="$LDFLAGS -X main.defaultAccessToken=$BRIO_TOKEN"
else
  echo "⚠️  BRIO_TOKEN not set — this binary will refuse to start until BRIO_TOKEN"
  echo "   is set in its environment. Set BRIO_TOKEN when building to bake it in instead."
fi

CGO_ENABLED=1 go build -ldflags "$LDFLAGS" -o "$OUT" .

echo "✅ Built: $OUT"
echo ""
echo "Give this file to the target machine. They just double-click it (or"
echo "run it from Terminal) — no Go installation needed on their end."
