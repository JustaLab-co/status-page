# Spec: public status page for JAW

## Objective

Give JAW users one public page that answers "is it working right now?" for the services they depend on: the hosted MCP server, the bundler on each supported chain, the paymaster, and ENS resolution. The page shows a state per service (up, degraded, down) and the latency of the last probe, and nothing else. Thresholds, error details and alert routing stay internal.

Success means a user can open `health.jaw.id` (also served at `health.justaname.id`), see the state of every service in a layout that looks like jaw.id, and the operator keeps the same Gatus probes, history and Slack alerts behind it.

## Architecture

```
Internet -> Caddy (TLS) -> web (public page, :3000) -> Gatus API (internal, gatus:8080)
                                                        Gatus -> probes prod, SQLite history, Slack alerts
```

- **Gatus** keeps doing the probing, the history and the alerting, and stops being public. Caddy no longer routes to it. Its dashboard binds to `127.0.0.1:8080` on the droplet and is reached over an SSH tunnel.
- **web** is a small server-rendered app (Node, TypeScript, Hono). On each request it reads `GET /api/v1/endpoints/statuses?pageSize=1` from Gatus over the compose network, maps each check to a public state, and renders HTML. It has no secrets and serves only the page and its static assets.
- The Gatus image is pinned (`twinproduction/gatus:v5.38.0`) because the web app depends on its API shape.

## Checks

Every check runs from the droplet against production. A check passes only when all its conditions pass. Response time is measured by Gatus and the limits below are internal.

| Service | Request | Conditions | Interval |
|---|---|---|---|
| MCP server | `GET https://mcp.jaw.id/api/health` | `[STATUS] == 200`, `[BODY].db == ok`, `[BODY].paused == false`, `[RESPONSE_TIME] < 3000` | 60s |
| Bundler, one per chain | `POST https://api.justaname.id/proxy/v1/rpc?chainId=<id>&api-key=${BUNDLER_API_KEY}` with `eth_chainId` | `[STATUS] == 201`, `[BODY].result == <hex id>`, `[RESPONSE_TIME] < 5000` | 300s |
| Paymaster | `POST https://api.justaname.id/proxy/v1/rpc/erc20-paymaster?chainId=8453&api-key=${BUNDLER_API_KEY}` with `jaw_getTokenQuotes` for USDC on Base | `[STATUS] == 201`, `[BODY].result.quotes[0].token == 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, `[RESPONSE_TIME] < 5000` | 900s |
| API gateway | `GET https://api.justaname.id/.well-known/x402.json` | unchanged | 30s |
| ENS name, batch and reverse resolution | `/ens/v2/resolve` and `/ens/v2/reverse` | unchanged | 300s |

Why these requests:

- **MCP.** `/api/health` reads the database and the pause flag. While paused it still answers 200 but every other route refuses with 503, so `paused == false` is part of "up".
- **Bundlers.** `eth_chainId` goes through the proxy and its api-key check to the chain's bundler, which answers it without touching an RPC provider. The proxy answers 201 even for a JSON-RPC error, so the body is asserted, not just the status. The chains are the 20 mainnets jaw.id lists: Ethereum (1), OP Mainnet (10), Flare (14), BNB Smart Chain (56), Gnosis (100), Unichain (130), Polygon (137), Monad (143), Soneium (1868), Citrea (4114), Robinhood Chain (4663), Arc (5042), HyveChain (7847), Base (8453), ADI Chain (36900), Arbitrum One (42161), Celo (42220), Avalanche (43114), Ink (57073), Linea (59144).
- **Paymaster.** One check, on Base. A quote with an empty token list returns before any pricing, so it would only prove routing. The USDC quote proves the paymaster can price gas right now. Each probe reads current prices once, from CoinGecko or a Chainlink feed depending on the paymaster's config for Base. The CoinGecko reader caches prices for 30 seconds.
- **ENS.** Same requests and rules as before. Only the display names change.

The api key travels in the query string, so every keyed check sets `ui.hide-url: true` and Gatus redacts the URL from error text.

## Public state

The web app derives one state per check from the latest Gatus result:

- **Up:** every condition passed.
- **Degraded:** the request completed and the only failed conditions are `[RESPONSE_TIME]` ones. The service answered correctly but slower than the internal limit.
- **Down:** anything else, such as a request error, a timeout, a wrong status or a wrong body.

The Gatus checks keep their condition results (no `ui.hide-conditions`), because the web app reads them to tell slow from broken. Gatus is no longer public, so this exposes nothing.

The headline uses the whole board: "All systems operational" when everything is up, "Degraded performance" when something is degraded and nothing is down, "Partial outage" when some checks are down, "Major outage" when all are. If Gatus cannot be read, or answers with an unexpected shape, the page says "Status unavailable" and returns 503. It never shows "operational" without data. Gatus lists a check only after its first result, so the page reads `config.yaml` at startup to count the checks and answers "Status unavailable" until every one of them has a result.

Sections come from the Gatus `group` field and rows from `name`. Sections render in a fixed order (Core services, Bundlers, ENS resolution) and rows sort by name.

## Public vs internal

| Public (rendered by web) | Internal (Gatus only) |
|---|---|
| Section and check names | URLs, hostnames and the api key |
| State: up, degraded or down | Conditions and their thresholds |
| Latency of the last probe | Error messages |
| Time of the newest probe | Alert routing and the Slack webhook |
| | Result history, events, `/api/v1/*`, `/metrics` |

The split is enforced in two places. The web app copies only the public fields out of the Gatus payload before rendering, and the public origin has no route to Gatus at all.

## Visual tokens from jaw.id

Taken from the stylesheets jaw.id serves. jaw.id has no dark theme (no dark token block in its CSS), so the status page is light only.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#fff` | page |
| `--bg-raise` | `#fafaf9` | cards, pill nav |
| `--bg-raise-2` | `#f4f4f2` | hover, tiles |
| `--line` / `--line-2` | `#e7e5e4` / `#d6d3d1` | borders |
| `--ink` / `--ink-2` / `--ink-3` | `#0f172a` / `#475569` / `#94a3b8` | text levels |
| `--acc` / `--acc-deep` | `#0f172a` / `#020617` | primary button, logo |
| `--hero-electric` | `#455492` | headline accent |
| `--green` / `--amber-700` / `--red` | `#15803d` / `oklch(55.5% .163 48.998)` / `#dc2626` | up, degraded, down |
| `--radius` | `.625rem` | base radius |

Degraded uses jaw.id's `--color-amber-700` instead of its `--amber` (`#d97706`). On white, `#d97706` gives about 3.2:1 contrast, under the 4.5:1 that small text needs, and amber-700 gives about 5:1.

Typography: Inter 300 to 700 for text and JetBrains Mono 400 to 600 for labels and numbers, both self-hosted like jaw.id does. Headlines are weight 500, letter spacing `-0.035em`, line height about 1.05, `clamp(34px, 4.3vw, 58px)` on desktop and `clamp(28px, 6.5vw, 40px)` on mobile. Body copy is 17px over 1.6 in `--ink-2`. Small labels are uppercase mono with `0.1em` tracking.

Components reused: the nav brand (mark, "JAW" in 600 and the suffix in `--ink-3`), the pill primary button (`--acc`, 13.5px, weight 500, lifts on hover), bordered cards with 18px radius on `--bg-raise`, the "online" indicator (6px dot and small muted text), and the light footer with a top border. jaw.id's noise overlay is left out because it does not show on light surfaces.

## Layout and commands

```
config.yaml              Gatus checks, thresholds and alerting
web/src/gatus.ts         reads the statuses API, validated with Zod
web/src/board.ts         maps Gatus results to public states
web/src/page.tsx         page markup
web/src/app.tsx          routes: the page and static assets
web/src/server.ts        process entry point
web/static/              styles.css, fonts, JAW mark
```

```
pnpm --dir web install --frozen-lockfile
pnpm --dir web lint
pnpm --dir web typecheck
pnpm --dir web test
pnpm --dir web build
docker compose -f docker-compose.local.yml up --build
```

New dependencies come through pnpm with `minimumReleaseAge: 10080` (7 days).

## Acceptance checks

1. `lint`, `typecheck`, `test` and `build` in `web/` exit 0, locally and in CI.
2. CI also boots Gatus with `config.yaml` and fails if the config does not load.
3. With a valid key, `docker compose -f docker-compose.local.yml up --build` reports `success=true` for every check, and `http://localhost:3000` shows the MCP server, 20 bundlers, the paymaster and ENS as operational.
4. With a local config copy where the MCP check points at a missing path and one bundler has an impossible latency limit, the page shows the MCP server down, that chain degraded and the headline "Partial outage".
5. Nothing internal leaks: the HTML from `/` contains no `RESPONSE_TIME`, `[STATUS]`, `api-key`, `hooks.slack.com`, hostnames or error text, and `/api/v1/endpoints/statuses` and `/metrics` answer 404 on the public origin.
6. Unit tests cover the up, degraded and down rules, the headline, the unavailable page, and the absence of conditions, URLs and errors in the rendered HTML.
7. Screenshots at 1440px and 390px wide for the healthy board and the forced failure.

## Risks

- **Gatus API changes on upgrade.** The image is pinned, and the web app validates the payload so a changed shape shows "Status unavailable" instead of wrong states.
- **More probes on the api key.** 20 bundler checks every 5 minutes are 10 times the previous api-key validations. They are cheap, but they show up in that key's usage, so the key should be one used only for monitoring.
- **Paymaster price reads.** One quote every 15 minutes adds about 96 price reads a day to the paymaster's price source.
- **One failed probe shows down.** The page reflects the latest probe, so a blip shows for up to one interval. Slack alerts still wait for 3 failures in a row.
- **Alert noise.** A proxy outage fires one Slack alert per keyed check, about 22 at once.
- **History resets.** Renamed checks start a new history in Gatus.
- **Deploy change.** The droplet needs `docker compose up -d --build --force-recreate` once, or Caddy keeps its old config and the public domain still serves `/api/v1/endpoints/statuses` and `/metrics`. Both must answer 404 after the upgrade. The Gatus dashboard moves behind an SSH tunnel.
- **Latency is measured from the droplet,** not from each user's location.

## Out of scope

- Testnet bundlers and per-chain paymaster checks.
- New ENS checks.
- A dark theme.
- Incident history, announcements and uptime percentages on the public page.
- Moving the page to a jaw.id domain, and multi-region probing.
