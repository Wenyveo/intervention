/**
 * @interventiononchain/mcp — Intervention Security as a Model Context Protocol
 * server for wallet-owning AI agents on Robinhood Chain.
 *
 * Thin HOSTED client: it only calls the public Intervention API over HTTPS. It
 * never bundles or imports the scanner engine, proprietary rules, contracts, or
 * any secret.
 *
 * Tools:
 *   intervention_scan_code       — free hosted code scan
 *   intervention_scan_address    — free, rate-limited Robinhood Chain address scan
 *   intervention_guard           — read-only Guard preflight for an address
 *   intervention_paid_scan_code  — paid hosted code scan via x402 USDG
 *   intervention_paid_scan_address — paid verified-source address scan via x402 USDG
 *   intervention_agent_identity  — the canonical live agent card
 *
 * Payments are canonical x402 v2 (Robinhood Chain USDG only). Default mode is
 * MANUAL: paid tools return the payment requirement and never sign. See README.
 *   INTERVENTION_API_URL           (default https://interventionprotocol.io)
 *   INTERVENTION_PAYMENT_MODE      (manual | auto; default manual)
 *   INTERVENTION_PAYER_PRIVATE_KEY (dedicated low-balance agent wallet; auto only)
 *   INTERVENTION_ROBINHOOD_RPC_URL (optional; signing needs none)
 *   INTERVENTION_API_KEY           (optional bearer for the free-tier limiter)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig, POLICY } from "./config.js";
import { paidCall } from "./pay.js";

const cfg = loadConfig();

// ── HTTP helpers (free tier) ──────────────────────────────────────────────────

const API_KEY = process.env.INTERVENTION_API_KEY ?? "";
function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", "user-agent": "interventiononchain-mcp/0.1.0" };
  if (API_KEY) h["authorization"] = `Bearer ${API_KEY}`;
  return h;
}

async function getJSON(path: string): Promise<{ http: number; data: unknown }> {
  const r = await fetch(cfg.apiUrl + path, { headers: headers() });
  return { http: r.status, data: await r.json().catch(() => null) };
}
async function postJSON(path: string, body: unknown): Promise<{ http: number; data: unknown }> {
  const r = await fetch(cfg.apiUrl + path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  return { http: r.status, data: await r.json().catch(() => null) };
}

interface ToolResponse extends CallToolResult { [x: string]: unknown }
function ok(obj: unknown): ToolResponse { return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] }; }
function err(msg: string): ToolResponse { return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true }; }

const isAddress = (a: unknown): a is string => typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);

// ── Tools ─────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "intervention_scan_code",
    description: "Free hosted security scan of a source-code snippet (Solidity, Vyper, and general languages). No payment. Returns findings, score, and grade.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Raw source code to scan." },
        language: { type: "string", description: "e.g. solidity, vyper, javascript. Optional but improves results." },
      },
      required: ["code"],
    },
  },
  {
    name: "intervention_scan_address",
    description: "Free, rate-limited security scan of a deployed Robinhood Chain contract by 0x address (verified source via Blockscout). No payment.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string", description: "0x contract address on Robinhood Chain." } },
      required: ["address"],
    },
  },
  {
    name: "intervention_guard",
    description: "Read-only Guard preflight for a Robinhood Chain contract address — a fast allow/review/block signal. No payment, no signing.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string", description: "0x contract address on Robinhood Chain." } },
      required: ["address"],
    },
  },
  {
    name: "intervention_paid_scan_code",
    description: "Paid hosted code scan via x402 (exactly 0.01 USDG on Robinhood Chain). MANUAL by default: returns the payment requirement without signing. With auto mode enabled, pass confirmPayment:\"pay-usdg\" to authorize exactly one payment.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Raw source code to scan." },
        filename: { type: "string", description: "e.g. Vault.sol (optional)." },
        confirmPayment: { type: "string", description: "Set to \"pay-usdg\" to authorize the exact USDG payment (auto mode only)." },
      },
      required: ["source"],
    },
  },
  {
    name: "intervention_paid_scan_address",
    description: "Paid verified-source scan of a Robinhood Chain contract via x402 (exactly 0.01 USDG). MANUAL by default: returns the payment requirement without signing. With auto mode enabled, pass confirmPayment:\"pay-usdg\" to authorize exactly one payment.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "0x contract address on Robinhood Chain." },
        confirmPayment: { type: "string", description: "Set to \"pay-usdg\" to authorize the exact USDG payment (auto mode only)." },
      },
      required: ["address"],
    },
  },
  {
    name: "intervention_agent_identity",
    description: "Return the canonical live Intervention agent card (capabilities, pricing, x402 payment details, discovery URLs).",
    inputSchema: { type: "object", properties: {} },
  },
];

async function runScanCode(args: { code?: string; language?: string }): Promise<ToolResponse> {
  if (!args.code) return err("Missing required field: code");
  const { http, data } = await postJSON("/api/playground", { code: args.code, language: args.language ?? "solidity" });
  return http < 400 ? ok(data) : err(`scan failed (HTTP ${http}): ${JSON.stringify(data)}`);
}

async function runScanAddress(args: { address?: string }): Promise<ToolResponse> {
  if (!isAddress(args.address)) return err("Provide a valid 0x contract address (40 hex chars).");
  const { http, data } = await postJSON("/api/playground/scan-address", { address: args.address, chain: "robinhood" });
  return http < 400 ? ok(data) : err(`scan failed (HTTP ${http}): ${JSON.stringify(data)}`);
}

async function runGuard(args: { address?: string }): Promise<ToolResponse> {
  if (!isAddress(args.address)) return err("Provide a valid 0x contract address (40 hex chars).");
  const { http, data } = await getJSON(`/api/guard/robinhood-chain/${args.address}`);
  return http < 400 ? ok(data) : err(`guard failed (HTTP ${http}): ${JSON.stringify(data)}`);
}

async function runPaidScanCode(args: { source?: string; filename?: string; confirmPayment?: string }): Promise<ToolResponse> {
  if (!args.source) return err("Missing required field: source");
  return ok(await paidCall(cfg, "/api/v1/scan", { source: args.source, filename: args.filename }, "scan", args.confirmPayment));
}

async function runPaidScanAddress(args: { address?: string; confirmPayment?: string }): Promise<ToolResponse> {
  if (!isAddress(args.address)) return err("Provide a valid 0x contract address (40 hex chars).");
  return ok(await paidCall(cfg, "/api/v1/scan-address", { address: args.address, chain: "robinhood" }, "scan", args.confirmPayment));
}

async function runAgentIdentity(): Promise<ToolResponse> {
  const { http, data } = await getJSON("/api/agent/identity");
  return http < 400 ? ok(data) : err(`agent identity failed (HTTP ${http})`);
}

// ── Server wiring ─────────────────────────────────────────────────────────────

const server = new Server({ name: "interventiononchain", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req): Promise<CallToolResult> => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case "intervention_scan_code":         return await runScanCode(args as never);
      case "intervention_scan_address":      return await runScanAddress(args as never);
      case "intervention_guard":             return await runGuard(args as never);
      case "intervention_paid_scan_code":    return await runPaidScanCode(args as never);
      case "intervention_paid_scan_address": return await runPaidScanAddress(args as never);
      case "intervention_agent_identity":    return await runAgentIdentity();
      default:                               return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    // Never surface a private key in an error.
    const msg = (e instanceof Error ? e.message : "Internal MCP error").replace(/0x[0-9a-fA-F]{64}/g, "0x<redacted>");
    return err(msg);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// eslint-disable-next-line no-console
console.error(`interventiononchain-mcp 0.1.0 — API ${cfg.apiUrl} — payment mode ${cfg.mode}${cfg.requestedMode === "auto" && !cfg.autoAllowed ? " (auto requested but disabled: needs apex host + payer key)" : ""} — POLICY: ${POLICY.network} USDG ${POLICY.usdg}`);
