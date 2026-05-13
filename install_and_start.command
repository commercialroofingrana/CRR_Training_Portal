#!/bin/bash
# CRR Safety Training Portal — One-Click Installer & Launcher
# Double-click this file in Finder to install and start the portal.

PORTAL_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PORTAL_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       CRR Safety Training Portal — Setup             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Check for Node.js ─────────────────────────────────────────────────────────
NODE_PATH=""
for p in /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | sort -V | tail -1)/bin/node"; do
  if [ -x "$p" ]; then NODE_PATH="$p"; break; fi
done

# Also check PATH
if [ -z "$NODE_PATH" ] && command -v node &>/dev/null; then
  NODE_PATH="$(command -v node)"
fi

if [ -z "$NODE_PATH" ]; then
  echo "⚠️  Node.js is not installed."
  echo ""
  echo "Please install Node.js first:"
  echo "  1. Go to https://nodejs.org"
  echo "  2. Download the LTS version and install it"
  echo "  3. Double-click this file again after installing"
  echo ""
  read -p "Press Enter to open nodejs.org in your browser..."
  open "https://nodejs.org"
  exit 1
fi

NODE_DIR="$(dirname "$NODE_PATH")"
export PATH="$NODE_DIR:$PATH"
NPM_PATH="$NODE_DIR/npm"

echo "✅ Found Node.js: $($NODE_PATH --version)"
echo ""

# ── Install dependencies ───────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies (one-time setup)..."
  "$NPM_PATH" install
  echo ""
fi

# ── Start the server ───────────────────────────────────────────────────────────
echo "🚀 Starting CRR Training Portal..."
echo ""
echo "   Portal:  http://localhost:3000"
echo "   Admin:   http://localhost:3000/admin.html"
echo "   Password: CRR-Admin-2025"
echo ""
echo "   Share your network IP with team members so they can"
echo "   access training from their phones/tablets."
echo ""
echo "   Press Ctrl+C or close this window to stop the server."
echo ""

# Open the portal in the default browser after a short delay
(sleep 2 && open "http://localhost:3000") &

"$NODE_PATH" server.js
