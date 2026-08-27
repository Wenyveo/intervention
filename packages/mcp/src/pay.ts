/**
 * Canonical x402 v2 paid flow for the MCP, using ONLY the official client
 * packages (@x402/fetch client + @x402/evm scheme/signer + @x402/core codecs +
 * viem account). No hand-rolled EIP-712 signing.
 *
 * Security: default is manual (return the requirement, never sign). Auto payment
 * requires an explicit `confirmPayment: "pay-usdg"`, a dedicated payer key, and
 * the canonical apex host. Every requirement is validated against POLICY BEFORE a
 * signature is created, and the official client's spend controls independently
 * cap the asset/amount. The payer private key is never logged, returned, or
 * placed in any error.
 */
import { x402Client } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader, decodePaymentResponseHeader } from "@x402/core/http";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { POLICY, validateRequirement, type Config, type Requirement } from "./config.js";

/** Redact anything that looks like a private key from any string we might surface. */
function sanitize(s: string): string {
  return s.replace(/0x[0-9a-fA-F]{64}/g, "0x<redacted>");
}

type Kind = "scan" | "review";

export interface PaidResult {
  paid: boolean;
  mode?: string;
  http?: number;
  requiresConfirmation?: boolean;
  rejected?: boolean;
  reason?: string;
  paymentRequirement?: unknown;
  resource?: unknown;
  instruction?: string;
  result?: unknown;
  settlement?: { success?: boolean; transaction?: string; network?: string } | null;
  error?: string;
  note?: string;
}

export async function paidCall(cfg: Config, path: string, body: unknown, kind: Kind, confirmPayment?: string): Promise<PaidResult> {
  const url = cfg.apiUrl + path;
  const expected = POLICY.amounts[kind];

  // 1. Unpaid request → expect a canonical 402.
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (res.status !== 402) {
    const data = await res.json().catch(() => null);
    return { paid: false, http: res.status, result: data, note: res.status < 400 ? "server did not require payment" : "server returned an error" };
  }

  // 2. Decode the canonical PAYMENT-REQUIRED (header preferred; JSON body fallback).
  const prHeader = res.headers.get("PAYMENT-REQUIRED");
  let paymentRequired: { accepts?: Requirement[]; resource?: unknown } | null = null;
  try {
    paymentRequired = prHeader ? (decodePaymentRequiredHeader(prHeader) as never) : await res.json();
  } catch {
    return { paid: false, error: "could not decode the PAYMENT-REQUIRED response" };
  }
  const req = paymentRequired?.accepts?.[0];

  // 3. Validate against the fixed policy BEFORE any signing.
  const v = validateRequirement(req, expected);
  if (!v.ok) return { paid: false, rejected: true, reason: v.reason, paymentRequirement: req };

  // 4. Manual mode / no confirmation / auto not allowed → return the requirement, DO NOT SIGN.
  if (!cfg.autoAllowed || confirmPayment !== "pay-usdg") {
    return {
      paid: false,
      mode: cfg.mode,
      requiresConfirmation: true,
      paymentRequirement: {
        scheme: req!.scheme, network: req!.network, asset: req!.asset, amount: req!.amount,
        payTo: req!.payTo, domain: { name: req!.extra?.name, version: req!.extra?.version }, facilitator: POLICY.facilitator,
      },
      resource: paymentRequired?.resource,
      instruction: cfg.mode === "auto"
        ? "Auto mode is enabled. Re-call this tool with confirmPayment:\"pay-usdg\" to authorize this exact USDG payment."
        : "Manual payment mode (default). To pay: set INTERVENTION_PAYMENT_MODE=auto, provide a dedicated low-balance INTERVENTION_PAYER_PRIVATE_KEY, target https://interventionprotocol.io, and pass confirmPayment:\"pay-usdg\".",
    };
  }

  // 5. AUTO: sign with the official client (spend controls cap asset+amount), retry with PAYMENT-SIGNATURE.
  let sigHeader: string;
  try {
    const account = privateKeyToAccount(cfg.payerKey as `0x${string}`);
    const rh = { id: POLICY.chainId, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [cfg.rpcUrl] } } } as const;
    const signer = toClientEvmSigner(account, createPublicClient({ chain: rh, transport: http(cfg.rpcUrl) }));
    const client = new x402Client()
      .register(POLICY.network, new ExactEvmScheme(signer))
      .setSpendControls({ allowedAssets: [{ network: POLICY.network, asset: POLICY.usdg, maxAmountPerPayment: expected }] });
    const payload = await client.createPaymentPayload(paymentRequired as never);
    sigHeader = encodePaymentSignatureHeader(payload);
  } catch (e) {
    return { paid: false, error: "payment authorization failed (spend controls or signing)", note: sanitize(e instanceof Error ? e.message : String(e)) };
  }

  const paidRes = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "PAYMENT-SIGNATURE": sigHeader },
    body: JSON.stringify(body),
  });
  const result = await paidRes.json().catch(() => null);
  let settlement: PaidResult["settlement"] = null;
  const respHeader = paidRes.headers.get("PAYMENT-RESPONSE");
  if (respHeader) {
    try {
      const s = decodePaymentResponseHeader(respHeader) as { success?: boolean; transaction?: string; network?: string };
      settlement = { success: s.success, transaction: s.transaction, network: s.network };
    } catch { /* ignore */ }
  }
  return { paid: paidRes.status === 200 && settlement?.success === true, http: paidRes.status, result, settlement };
}
