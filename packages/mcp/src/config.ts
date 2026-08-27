/**
 * Fixed Robinhood Chain / USDG / Primer / treasury policy — hard-coded, never
 * overridable by a server response or a tool argument. The MCP validates every
 * 402 requirement against this before a signature is ever created.
 */
export const POLICY = {
  scheme: "exact",
  network: "eip155:4663",
  chainId: 4663,
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  treasury: "0xd50d87Fe12Dd9bD020bF440a10D7A933E90A99f2",
  domainName: "Global Dollar",
  domainVersion: "1",
  usdgDecimals: 6,
  facilitator: "https://x402.primer.systems", // Primer only
  apex: "https://interventionprotocol.io",
  /** EXACT atomic USDG per paid tool (caps are a backstop; amount must match exactly). */
  amounts: { scan: "10000", review: "20000" }, // $0.01 / $0.02
} as const;

export type PaymentMode = "manual" | "auto";

export interface Config {
  apiUrl: string;
  /** Requested vs. effective mode. Auto is only effective against the apex with a payer key. */
  requestedMode: PaymentMode;
  mode: PaymentMode;
  autoAllowed: boolean;
  hasPayer: boolean;
  isApex: boolean;
  isLocalhost: boolean;
  /** RPC is optional — the EIP-712 domain comes from the 402 `extra`, so signing needs no RPC. */
  rpcUrl: string;
  /** never logged, never returned. */
  payerKey: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiUrl = (env.INTERVENTION_API_URL ?? POLICY.apex).replace(/\/+$/, "");
  const requestedMode: PaymentMode = env.INTERVENTION_PAYMENT_MODE === "auto" ? "auto" : "manual";
  const payerKey = env.INTERVENTION_PAYER_PRIVATE_KEY?.trim() || undefined;
  const isApex = apiUrl === POLICY.apex;
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(apiUrl);
  // Automatic payment is ONLY allowed against the canonical apex with a payer key.
  // A localhost override is permitted for development but forces manual (no signing).
  const autoAllowed = requestedMode === "auto" && isApex && !!payerKey;
  const mode: PaymentMode = autoAllowed ? "auto" : "manual";
  return {
    apiUrl,
    requestedMode,
    mode,
    autoAllowed,
    hasPayer: !!payerKey,
    isApex,
    isLocalhost,
    rpcUrl: env.INTERVENTION_ROBINHOOD_RPC_URL?.trim() || "https://rpc.invalid",
    payerKey,
  };
}

export interface Requirement {
  scheme?: string;
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
  maxTimeoutSeconds?: number;
  extra?: { name?: string; version?: string; decimals?: number };
}

/** Reject unless the requirement matches the fixed policy EXACTLY (incl. exact amount). */
export function validateRequirement(req: Requirement | undefined, expectedAmount: string):
  { ok: true } | { ok: false; reason: string } {
  if (!req) return { ok: false, reason: "no payment requirement in 402" };
  if (req.scheme !== POLICY.scheme) return { ok: false, reason: `scheme must be '${POLICY.scheme}', got '${req.scheme}'` };
  if (req.network !== POLICY.network) return { ok: false, reason: `network must be ${POLICY.network}, got '${req.network}'` };
  if ((req.asset ?? "").toLowerCase() !== POLICY.usdg.toLowerCase()) return { ok: false, reason: "asset is not the canonical Robinhood Chain USDG" };
  if ((req.payTo ?? "").toLowerCase() !== POLICY.treasury.toLowerCase()) return { ok: false, reason: "payTo is not the Intervention treasury" };
  if ((req.extra?.name ?? "") !== POLICY.domainName) return { ok: false, reason: "EIP-712 domain name is not 'Global Dollar'" };
  if (String(req.extra?.version ?? "") !== POLICY.domainVersion) return { ok: false, reason: "EIP-712 domain version is not '1'" };
  if (String(req.amount) !== expectedAmount) return { ok: false, reason: `amount must be exactly ${expectedAmount} atomic USDG, got '${req.amount}'` };
  return { ok: true };
}
