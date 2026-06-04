# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via one of:

- GitHub's [private vulnerability reporting](https://github.com/JustaName-id/status-page/security/advisories/new)
  (Security → Report a vulnerability)
- Email **security@justaname.id**

We aim to acknowledge reports within 72 hours and will keep you updated as we
work on a fix. Please give us a reasonable window to remediate before any public
disclosure.

## Scope

This repo is a public, config-driven status page (Gatus + Docker). The most
sensitive surface is **secrets handling**:

- Only `.env.example` is committed; the real `.env` is gitignored.
- API keys, RPC URLs containing keys, and Slack webhook URLs must never be
  committed. If you find one in the git history, report it so we can rotate and
  scrub it.
- The resolution checks deliberately pass a **free public RPC** via `X-Rpc-Url`
  so no paid/keyed RPC endpoint is exposed in config.

If you spot a leaked credential in this repository, treat it as a vulnerability
and report it privately so it can be rotated.
