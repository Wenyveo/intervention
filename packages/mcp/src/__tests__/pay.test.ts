import { describe, it, expect, vi, afterEach } from "vitest";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import { loadConfig, POLICY } from "../config.js";
import { paidCall } from "../pay.js";

const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const USDG = POLICY.usdg;
const TREASURY = POLICY.treasury;
const WRONG_ASSET = "0x1111111111111111111111111111111111111111";
const URL = POLICY.apex + "/api/v1/scan-address";

function paymentRequired(over: Partial<{ asset: string; amount: string; network: string; payTo: string }> = {}) {
  return {
    x402Version: 2, error: "Payment Required",
    resource: { url: URL, description: "scan", mimeType: "application/json" },
    accepts: [{ scheme: "exact", network: over.network ?? "eip155:4663", asset: over.asset ?? USDG, amount: over.amount ?? "10000", payTo: over.payTo ?? TREASURY, maxTimeoutSeconds: 300, extra: { name: "Global Dollar", version: "1", decimals: 6 } }],
  };
}

/** Mock server: canonical 402 until a PAYMENT-SIGNATURE arrives, then 200 + PAYMENT-RESPONSE. */
function mockServer(pr: object) {
  const calls: { signed: boolean; sig: string | null }[] = [];
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    const sig = (init?.headers as Record<string, string> | undefined)?.["PAYMENT-SIGNATURE"] ?? null;
    calls.push({ signed: !!sig, sig });
    if (sig) {
      const settle = { success: true, transaction: "0xLIVE", network: "eip155:4663", payer: "0xpayer" };
      return new Response(JSON.stringify({ scanId: "z", score: 99 }), { status: 200, headers: { "content-type": "application/json", "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(settle)).toString("base64") } });
    }
    return new Response(JSON.stringify(pr), { status: 402, headers: { "content-type": "application/json", "PAYMENT-REQUIRED": encodePaymentRequiredHeader(pr as never) } });
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

afterEach(() => vi.unstubAllGlobals());

const manualCfg = loadConfig({} as never);
const autoCfg = loadConfig({ INTERVENTION_PAYMENT_MODE: "auto", INTERVENTION_PAYER_PRIVATE_KEY: KEY } as never);

describe("MCP paidCall (canonical x402 v2, official client)", () => {
  it("MANUAL: returns the requirement and NEVER signs", async () => {
    const { calls } = mockServer(paymentRequired());
    const r = await paidCall(manualCfg, "/api/v1/scan-address", { address: USDG, chain: "robinhood" }, "scan");
    expect(r.paid).toBe(false);
    expect(r.requiresConfirmation).toBe(true);
    expect(calls.every((c) => !c.signed)).toBe(true); // no signature was ever sent
  });

  it("AUTO without confirmPayment: still does NOT sign", async () => {
    const { calls } = mockServer(paymentRequired());
    const r = await paidCall(autoCfg, "/api/v1/scan-address", { address: USDG, chain: "robinhood" }, "scan");
    expect(r.paid).toBe(false);
    expect(r.requiresConfirmation).toBe(true);
    expect(calls.some((c) => c.signed)).toBe(false);
  });

  it("AUTO + confirmPayment:pay-usdg: signs once with PAYMENT-SIGNATURE → 200 + settlement", async () => {
    const { calls } = mockServer(paymentRequired());
    const r = await paidCall(autoCfg, "/api/v1/scan-address", { address: USDG, chain: "robinhood" }, "scan", "pay-usdg");
    expect(r.paid).toBe(true);
    expect(r.http).toBe(200);
    expect(r.settlement?.success).toBe(true);
    expect(r.settlement?.transaction).toBe("0xLIVE");
    expect(calls.filter((c) => c.signed).length).toBe(1); // exactly one signed retry
  });

  it("rejects wrong asset BEFORE signing", async () => {
    const { calls } = mockServer(paymentRequired({ asset: WRONG_ASSET }));
    const r = await paidCall(autoCfg, "/api/v1/scan-address", { address: USDG, chain: "robinhood" }, "scan", "pay-usdg");
    expect(r.rejected).toBe(true);
    expect(calls.some((c) => c.signed)).toBe(false);
  });

  it("rejects wrong amount (would over/under charge) BEFORE signing", async () => {
    const { calls } = mockServer(paymentRequired({ amount: "20000" }));
    const r = await paidCall(autoCfg, "/api/v1/scan-address", { address: USDG, chain: "robinhood" }, "scan", "pay-usdg");
    expect(r.rejected).toBe(true);
    expect(r.reason).toMatch(/amount/i);
    expect(calls.some((c) => c.signed)).toBe(false);
  });

  it("rejects wrong network / payTo BEFORE signing", async () => {
    for (const over of [{ network: "eip155:1" }, { payTo: "0x2222222222222222222222222222222222222222" }]) {
      const { calls } = mockServer(paymentRequired(over));
      const r = await paidCall(autoCfg, "/api/v1/scan-address", { address: USDG, chain: "robinhood" }, "scan", "pay-usdg");
      expect(r.rejected).toBe(true);
      expect(calls.some((c) => c.signed)).toBe(false);
      vi.unstubAllGlobals();
    }
  });

  it("never leaks the payer private key in the returned result", async () => {
    mockServer(paymentRequired());
    const r = await paidCall(autoCfg, "/api/v1/scan-address", { address: USDG, chain: "robinhood" }, "scan", "pay-usdg");
    expect(JSON.stringify(r)).not.toContain(KEY);
    expect(JSON.stringify(r)).not.toContain(KEY.slice(2));
  });
});
