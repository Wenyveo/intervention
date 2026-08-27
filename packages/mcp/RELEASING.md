# Releasing @interventiononchain/mcp

`0.1.0` was published to the `latest` tag from the scope owner's account
(`intervention-onchain`) using a legacy publish token, because a brand-new
package cannot use OIDC Trusted Publishing for its very first publish.

## Future releases — OIDC Trusted Publishing (tokenless)

Now that the package exists, configure a Trusted Publisher so subsequent
versions publish from GitHub Actions with no token.

1. npmjs.com → `@interventiononchain/mcp` → **Settings → Trusted Publisher** →
   **GitHub Actions**, with EXACTLY:
   - Organization or user: `Wenyveo`
   - Repository: `intervention`
   - Workflow filename: `release-mcp.yml` (filename only — not a path)
   - Environment: leave blank
2. Add a `.github/workflows/release-mcp.yml` modeled on `release-sdk.yml`:
   - `permissions: { contents: read, id-token: write }`
   - `workflow_dispatch` with an explicit confirmation input, main-branch guard
   - `pnpm/action-setup@v4` with **no** `version:` input (it reads
     `packageManager`), `actions/setup-node@v4`, then `npm install -g npm@latest`
     (OIDC needs npm ≥ 11.5.1)
   - build → pack → inspect tarball for leaks/source-maps → smoke-install →
     `npm publish --provenance --access public --tag latest`
3. Never place a token in `.npmrc`, the repo, CI logs, or docs.

## Publish policy

- `files` allowlist only: `dist`, `README.md`, `LICENSE`, `package.json`.
- No source maps (tsup `sourcemap: false`).
- Thin hosted client: never bundle the engine, rules, contracts, or secrets.
- Robinhood Chain / USDG only in all public wording.
