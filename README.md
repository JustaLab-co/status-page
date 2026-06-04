# gatus-justaname

Public uptime monitoring + status page for **health.justaname.id**, watching
`api.justaname.id` (CCIP-Read gateway, resolution endpoints) with a 99.9%
monthly uptime target.

Built on [Gatus](https://github.com/TwiN/gatus). Runs on Fly.io — **outside**
the AWS/EKS infra it monitors, so the status page survives a prod outage.

## Checks

| Check | Endpoint | Asserts |
|-------|----------|---------|
| Liveness | `GET /.well-known/x402.json` | server up (public, no auth/payment) |
| CCIP-Read | `GET /v2/resolve?ens=…` | `viaUniversalResolver == true`, no error, correct `ens` |
| Reverse | `GET /v2/reverse?address=…` | no error |

Notes:
- `/v2/resolve` is **paid** without an rpcUrl (402 challenge). We pass the dRPC
  URL via the `X-Rpc-Url` header to make probes free and keep the key out of
  access logs.
- The API envelope is `{ statusCode, result: { data, error } }`, so conditions
  target `[BODY].result.data...`.

## Run on a DigitalOcean droplet (recommended — outside AWS)

1. Create the smallest droplet (1GB / ~$6) with Docker, in any region.
2. Point `health.justaname.id` **A record** at the droplet IP; open ports 80 + 443.
3. On the droplet:

```bash
git clone <this-repo> && cd gatus-justaname
cp .env.example .env          # fill in RPC_URL, KNOWN_NAME, KNOWN_ADDRESS, SLACK_WEBHOOK_URL
docker compose up -d          # Gatus + Caddy (auto-HTTPS)
```

Caddy fetches the TLS cert automatically; the page is live at
`https://health.justaname.id` within a minute. `config.yaml`, `Caddyfile`, and
the SQLite history persist in Docker volumes across restarts.

> For a droplet that can be recreated, mount a DO Block Storage volume and back
> the `gatus-data` / `caddy-data` volumes with it so history + certs survive.

## Alternative: Fly.io

`fly.toml` + `Dockerfile` are included for a Fly deploy instead (bakes config
into the image, no auto-stop, volume for history). See the manifest comments.

## Multi-region (for the 99.9% SLA)

Run instances in 2+ regions and confirm down from more than one vantage point.
For unified history switch `storage` to Postgres (block is in `config.yaml`).

## Files

- `config.yaml` — Gatus checks + UI + alerting
- `Dockerfile` — bakes the config into the image (Fly mounts no files)
- `fly.toml` — Fly manifest (no auto-stop, volume, health check)
- `docker-compose.yml` + `.env.example` — local/VPS alternative
