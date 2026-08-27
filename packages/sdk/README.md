# @interventiononchain/sdk

Thin TypeScript client for the **Intervention** contract-scanning API. It sends
typed requests to an Intervention API deployment, validates input, applies a
timeout, and returns typed results. All analysis runs server-side — this package
contains no scanning logic or rules.

> **Beta.** `0.1.0-beta.2` is an early preview released under the `beta` dist-tag.
> The API surface may change before `1.0.0`. Install explicitly with `@beta`.

Robinhood Chain is the only supported chain at launch.

## Install

```bash
npm install @interventiononchain/sdk@beta
```

Requires Node.js 18+ (uses the global `fetch`).

## Configure

The client requires a `baseUrl` (the address of an Intervention API deployment)
and, for authenticated endpoints, an `apiKey` sent as a Bearer token.

```ts
import { InterventionClient } from "@interventiononchain/sdk";

const client = new InterventionClient({
  baseUrl: process.env.INTERVENTION_API_URL!, // e.g. "https://your-deployment"
  apiKey: process.env.INTERVENTION_API_KEY,   // optional, sent as Authorization: Bearer
  timeoutMs: 30_000,                          // optional (default 30s)
});
```

`baseUrl` is never hard-coded by the SDK — you always supply it.

## Scan a deployed contract

```ts
import { InterventionClient, InterventionApiError } from "@interventiononchain/sdk";

const client = new InterventionClient({
  baseUrl: process.env.INTERVENTION_API_URL!,
  apiKey: process.env.INTERVENTION_API_KEY,
});

try {
  const result = await client.scanAddress({
    address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", // WETH on Robinhood Chain
    chain: "robinhood", // the only supported chain at launch
  });

  console.log(result.grade, result.score);      // e.g. "B" 88
  console.log(result.chainName);                 // "Robinhood Chain"
  console.log(result.severityCounts);            // { critical, high, medium, low, info, total }
  console.log(result.receiptUrl);                // public receipt
  console.log(result.evidence);                  // { type: "public_receipt", onchain: false }
} catch (err) {
  if (err instanceof InterventionApiError) {
    // Non-2xx from the API (e.g. 401 auth, 402 payment, 404 unverified source, 429 rate limit)
    console.error(err.status, err.message);
  } else {
    throw err;
  }
}
```

The `chain` field defaults to `"robinhood"`, so it can be omitted:

```ts
const result = await client.scanAddress({
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", // USDG on Robinhood Chain
});
```

You can look up any Robinhood Chain address on the explorer at
[robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com).

## Result shape

`scanAddress` resolves to a typed `ScanAddressResult`:

```ts
{
  scanId: string;
  receiptUrl: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  severityCounts: {
    critical: number; high: number; medium: number;
    low: number; info: number; total: number;
  };
  chain: "robinhood";
  chainName: string;                 // "Robinhood Chain"
  address: string;
  evidence: { type: "public_receipt"; onchain: false };
}
```

## Errors

All errors extend `InterventionError`:

- `InterventionValidationError` — bad input (missing `baseUrl`, malformed address, unsupported chain); thrown before any request.
- `InterventionApiError` — the API returned a non-2xx response; carries `status` and the server `message`.
- `InterventionTimeoutError` — the request exceeded `timeoutMs`.

## What this is (and isn't)

- A small HTTP client for a documented, versioned endpoint (`POST /api/v1/scan-address`).
- It reports whatever the configured deployment returns; it does not itself audit,
  guarantee, or certify any contract. Results are informational, not a security guarantee.

## License

MIT — see [LICENSE](./LICENSE).
