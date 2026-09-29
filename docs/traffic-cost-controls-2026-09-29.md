# Traffic cost controls — 2026-09-29

## Scope

Reduce repeated credential-check cost on Gate API routes before credential verification, Redis code lookup and the intentional failed-login delay.

## Change

- Add an IP-scoped burst guard to `POST /api/gate/unlock`.
- Add a tighter guard to the admin access-code issuance route.
- Keep existing same-origin checks, Redis-backed one-time codes and staged Vercel Firewall workflow unchanged.

The repository's Vercel Firewall rules remain the preferred first layer because they reject before Function execution.

## Progress

| Item | Status |
|---|---|
| Unlock pre-auth guard | pending |
| Admin-code guard | pending |
| Static verification | pending |
| Production verification | pending |
