# Contributing

Thanks for your interest in improving the JustaName status page! This repo is
small and config-driven (Gatus + Docker), so most contributions are quick.

## Ways to contribute

- **Add or tune a check** — edit `config.yaml` (endpoints, conditions, intervals).
- **Fix the deploy** — `Caddyfile`, `docker-compose*.yml`, `DEPLOY.md`.
- **Docs** — clarify the README/DEPLOY for the next person.
- **Report an issue** — use the issue templates.

## Local setup

You only need Docker. The probes hit **prod** (`api.justaname.id`), so you see
real results without any infra of your own.

```bash
git clone https://github.com/JustaName-id/status-page.git
cd status-page
cp .env.example .env          # fill in the values (see comments in the file)
docker compose -f docker-compose.local.yml up
```

Open http://localhost:8080. Stop with `down`, or `down -v` to also wipe the
local SQLite history.

## Before you open a PR

1. **Validate the config.** Gatus refuses to start on a bad `config.yaml`, so a
   clean `docker compose -f docker-compose.local.yml up` is the test — all six
   endpoints should validate and report `success=true`.
2. **Never commit secrets.** Only `.env.example` is committed; `.env` is
   gitignored. Don't paste real API keys, RPC URLs with keys, or webhook URLs
   into committed files. See [SECURITY.md](./SECURITY.md).
3. **Keep checks cheap.** Resolution checks intentionally use a free public RPC
   (BYO via `X-Rpc-Url`) so they cost ~$0 on JustaName's account. Keep new
   checks on the same free-by-default path and use sane intervals.
4. **Conventional commits.** e.g. `feat:`, `fix:`, `docs:`, `chore:`.

## Code of conduct

By participating you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Licensing of contributions

This project is licensed under the [MIT License](./LICENSE). By submitting a
contribution, you agree that your contribution is your own original work and
that it is licensed to the project and its users under the same MIT License.
No separate CLA is required.
