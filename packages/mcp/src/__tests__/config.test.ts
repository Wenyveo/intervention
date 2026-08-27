import { describe, it, expect } from "vitest";
import { loadConfig, validateRequirement, POLICY } from "../config.js";

// throwaway test key (secp256k1 private key = 1); never a real wallet, never used on-chain.
const KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe("MCP config + payment-mode gating", () => {
  it("defaults to manual", () => {
    expect(loadConfig({} as never).mode).toBe("manual");
  });

  it("auto is effective ONLY against the apex host with a payer key", () => {
    const base = { INTERVENTION_PAYMENT_MODE: "auto", INTERVENTION_PAYER_PRIVATE_KEY: KEY };
    // apex + key → auto
    expect(loadConfig({ ...base } as never).mode).toBe("auto");
    // auto requested but no key → manual
    expect(loadConfig({ INTERVENTION_PAYMENT_MODE: "auto" } as never).mode).toBe("manual");
    // localhost override forces manual even with a key
    expect(loadConfig({ ...base, INTERVENTION_API_URL: "http://localhost:3000" } as never).mode).toBe("manual");
    // a non-apex host disables auto
    expect(loadConfig({ ...base, INTERVENTION_API_URL: "https://evil.example" } as never).mode).toBe("manual");
  });

  it("never exposes the payer key on the config", () => {
    const cfg = loadConfig({ INTERVENTION_PAYMENT_MODE: "auto", INTERVENTION_PAYER_PRIVATE_KEY: KEY } as never);
    expect(JSON.stringify({ ...cfg, payerKey: undefined })).not.toContain(KEY);
  });
});

describe("validateRequirement — fixed Robinhood/USDG/Primer/treasury/amount policy", () => {
  const good = {
    scheme: "exact", network: "eip155:4663", asset: POLICY.usdg, amount: "10000",
    payTo: POLICY.treasury, maxTimeoutSeconds: 300, extra: { name: "Global Dollar", version: "1", decimals: 6 },
  };

  it("accepts an exact-policy scan requirement", () => {
    expect(validateRequirement(good, "10000").ok).toBe(true);
  });

  it("requires the EXACT amount (10000 scan / 20000 review)", () => {
    expect(validateRequirement({ ...good, amount: "20000" }, "10000").ok).toBe(false);
    expect(validateRequirement({ ...good, amount: "20000" }, "20000").ok).toBe(true);
    expect(validateRequirement({ ...good, amount: "9999" }, "10000").ok).toBe(false);
  });

  it("rejects wrong network / asset / payTo / scheme / domain", () => {
    expect(validateRequirement({ ...good, network: "eip155:1" }, "10000").ok).toBe(false);
    expect(validateRequirement({ ...good, asset: "0x1111111111111111111111111111111111111111" }, "10000").ok).toBe(false);
    expect(validateRequirement({ ...good, payTo: "0x2222222222222222222222222222222222222222" }, "10000").ok).toBe(false);
    expect(validateRequirement({ ...good, scheme: "upto" }, "10000").ok).toBe(false);
    expect(validateRequirement({ ...good, extra: { name: "USDG", version: "1" } }, "10000").ok).toBe(false);
    expect(validateRequirement({ ...good, extra: { name: "Global Dollar", version: "2" } }, "10000").ok).toBe(false);
    expect(validateRequirement(undefined, "10000").ok).toBe(false);
  });
});
