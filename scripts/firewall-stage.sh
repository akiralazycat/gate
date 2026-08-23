#!/usr/bin/env bash
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is required. Install/login first, then run this script again." >&2
  exit 1
fi

if [ ! -f .vercel/project.json ]; then
  echo "This repository is not linked to a Vercel project. Run: vercel link" >&2
  exit 1
fi

ensure_rule() {
  local name="$1"
  shift
  if vercel firewall rules inspect "$name" --json >/dev/null 2>&1; then
    echo "Firewall rule already exists: $name"
  else
    "$@"
  fi
}

ensure_rule "Gate unlock observe" \
  vercel firewall rules add "Gate unlock observe" \
    --description "Observe repeated Gate unlock attempts before enforcement." \
    --condition '{"type":"path","op":"eq","value":"/api/gate/unlock"}' \
    --condition '{"type":"method","op":"eq","value":"POST"}' \
    --action rate_limit \
    --rate-limit-window 60 \
    --rate-limit-requests 60 \
    --rate-limit-keys ip \
    --rate-limit-action log \
    --yes

ensure_rule "Gate code admin observe" \
  vercel firewall rules add "Gate code admin observe" \
    --description "Observe repeated Gate access-code issuance requests before enforcement." \
    --condition '{"type":"path","op":"eq","value":"/api/gate/codes"}' \
    --condition '{"type":"method","op":"eq","value":"POST"}' \
    --action rate_limit \
    --rate-limit-window 60 \
    --rate-limit-requests 20 \
    --rate-limit-keys ip \
    --rate-limit-action log \
    --yes

echo
echo "Draft firewall changes:"
vercel firewall diff

echo
echo "Nothing was published. Review docs/FIREWALL.md and production traffic before running 'vercel firewall publish --yes'."
