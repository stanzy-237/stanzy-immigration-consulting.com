#!/usr/bin/env bash
# Adds the Vercel Observability monitors in docs/ops/monitors.json (#164) to
# the linked project, skipping any whose name already exists. Monitors are
# live as soon as they're added (no draft). To change one: edit the JSON,
# `vercel monitors remove <id>`, run this again.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=stanzy-immigration-consulting-com
MONITORS=docs/ops/monitors.json
existing="$(vercel monitors ls 2>/dev/null || true)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

count=$(python3 -c "import json; print(len(json.load(open('$MONITORS'))))")
for i in $(seq 0 $((count - 1))); do
  python3 -c "import json,sys; json.dump(json.load(open('$MONITORS'))[$i], open('$tmp/m.json','w'))"
  name=$(python3 -c "import json; print(json.load(open('$tmp/m.json'))['name'])")
  if grep -qF "$name" <<<"$existing"; then
    echo "= $name (already there)"
  else
    vercel monitors add --project "$PROJECT" --body "$tmp/m.json"
  fi
done
