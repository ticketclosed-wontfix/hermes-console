#!/usr/bin/env bash
# Verify that dist/index.html's referenced assets actually exist on disk.
# Runs as systemd ExecStartPre — fails the unit start if the bundle is
# inconsistent (partial build, mismatched asset hashes, truncated deploy).
#
# Rationale: a white screen from a hash-mismatched bundle is silent —
# the HTTP server returns 200 for both the HTML and the SPA-fallback
# HTML served in place of missing .js. Failing at service start forces
# the problem into systemd logs and status instead.
set -euo pipefail

DIST_DIR="${1:-/home/nick/projects/hermes-console/dist}"
INDEX="$DIST_DIR/index.html"

if [[ ! -f "$INDEX" ]]; then
  echo "verify-bundle: missing $INDEX" >&2
  exit 1
fi

missing=0
# Extract src="/..." and href="/..." values, then check each file exists.
# Only check /assets/* — third-party CDN refs etc. are ignored.
while IFS= read -r path; do
  file="$DIST_DIR$path"
  if [[ ! -f "$file" ]]; then
    echo "verify-bundle: referenced asset missing: $path" >&2
    missing=$((missing + 1))
  fi
done < <(grep -oE '(src|href)="/assets/[^"]+"' "$INDEX" \
          | sed -E 's/.*"(\/assets\/[^"]+)"/\1/' \
          | sort -u)

if [[ $missing -gt 0 ]]; then
  echo "verify-bundle: $missing missing asset(s) — refusing to start" >&2
  exit 1
fi

echo "verify-bundle: OK"
