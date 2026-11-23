# Deploy on DigitalOcean

Step-by-step to run the status page on a DigitalOcean droplet and serve it at
`https://health.justaname.id`. The droplet lives outside AWS on purpose — the
status page must survive an `api.justaname.id` outage.

---

## 1. Create the droplet

- **Image**: Ubuntu 24.04 (or DO's "Docker on Ubuntu" Marketplace image to skip
  step 3).
- **Size**: the smallest is enough — Basic / Regular, 1 GB RAM / 1 vCPU (~$6/mo).
  Gatus + Caddy are tiny.
- **Region**: any region that is NOT your AWS region (independence). A European
  region keeps probe latency low to prod.
- **Auth**: add your SSH key.

Note the droplet's public IPv4.

## 2. DNS

In the DNS for `justaname.id`, add an **A record**:

```
health.justaname.id  ->  <droplet-ip>
```

Wait until it resolves (`dig +short health.justaname.id` returns the IP). Caddy
needs this working before it can issue the TLS cert.

## 3. Install Docker (skip if you used the Docker Marketplace image)

```bash
ssh root@<droplet-ip>
curl -fsSL https://get.docker.com | sh
```

## 4. Open the firewall

Allow HTTP/HTTPS (and keep SSH). With UFW:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

If you use a DO Cloud Firewall instead, allow inbound 22, 80, 443.

## 5. Get the code + configure

```bash
git clone https://github.com/JustaName-id/status-page.git && cd status-page
cp .env.example .env
nano .env            # fill in the values below
```

Required in `.env`:

| Var | What |
|-----|------|
| `RPC_URL` | A **free public** Ethereum RPC (e.g. `https://ethereum-rpc.publicnode.com`). Keeps resolution checks free. |
| `KNOWN_NAME` | A name that always resolves in prod (single-resolve check). |
| `KNOWN_NAME_2` | A second name for the batch-resolve check. |
| `KNOWN_ADDRESS` | An address with a stable reverse record. |
| `BUNDLER_API_KEY` | Any valid JustaName api key (passed as `?api-key=`). The bundler and paymaster checks use it. Prefer a monitoring-only key; if it has a domain allowlist, add the monitor's domain or use one without an allowlist. |
| `SLACK_WEBHOOK_URL` | Incoming webhook for alerts. |

`EXPECTED_ADDRESS` is optional (enables the strongest resolve assertion — see
the commented condition in `config.yaml`).

## 6. Launch

```bash
docker compose up -d --build
```

This builds the public page and starts **Gatus**, the page (`web`) and **Caddy**. Caddy routes the domain to the page only. Caddy automatically fetches a Let's Encrypt
cert for `health.justaname.id` (that's why DNS must be live first). Within a
minute:

```
https://health.justaname.id   ->  the status page
```

## 7. Verify

```bash
docker compose ps                  # gatus, web and caddy Up
docker compose logs -f gatus       # check config loaded, no panics
curl -s localhost:8080/health      # gatus liveness -> 200
```

Open `https://health.justaname.id`. Every check should show as operational (the bundler and paymaster ones need a valid `BUNDLER_API_KEY`).

Gatus must not answer on the public domain. Both of these should print 404:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://health.justaname.id/api/v1/endpoints/statuses
curl -s -o /dev/null -w '%{http_code}\n' https://health.justaname.id/metrics
```

The Gatus dashboard, with conditions and history, is internal. It listens on the droplet's loopback only, so open it through an SSH tunnel:

```bash
ssh -L 8080:localhost:8080 root@<droplet-ip>   # then http://localhost:8080
```

---

## Operations

**Update config / code**
```bash
git pull
docker compose restart gatus       # reloads config.yaml (bind-mounted)
docker compose up -d --build web   # rebuilds the public page after web/ changes
```

**Upgrade from the Gatus-only setup** (once). `--force-recreate` makes Caddy load the new Caddyfile, which routes to the public page instead of Gatus. Then run the 404 checks from step 7.
```bash
git pull
docker compose up -d --build --force-recreate
```

**Change a secret in `.env`** — a `restart` does NOT reload env vars; recreate:
```bash
docker compose up -d --force-recreate
```

**Logs**
```bash
docker compose logs -f gatus
docker compose logs -f caddy       # TLS / cert issues show here
```

**Data** — history (SQLite) and TLS certs live in named Docker volumes
(`gatus-data`, `caddy-data`). They survive restarts and `docker compose down`.
For a droplet you might recreate, attach a DO Block Storage volume and point
these at it so history + certs survive a rebuild.

---

## Troubleshooting

- **Gatus container restarting** → `docker compose logs gatus`. Usually a
  `config.yaml` error: Gatus conditions are strict `<VALUE> <COMPARATOR> <VALUE>`
  (no `has()`); use `!= ""` for existence and `[BODY].statusCode == 200`.
- **A check is 404** → wrong path. Prod is prefixed per service: ENS is
  `/ens/v2/...`, the proxy/bundler is `/proxy/...`. Don't use a bare `/v2/...`.
- **Reverse is 400** → it needs `&coinType=60` (or an interop suffix).
- **Bundler is 403** → the api key must go as the `?api-key=` **query param**,
  not a header. Any valid JustaName key works; check it has no blocking domain
  allowlist.
- **Caddy can't get a cert** → DNS not pointing at the droplet yet, or 80/443
  blocked. Confirm `dig +short health.justaname.id` and the firewall.
- **The page says "Status unavailable"** → the page cannot read Gatus, or Gatus has not finished its first probes. Check `docker compose logs web` and `docker compose ps gatus`.

---

## Next: multi-region + unified history (for the SLA)

1. Spin up a second droplet in another region with the same setup.
2. Switch both to a shared **Postgres** (`storage` block in `config.yaml`,
   commented) — a small managed Postgres outside AWS (DO Managed DB, Supabase,
   Neon). Drop the `gatus-data` volume once on Postgres.
3. Treat the service as "down" only when more than one region agrees.
