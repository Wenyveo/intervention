# @interventiononchain/mcp

Intervention Security as a **Model Context Protocol** server for wallet-owning AI
agents on **Robinhood Chain**. Give Claude Desktop, Cursor, Cline, or any MCP
client the ability to scan smart contracts and code for security issues — free,
or pay-per-call with **x402 USDG** on Robinhood Chain.

It is a **thin hosted client**: it only calls the public Intervention API
(`https://interventionprotocol.io`) over HTTPS. It never bundles the scanner
engine, proprietary rules, contracts, or any secret.

```bash
npx -y @interventiononchain/mcp@latest
```

## Tools

| Tool | Payment | What it does |
|------|---------|--------------|
| `intervention_scan_code` | free | Scan a source snippet (Solidity, Vyper, general) |
| `intervention_scan_address` | free | Scan a deployed Robinhood Chain contract by address |
| `intervention_guard` | free | Read-only Guard preflight (allow / review / block) |
| `intervention_paid_scan_code` | 0.01 USDG | Paid hosted code scan via x402 |
| `intervention_paid_scan_address` | 0.01 USDG | Paid verified-source address scan via x402 |
| `intervention_agent_identity` | free | The canonical live agent card |

## Payments — safe by default (manual)

Paid tools default to **manual** mode: they return the exact payment requirement
and **never sign or spend**. Nothing is paid unless you explicitly opt in.

```jsonc
// claude_desktop_config.json — free + manual-payment (default, no wallet)
{
  "mcpServers": {
    "intervention": { "command": "npx", "args": ["-y", "@interventiononchain/mcp@latest"] }
  }
}
```

Calling a paid tool in manual mode returns the requirement (network `eip155:4663`,
canonical USDG, the Intervention treasury, and the exact amount) so your agent can
decide. It does not pay.

## Automatic payment (opt-in)

Automatic payment requires **all** of:

1. `INTERVENTION_PAYMENT_MODE=auto`
2. a dedicated, **low-balance** payer wallet key in `INTERVENTION_PAYER_PRIVATE_KEY`
3. the canonical host `https://interventionprotocol.io` (auto is disabled on any override / localhost)
4. an explicit **per-call** `confirmPayment: "pay-usdg"` argument on the tool call

```jsonc
{
  "mcpServers": {
    "intervention": {
      "command": "npx",
      "args": ["-y", "@interventiononchain/mcp@latest"],
      "env": {
        "INTERVENTION_PAYMENT_MODE": "auto",
        "INTERVENTION_PAYER_PRIVATE_KEY": "0x<dedicated low-balance agent wallet>"
      }
    }
  }
}
```

Then, and only then, a call like `intervention_paid_scan_address({ address, confirmPayment: "pay-usdg" })`
authorizes **exactly one** USDG payment.

### Security

- **Use a dedicated, low-balance wallet** funded with only a little USDG — never a
  treasury, admin, or production wallet.
- **Never commit a private key** to source control or paste it anywhere public.
  The key is read from the environment, is never logged, and never appears in tool
  output or errors.
- Every 402 is validated against a fixed policy **before** signing: scheme `exact`,
  network `eip155:4663`, canonical USDG, the Intervention treasury, the
  `Global Dollar` / version `1` EIP-712 domain, and the **exact** amount
  (10,000 atomic for scans). The official client's spend controls independently
  cap the asset and amount. Any deviation is rejected before the signer runs.
- Payments settle only after a successful scan; a failed scan is never charged.

## Environment

| Var | Default | Purpose |
|-----|---------|---------|
| `INTERVENTION_API_URL` | `https://interventionprotocol.io` | API host (auto-pay only against the apex) |
| `INTERVENTION_PAYMENT_MODE` | `manual` | `manual` or `auto` |
| `INTERVENTION_PAYER_PRIVATE_KEY` | — | dedicated payer wallet (auto only) |
| `INTERVENTION_ROBINHOOD_RPC_URL` | — | optional; signing needs no RPC |
| `INTERVENTION_API_KEY` | — | optional bearer for the free-tier limiter |

## License

MIT. Robinhood Chain / USDG only.
