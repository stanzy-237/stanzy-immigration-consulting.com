#!/usr/bin/env bash
# Stages the Vercel Firewall rules in docs/ops/firewall-rules.json (#163) on
# the linked project, skipping any whose name already exists, then shows the
# draft. Publish it with `vercel firewall publish` once the diff looks right.
# To change a rule: edit the JSON, remove the rule in the dashboard (or
# `vercel firewall rules remove "<name>"`), and run this again.
set -euo pipefail
cd "$(dirname "$0")/.."

RULES=docs/ops/firewall-rules.json
existing="$(vercel firewall rules list 2>/dev/null || true)"

count=$(python3 -c "import json,sys; print(len(json.load(open('$RULES'))))")
for i in $(seq 0 $((count - 1))); do
  rule=$(python3 -c "import json,sys; print(json.dumps(json.load(open('$RULES'))[$i]))")
  name=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['name'])" "$rule")
  if grep -qF "$name" <<<"$existing"; then
    echo "= $name (already there)"
  else
    echo "+ $name"
    vercel firewall rules add --data "$rule" --yes
  fi
done

vercel firewall diff
