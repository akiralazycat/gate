# Gate

**The access screen Basic Auth should have had.**

Gate is a design-first shared-secret access layer for private Next.js experiences. Browser Basic Auth dialogs cannot be styled, so Gate moves the credential challenge into the application layer while keeping the protected route and credential verification on the server.

## Surfaces

- **Vault** — numeric keypad and safe-door interface.
- **Cipher** — intelligence-terminal style access-key challenge.
- **Classic** — calm username/password surface for organizations and client previews.

The appearance is independent from the server-side authentication policy. Switching the visible surface never downgrades `GATE_MODE`. Style switching is available for Vault policy, whose numeric credential can be represented by every surface; Cipher and Classic stay on their native input surface so required credential fields cannot disappear.

## What is implemented

- Next.js 16 App Router reference application
- `proxy.ts` protection for `/protected/*`
- HMAC-SHA-256 signed `HttpOnly` session cookie
- fail-closed secret handling and same-origin unlock/logout POSTs
- constant-length SHA-256 static-credential comparison
- application-level credential/admin throttling with Redis and bounded local fallback
- versioned sessions with signing-key rotation support
- strict JSON input bounds, no-store auth responses and production security headers
- readiness endpoint at `GET /api/gate/health`
- Vault / Cipher / Classic responsive interfaces
- **Theme Builder** at `/builder`
- versioned `gate.theme.json`
- JSON and portable CSS theme export
- publish-ready **`@akiralazycat/gate`** workspace package
- expiring, one-time and limited-use guest codes
- atomic Redis code consumption with a local-memory development adapter
- Vercel Firewall draft/staged rollout tooling
- CI typecheck, package smoke test, package dry-run and production build

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

The example Vault credential is `042731`. Replace every example secret before deploying.

## Theme Builder

Open `/builder` and tune the palette, geometry, blur, grid and glow while switching between Vault, Cipher and Classic previews.

The Builder exports:

- `gate.theme.json` — the editable/versioned source of truth
- `gate-theme.css` — portable CSS overrides for an existing Gate surface

The root `gate.theme.json` is loaded by the reference app. `GATE_THEME_JSON` can override it at runtime; `GATE_THEME_PRESET` selects a fallback (`nocturne`, `signal`, `paper`).

## npm package

The reusable core lives in `packages/gate` and builds to `packages/gate/dist`.

```bash
npm run build:package
npm run test:package
npm --prefix packages/gate pack --dry-run
```

Public API:

```ts
import {
  normalizeGateTheme,
  gateThemeToCss,
  createGateAccessCode,
  consumeGateAccessCode,
  MemoryGateCodeStore,
  createRedisGateCodeStore,
} from "@akiralazycat/gate";
```

The package is structured for npm publication but this repository does not publish automatically. Publishing should happen only after the npm scope/ownership and release version are intentionally configured.

## Expiring / one-time codes

Enable access codes:

```env
GATE_ACCESS_CODES=true
GATE_ADMIN_TOKEN=<separate-long-random-token>
UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<token>
```

Issue a 15-minute, one-use code:

```bash
curl -X POST https://example.com/api/gate/codes \
  -H "Authorization: Bearer $GATE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ttlSeconds":900,"maxUses":1,"label":"client preview"}'
```

Production requires Redis; Gate will not pretend an in-memory serverless store is globally one-time. The Redis adapter uses an atomic Lua consume operation. Sessions granted by a guest code cannot outlive that code's remaining expiry.

Vault guest codes require a 6-8 digit `GATE_PIN_LENGTH`. See `docs/ACCESS_CODES.md`.

## Vercel Firewall

Gate includes a safe draft-only setup for API abuse controls:

```bash
vercel link
npm run firewall:stage
```

It stages observation rate limits for `POST /api/gate/unlock` and `POST /api/gate/codes`, both with `rate-limit-action=log`, then prints `vercel firewall diff`. It **never publishes** the rules.

Use `docs/FIREWALL.md` for the log → Preview enforcement → production enforcement rollout. Publishing remains an explicit operator action.

## Core configuration

```env
GATE_PASSWORD=042731
GATE_SECRET=<long-random-signing-secret>
GATE_SECRET_PREVIOUS=<previous-secret-during-rotation-only>
GATE_MODE=vault
GATE_USERNAME=guest
GATE_NAME=Private Archive
GATE_MESSAGE=Authorized access only
GATE_ALLOW_STYLE_SWITCH=true
GATE_PIN_LENGTH=6
GATE_SESSION_TTL=43200
GATE_UNLOCK_RATE_LIMIT=10
GATE_UNLOCK_RATE_WINDOW=60
GATE_ADMIN_RATE_LIMIT=6
GATE_ADMIN_RATE_WINDOW=60
GATE_HEALTH_DETAILS=false
GATE_THEME_PRESET=nocturne
```

## Protecting another route tree

The reference boundary is in `proxy.ts`:

```ts
export const config = {
  matcher: ["/protected/:path*"],
};
```

Replace the matcher with the private route tree you want Gate to guard.

## Security model

Gate is intended for staging environments, client previews, lightweight shared-secret spaces and similar access control. It is not a substitute for per-user identity when you need MFA, password reset, role authorization, audit trails or account lifecycle management.

The static credential and guest codes are validated only on the server. Successful requests receive a signed session in an `HttpOnly`, `SameSite=Lax` cookie. `proxy.ts` verifies signature and expiration before the protected route renders.

`GET /api/gate/health` returns `200` only when the deployment is ready and `503` otherwise. Use it as a readiness probe. Check names are included during development; set `GATE_HEALTH_DETAILS=true` only when production monitoring needs them. In production, Gate rejects the documented example password, weak/placeholder signing secrets, unusable Vault PINs and incomplete access-code storage.

To rotate the session signing key without immediately invalidating active sessions, move the current value to `GATE_SECRET_PREVIOUS`, deploy a new `GATE_SECRET`, wait at least the configured session lifetime, then remove `GATE_SECRET_PREVIOUS`.

For internet-facing deployments, use a high-entropy credential, Redis-backed one-time codes, HTTPS and the staged Vercel Firewall policy. Gate's built-in limiter is defense in depth; the Vercel Firewall remains the distributed boundary for serverless deployments.

## Project structure

```text
app/
  api/gate/unlock/route.ts   static/code credential exchange
  api/gate/codes/route.ts    admin access-code issuance
  builder/page.tsx           Theme Builder
  protected/page.tsx         protected reference content
components/
  gate-shell.tsx             Vault / Cipher / Classic UI
  theme-builder.tsx          live theme editor/export
lib/
  access-codes.ts            runtime Redis/memory adapter selection
  gate.ts                    server auth configuration
  session.ts                 signed sessions
  theme.ts                   server theme loading
packages/gate/               publish-ready reusable package
scripts/firewall-stage.sh    draft-only Vercel Firewall setup
gate.theme.json              theme source of truth
proxy.ts                     protected-route boundary
```

## License

MIT
