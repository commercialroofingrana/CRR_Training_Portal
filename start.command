#!/bin/bash
# CRR Safety Training Portal — Quick Start (run after first-time install)
PORTAL_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PORTAL_DIR"

NODE_PATH=""
for p in /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | sort -V | tail -1)/bin/node"; do
  if [ -x "$p" ]; then NODE_PATH="$p"; break; fi
done
if [ -z "$NODE_PATH" ] && command -v node &>/dev/null; then NODE_PATH="$(command -v node)"; fi

if [ -z "$NODE_PATH" ]; then
  echo "Node.js not found. Run install_and_start.command first."
  read -p "Press Enter to exit..."
  exit 1
fi

export PATH="$(dirname $NODE_PATH):$PATH"
(sleep 2 && open "http://localhost:3000") &
"$NODE_PATH" server.js
