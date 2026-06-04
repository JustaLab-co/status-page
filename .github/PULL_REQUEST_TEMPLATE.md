## What & why

<!-- What does this PR change, and why? Link any related issue: Closes #123 -->

## Type of change

- [ ] New / updated check (`config.yaml`)
- [ ] Deploy / infra (`Caddyfile`, compose, `fly.toml`, `Dockerfile`)
- [ ] Docs
- [ ] Other

## Checklist

- [ ] `docker compose -f docker-compose.local.yml up` starts cleanly and all
      endpoints validate (`success=true`)
- [ ] No secrets committed (only `.env.example`; real keys/RPC URLs/webhooks
      stay out of the diff)
- [ ] New checks use the free-by-default RPC path and a sane interval
- [ ] Docs updated if behavior or setup changed
