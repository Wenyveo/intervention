#!/usr/bin/env bash
# Fail if any raw private-key-shaped literal (0x + 64 hex) is committed to tracked
# source, tests, fixtures, examples, docs, or workflows.
#
# Runtime-generated keys are fine (see packages/mcp/src/__tests__/_fixtures.ts);
# committed key-shaped literals are not. The search below is a regex
# (0x[0-9a-fA-F]{64}), not a literal, so this file never matches itself.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if git grep -nIE '0x[0-9a-fA-F]{64}' -- . ; then
  echo
  echo "ERROR: private-key-shaped literal(s) found above (0x + 64 hex)."
  echo "Generate throwaway keys at runtime instead of committing them."
  exit 1
fi
echo "OK: no 0x+64hex literals in tracked source."
