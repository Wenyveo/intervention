# Intervention — public SDK & MCP

Public, developer-facing clients for **Intervention**, an automated smart-contract
and code security scanner for **Robinhood Chain**. Scan contracts and code for
security issues from your app, agent, or CI — free, or pay-per-call with **x402
USDG** on Robinhood Chain.

These are **thin hosted clients**. They call the public Intervention API at
`https://interventionprotocol.io` over HTTPS and bundle no scanner engine, rules,
or server implementation.

- **Live:** https://interventionprotocol.io
- **Developers:** https://interventionprotocol.io/developers

## Packages

| Package | Install | Description |
|---------|---------|-------------|
| [`@interventiononchain/mcp`](packages/mcp) | `npx -y @interventiononchain/mcp@latest` | Model Context Protocol server for wallet-owning AI agents (Claude Desktop, Cursor, Cline) |
| [`@interventiononchain/sdk`](packages/sdk) | `npm i @interventiononchain/sdk` | TypeScript client for the Intervention API |

### MCP quick start (safe by default)

```bash
npx -y @interventiononchain/mcp@latest
```

```jsonc
// claude_desktop_config.json — free tools + manual payment (default; no wallet)
{
  "mcpServers": {
    "intervention": { "command": "npx", "args": ["-y", "@interventiononchain/mcp@latest"] }
  }
}
```

Paid tools default to **manual** mode: they return the exact x402 payment
requirement and **never sign or spend**. Automatic payment is strictly opt-in
(dedicated low-balance wallet, canonical host, and an explicit per-call
`confirmPayment: "pay-usdg"`). See [`packages/mcp/README.md`](packages/mcp/README.md).

### SDK quick start

```ts
import { InterventionClient } from "@interventiononchain/sdk";

const client = new InterventionClient({ baseUrl: "https://interventionprotocol.io" });
const result = await client.scanAddress({ address: "0x…", chain: "robinhood" });
console.log(result.score, result.grade);
```

## Development

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Each package builds and tests standalone with only public dependencies.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

MIT — see [LICENSE](LICENSE). Robinhood Chain / USDG only.
