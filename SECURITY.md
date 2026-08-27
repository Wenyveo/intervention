# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** via GitHub Security
Advisories:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability** to open a private advisory.

This opens a private channel with the maintainers. Please do not open a public
issue for security reports.

Include, where possible: affected package and version, a description, reproduction
steps, and impact.

## Scope

This repository contains the public **thin hosted clients**
(`@interventiononchain/mcp`, `@interventiononchain/sdk`). They call the hosted
Intervention API at `https://interventionprotocol.io` and contain no scanner
engine, rules, server, or secrets. Reports about the hosted service are also
welcome through the same private advisory channel.

## Supported versions

The latest published version of each package is supported.
