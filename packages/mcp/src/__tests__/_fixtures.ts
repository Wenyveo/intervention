/**
 * Deterministic test fixtures, generated at runtime.
 *
 * The repository must never commit a raw private-key-shaped literal (0x followed
 * by 64 hex chars) — see scripts/audit-key-literals.sh. So the tests build their
 * throwaway signing key at runtime instead of hard-coding one.
 */

/**
 * A deterministic throwaway signing key (secp256k1 private key = 1), materialized
 * at runtime. Never a real wallet, never used on-chain, never logged. Returned as
 * a 0x-prefixed hex string so it can drive the same signing paths a real key would.
 */
export function testPayerKey(): `0x${string}` {
  const hex = (1n).toString(16).padStart(64, "0");
  return `0x${hex}`;
}
