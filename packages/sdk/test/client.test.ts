import { describe, it, expect } from "vitest";
import {
  InterventionClient,
  InterventionApiError,
  InterventionValidationError,
  InterventionTimeoutError,
  type ScanAddressResult,
} from "../src/index.js";

const VALID_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

const OK_RESULT: ScanAddressResult = {
  scanId: "abc123",
  receiptUrl: "https://api.example.com/r/abc123",
  score: 88,
  grade: "B",
  severityCounts: { critical: 0, high: 1, medium: 2, low: 3, info: 4, total: 10 },
  chain: "robinhood",
  chainName: "Robinhood Chain",
  address: VALID_ADDRESS,
  evidence: { type: "public_receipt", onchain: false },
};

function fetchReturning(
  status: number,
  bodyObj: unknown,
  capture?: (url: string, init: RequestInit) => void,
): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    capture?.(String(url), init ?? {});
    return new Response(bodyObj === undefined ? "" : JSON.stringify(bodyObj), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("InterventionClient", () => {
  it("requires a baseUrl", () => {
    // @ts-expect-error intentionally missing baseUrl
    expect(() => new InterventionClient({})).toThrow(InterventionValidationError);
  });

  it("rejects a malformed address before any request", async () => {
    let called = false;
    const client = new InterventionClient({
      baseUrl: "https://api.example.com",
      fetch: fetchReturning(200, OK_RESULT, () => {
        called = true;
      }),
    });
    await expect(client.scanAddress({ address: "0x1234" })).rejects.toBeInstanceOf(
      InterventionValidationError,
    );
    expect(called).toBe(false);
  });

  it("rejects a chain other than robinhood", async () => {
    let called = false;
    const client = new InterventionClient({
      baseUrl: "https://api.example.com",
      fetch: fetchReturning(200, OK_RESULT, () => {
        called = true;
      }),
    });
    await expect(
      // @ts-expect-error invalid chain literal
      client.scanAddress({ address: VALID_ADDRESS, chain: "ethereum" }),
    ).rejects.toBeInstanceOf(InterventionValidationError);
    expect(called).toBe(false);
  });

  it("POSTs to /api/v1/scan-address with bearer auth and returns a typed result", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const client = new InterventionClient({
      baseUrl: "https://api.example.com/", // trailing slash should be trimmed
      apiKey: "test-key",
      fetch: fetchReturning(200, OK_RESULT, (url, init) => {
        captured = { url, init };
      }),
    });
    const result = await client.scanAddress({
      address: VALID_ADDRESS,
      chain: "robinhood",
    });

    expect(captured?.url).toBe("https://api.example.com/api/v1/scan-address");
    expect(captured?.init.method).toBe("POST");
    const headers = captured?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");
    expect(JSON.parse(String(captured?.init.body))).toEqual({
      address: VALID_ADDRESS,
      chain: "robinhood",
    });
    expect(result.grade).toBe("B");
    expect(result.score).toBe(88);
    expect(result.severityCounts.total).toBe(10);
    expect(result.chainName).toBe("Robinhood Chain");
    expect(result.evidence).toEqual({ type: "public_receipt", onchain: false });
  });

  it("defaults the chain to robinhood when omitted", async () => {
    let captured: RequestInit | undefined;
    const client = new InterventionClient({
      baseUrl: "https://api.example.com",
      fetch: fetchReturning(200, OK_RESULT, (_url, init) => {
        captured = init;
      }),
    });
    await client.scanAddress({ address: VALID_ADDRESS });
    expect(JSON.parse(String(captured?.body))).toEqual({
      address: VALID_ADDRESS,
      chain: "robinhood",
    });
  });

  it("omits the Authorization header when no apiKey is given", async () => {
    let captured: RequestInit | undefined;
    const client = new InterventionClient({
      baseUrl: "https://api.example.com",
      fetch: fetchReturning(200, OK_RESULT, (_url, init) => {
        captured = init;
      }),
    });
    await client.scanAddress({ address: VALID_ADDRESS });
    const headers = captured?.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it("maps a non-2xx response to InterventionApiError with the status and message", async () => {
    const client = new InterventionClient({
      baseUrl: "https://api.example.com",
      fetch: fetchReturning(401, { error: "Missing or invalid API key" }),
    });
    await expect(
      client.scanAddress({ address: VALID_ADDRESS }),
    ).rejects.toMatchObject({
      name: "InterventionApiError",
      status: 401,
      message: "Missing or invalid API key",
    });
    expect(InterventionApiError).toBeDefined();
  });

  it("throws InterventionTimeoutError when the request is aborted", async () => {
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      })) as unknown as typeof fetch;

    const client = new InterventionClient({
      baseUrl: "https://api.example.com",
      timeoutMs: 10,
      fetch: hangingFetch,
    });
    await expect(
      client.scanAddress({ address: VALID_ADDRESS }),
    ).rejects.toBeInstanceOf(InterventionTimeoutError);
  });
});
