# JustaName Status Page

Public uptime monitoring + status page for **health.justaname.id**, watching
`api.justaname.id` (CCIP-Read gateway, resolution endpoints, bundler RPC) with a
99.9% monthly uptime target.

Built on [Gatus](https://github.com/TwiN/gatus). Runs on a DigitalOcean droplet
— **outside** the AWS/EKS infra it monitors, so the status page stays up to
report an outage instead of going down with it.

![JustaName status page — health dashboard with all checks green](./docs/status-page-screenshot.png)

## Checks

| Group | Check | Endpoint | Asserts |
|-------|-------|----------|---------|
| API | liveness | `GET /.well-known/x402.json` | server up (public, no auth/RPC) |
| CCIP-Read gateway | resolve | `GET /ens/v2/resolve?ens=…` | `viaUniversalResolver==true`, correct `ens` |
| CCIP-Read gateway | batch resolve | `GET /ens/v2/resolve?ens=a&ens=b` | array response, first `ens` correct |
| Resolution API | reverse | `GET /ens/v2/reverse?address=…&coinType=60` | resolves without error |
| Bundler | base / ethereum | `POST /proxy/v1/rpc?chainId=…` `eth_chainId` | returns the right hex chainId |

The resolution checks assert **correctness, not just a 200**: `viaUniversalResolver`
is only `true` when the request actually went through the Universal Resolver /
CCIP-Read path, so a gateway returning 200 with garbage still counts as down.

## Cost — effectively $0

- **Liveness**: static JSON, no auth, no RPC. Free.
- **Resolution** (resolve/batch/reverse): we pass a **free public RPC**
  (PublicNode) via `X-Rpc-Url`, so the on-chain compute is paid by the public
  node, **not JustaName's dRPC account**. No api key either (free BYO-rpc path).
- **Bundler**: `eth_chainId` is answered locally by the bundler (never reaches
  dRPC). The only cost is the api-key validation the guard runs per request —
  internal load, not money. Runs every 5min to keep that minimal.

So the whole page costs ~$0 in RPC/spend; the only thing to watch is the api
key's own quota for the bundler checks.

## Intervals

`liveness` 30s (free, fast full-outage detector) · everything else 5min (the
resolution checks lean on a free public RPC, so we don't probe it aggressively).

## Deploy

See **[DEPLOY.md](./DEPLOY.md)** for the full DigitalOcean walkthrough (droplet,
DNS, secrets, TLS). Short version:

```bash
git clone https://github.com/JustaName-id/status-page.git && cd status-page
cp .env.example .env     # fill in RPC_URL, KNOWN_NAME(_2), KNOWN_ADDRESS, BUNDLER_API_KEY, SLACK_WEBHOOK_URL
docker compose up -d     # Gatus + Caddy (auto-HTTPS for health.justaname.id)
```

## Local preview

```bash
cp .env.example .env
docker compose -f docker-compose.local.yml up   # http://localhost:8080, no TLS
```

Probes still hit prod, so you see real results. History here is throwaway.

## Multi-region (for the 99.9% SLA)

Run instances in 2+ regions and confirm "down" from more than one vantage point.
For unified history across regions, switch `storage` to Postgres (commented
block in `config.yaml`).

## Files

- `config.yaml` — Gatus checks, UI, alerting
- `docker-compose.yml` — Gatus + Caddy (prod, auto-HTTPS)
- `docker-compose.local.yml` — Gatus only, `localhost:8080` (preview)
- `Caddyfile` — reverse proxy + Let's Encrypt for `health.justaname.id`
- `fly.toml` + `Dockerfile` — optional Fly.io deploy instead of DO
- `.env.example` — required environment variables
