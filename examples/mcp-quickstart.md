# MCP quick start

## Free tools (no wallet)

```jsonc
{ "mcpServers": { "intervention": { "command": "npx", "args": ["-y", "@interventiononchain/mcp@latest"] } } }
```

Tools: `intervention_scan_code`, `intervention_scan_address`, `intervention_guard`,
`intervention_agent_identity`, plus the paid tools (`intervention_paid_scan_code`,
`intervention_paid_scan_address`) which in the default **manual** mode only return
the payment requirement — they never sign.

## Automatic payment (opt-in)

Use a **dedicated, low-balance** agent wallet — never a treasury or production key.
Never commit a private key.

```jsonc
{
  "mcpServers": {
    "intervention": {
      "command": "npx",
      "args": ["-y", "@interventiononchain/mcp@latest"],
      "env": {
        "INTERVENTION_PAYMENT_MODE": "auto",
        "INTERVENTION_PAYER_PRIVATE_KEY": "0x<dedicated low-balance wallet>"
      }
    }
  }
}
```

Then a call like `intervention_paid_scan_address({ address, confirmPayment: "pay-usdg" })`
authorizes exactly one 0.01 USDG payment on Robinhood Chain.
