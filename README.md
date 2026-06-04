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

## Run on Fly.io

```bash
fly launch --no-deploy --copy-config --name justaname-status --region fra
fly volumes create gatus_data --region fra --size 1
fly secrets set RPC_URL="https://lb.drpc.live/ethereum/<KEY>" \
                SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
fly deploy
fly certs add health.justaname.id   # then add the CNAME in DNS
```

Edit `KNOWN_NAME` / `KNOWN_ADDRESS` / `EXPECTED_ADDRESS` in `fly.toml`.

## Run locally / on a VPS

```bash
cp .env.example .env   # fill in
docker compose up -d   # status page on :8080
```

## Multi-region (for the 99.9% SLA)

Run instances in 2+ regions and confirm down from more than one vantage point.
For unified history switch `storage` to Postgres (block is in `config.yaml`).

## Files

- `config.yaml` — Gatus checks + UI + alerting
- `Dockerfile` — bakes the config into the image (Fly mounts no files)
- `fly.toml` — Fly manifest (no auto-stop, volume, health check)
- `docker-compose.yml` + `.env.example` — local/VPS alternative
