/** Chains accepted by the address-scan endpoint. */
export const SUPPORTED_CHAINS = ["robinhood"] as const;

export type Chain = (typeof SUPPORTED_CHAINS)[number];

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

/** Input to {@link InterventionClient.scanAddress}. */
export interface ScanAddressInput {
  /** 0x-prefixed, 40 hex character contract address. */
  address: string;
  /** Chain the contract is deployed on. Defaults to `"robinhood"`. */
  chain?: Chain;
}

/** Successful response from `POST /api/v1/scan-address`. */
export interface ScanAddressResult {
  scanId: string;
  receiptUrl: string;
  score: number;
  grade: Grade;
  severityCounts: SeverityCounts;
  chain: Chain;
  /** Human-readable chain name, e.g. `"Robinhood Chain"`. */
  chainName: string;
  address: string;
  /** Evidence backing the receipt. Public receipt only; not written on-chain. */
  evidence: { type: "public_receipt"; onchain: false };
}
