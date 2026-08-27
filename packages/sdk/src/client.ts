import {
  InterventionApiError,
  InterventionError,
  InterventionTimeoutError,
  InterventionValidationError,
} from "./errors.js";
import {
  SUPPORTED_CHAINS,
  type Chain,
  type ScanAddressInput,
  type ScanAddressResult,
} from "./types.js";

export interface InterventionClientOptions {
  /** URL of an Intervention API deployment, e.g. `"https://interventionprotocol.io"`. Required. */
  baseUrl: string;
  /** API key sent as `Authorization: Bearer <apiKey>`. Optional (some deployments use other auth). */
  apiKey?: string;
  /** Per-request timeout in milliseconds. Default `30000`. */
  timeoutMs?: number;
  /** Custom `fetch` implementation. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Minimal network client for the Intervention contract-scanning API.
 *
 * It performs typed requests, validates input, applies a timeout, and maps
 * non-2xx responses to {@link InterventionApiError}. It contains no scanning
 * logic — all analysis happens server-side at the configured `baseUrl`.
 */
export class InterventionClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: InterventionClientOptions) {
    if (
      !options ||
      typeof options.baseUrl !== "string" ||
      options.baseUrl.trim() === ""
    ) {
      throw new InterventionValidationError("baseUrl is required");
    }
    this.baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== "function") {
      throw new InterventionValidationError(
        "No fetch implementation available; pass options.fetch",
      );
    }
    this.fetchImpl = f;
  }

  /** Scan a deployed, source-verified contract by address. */
  async scanAddress(input: ScanAddressInput): Promise<ScanAddressResult> {
    if (!input || !ADDRESS_RE.test((input.address ?? "").trim())) {
      throw new InterventionValidationError(
        "address must be a 0x-prefixed, 40 hex character string",
      );
    }
    const chain: Chain = input.chain ?? "robinhood";
    if (!SUPPORTED_CHAINS.includes(chain)) {
      throw new InterventionValidationError(
        "Only Robinhood Chain is supported at launch.",
      );
    }
    return this.post<ScanAddressResult>("/api/v1/scan-address", {
      address: input.address.trim(),
      chain,
    });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new InterventionTimeoutError(this.timeoutMs);
      }
      throw new InterventionError(
        `network request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: unknown;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }

    if (!res.ok) {
      const message =
        json && typeof (json as { error?: unknown }).error === "string"
          ? (json as { error: string }).error
          : `HTTP ${res.status}`;
      throw new InterventionApiError(res.status, message);
    }

    return json as T;
  }
}
