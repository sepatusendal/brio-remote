#!/usr/bin/env bash
# Double-click this file in Finder to install Brio Agent — no need to
# open Terminal manually. macOS runs .command files on double-click.
#
# Expects a brio-agent binary (any name starting with "brio-agent") to be
# in this same folder.

cd "$(dirname "$0")"

echo "=================================="
echo "  Brio Agent Installer"
echo "  Made by Wira Mode Pohon"
echo "=================================="
echo ""

BINARY=$(find . -maxdepth 1 -type f -name "brio-agent*" ! -name "*.command" ! -name "*.sh" ! -name "*.plist" | head -1)

if [ -z "$BINARY" ]; then
  echo "❌ Couldn't find the brio-agent binary in this folder."
  echo "Make sure it was downloaded alongside this installer."
  echo ""
  read -p "Press Enter to close..."
  exit 1
fi

chmod +x "$BINARY"
./install-macos.sh "$BINARY"

echo ""
echo "Done! You can close this window now."
read -p "Press Enter to close..."
