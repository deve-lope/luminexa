#!/usr/bin/env bash
# Create gitignored Docker env files from templates (safe to run multiple times).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

copy_if_missing() {
  local src="$1"
  local dest="$2"
  if [[ -f "$dest" ]]; then
    echo "exists: $dest"
  else
    cp "$src" "$dest"
    echo "created: $dest"
  fi
}

copy_if_missing env/docker.prod-local.example .env.docker.prod
copy_if_missing env/docker.dev.example .env.docker.dev

echo ""
echo "Docker env ready. See env/README.md for which file each compose stack uses."
