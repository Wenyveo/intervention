#!/usr/bin/env bash
# Audit tracked public source for raw 32-byte hex literals (0x + 64 hex).
#
#   HARD FAIL  — any such literal used as a private key / signer / payer / wallet
#                secret: assigned to a key-like variable (KEY=, privateKey,
#                secretKey, signer, payer, mnemonic, wallet…) or passed to a
#                wallet/account constructor (privateKeyToAccount, new Wallet,
#                mnemonicToAccount, fromPrivateKey…).
#   REPORT ONLY — every other 32-byte hex literal (transaction hashes, evidence
#                hashes, record IDs, non-secret cryptographic test vectors) is
#                listed separately and is NOT classified as a private key; it
#                does not fail the audit.
#
# Throwaway keys must be generated at runtime (packages/mcp/src/__tests__/_fixtures.ts).
# Classification uses the code content only (not the file path), so a path like
# src/wallet/… does not misclassify a hash literal. The patterns below are
# regexes, not literals, so this file never matches itself.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Indicators that a literal is used as a key / signer / payer / wallet secret.
KEYCTX='private[_-]?key|secret[_-]?key|signing[_-]?key|[A-Za-z0-9_]*_?key[[:space:]]*[=:]|signer|payer|mnemonic|seed[_-]?phrase|wallet|privateKeyToAccount|mnemonicToAccount|hdKey|fromPrivateKey|new[[:space:]]+Wallet|PAYER|SIGNER|PRIVATE_KEY'

hits=$(git grep -nIE '0x[0-9a-fA-F]{64}' -- . || true)
if [ -z "$hits" ]; then
  echo "OK: no 32-byte hex literals in tracked source."
  exit 0
fi

keyhits=""; otherhits=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  content=${line#*:}; content=${content#*:}          # strip "path:" and "line:"
  if printf '%s' "$content" | grep -iqE "$KEYCTX"; then
    keyhits+="$line"$'\n'
  else
    otherhits+="$line"$'\n'
  fi
done <<< "$hits"

status=0
if [ -n "$keyhits" ]; then
  echo "FAIL: private-key / signer / payer credential literal(s) (0x + 64 hex):"
  printf '%s' "$keyhits" | sed '/^$/d; s/^/  ✗ /'
  echo "  → Generate throwaway keys at runtime; never commit a key/signer/payer literal."
  status=1
fi
if [ -n "$otherhits" ]; then
  echo "INFO: other 32-byte hex literals (transaction/evidence hashes, record IDs, test vectors — NOT keys):"
  printf '%s' "$otherhits" | sed '/^$/d; s/^/  • /'
fi
if [ "$status" = 0 ]; then
  echo "OK: no private-key/signer/payer credential literals (any 32-byte hex above is non-secret)."
fi
exit $status
