# Gate

**The access screen Basic Auth should have had.**

Gate is a design-first shared-secret access layer for private Next.js experiences. Browser Basic Auth dialogs cannot be styled, so Gate moves the credential challenge into the application layer while keeping the protected route and credential verification on the server.

## Surfaces

- **Vault** — numeric keypad and safe-door interface.
- **Cipher** — intelligence-terminal style access-key challenge.
- **Classic** — calm username/password surface for organizations and client previews.

The appearance is independent from the server-side authentication policy. Switching the visible surface never downgrades `GATE_MODE`.

## What is implemented

- Next.js 16 App Router reference application
- `proxy.ts` protection for `/protected/*`
- HMAC-SHA-256 signed `HttpOnly` session cookie
- fail-closed secret handling and same-origin unlock/logout POSTs
- constant-length SHA-256 static-credential comparison
- Vault / Cipher / Classic responsive interfaces
- **Interactive Demo**: create a temporary PIN, arm the vault, fail/succeed verification, mechanically open it and enter the protected archive
- temporary demo credential stored as a signed, secret-keyed verifier rather than plaintext PIN
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

The example production Vault credential is `042731`. Replace every example secret before deploying.

To run the self-service showcase instead, explicitly enable Interactive Demo:

```env
GATE_INTERACTIVE_DEMO=true
GATE_SECRET=<long-random-signing-secret>
GATE_PIN_LENGTH=6
GATE_DEMO_TTL=1800
```

**Interactive Demo intentionally lets every visitor create a temporary credential that can enter `/protected`. Never enable it on a deployment containing real private data.** See `docs/INTERACTIVE_DEMO.md`.

## Interactive Demo

The reference app can demonstrate the complete Gate story rather than only showing a keypad mock:

1. create a temporary PIN
2. confirm it
3. watch the Gate arm
4. return to a genuinely locked Vault
5. try a wrong PIN and remain outside
6. enter the correct PIN
7. watch the bolts retract and the aperture open
8. arrive at the server-protected fictional intelligence archive
9. lock the facility and return to the closed Gate

The PIN itself is never stored in the browser cookie. Gate stores a random salt plus an HMAC-SHA-256 verifier keyed by `GATE_SECRET`, expiration metadata, and a signature covering that payload. The temporary cookie is `HttpOnly` and `SameSite=Lax`.

The showcase is isolated behind `GATE_INTERACTIVE_DEMO=true`; when disabled, the existing production `GateShell` and its Vault/Cipher/Classic surfaces remain unchanged.

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
GATE_MODE=vault
GATE_USERNAME=guest
GATE_NAME=Private Archive
GATE_MESSAGE=Authorized access only
GATE_ALLOW_STYLE_SWITCH=true
GATE_PIN_LENGTH=6
GATE_SESSION_TTL=43200
GATE_THEME_PRESET=nocturne
GATE_INTERACTIVE_DEMO=false
GATE_DEMO_TTL=1800
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

The static credential, temporary Interactive Demo verifier and guest codes are validated only on the server. Successful requests receive a signed session in an `HttpOnly`, `SameSite=Lax` cookie. `proxy.ts` verifies signature and expiration before the protected route renders.

Interactive Demo is a showcase exception to normal access policy: when enabled, each visitor can mint their own short-lived credential for the reference protected route. Keep it disabled anywhere `/protected` contains actual private content.

For internet-facing production deployments, use a high-entropy credential, Redis-backed one-time codes, HTTPS and the staged Vercel Firewall policy. Vercel's platform DDoS protection is complementary; the custom Gate rules are aimed at application-level brute-force and admin-endpoint abuse.

## Project structure

```text
app/
  api/gate/unlock/route.ts       static/demo/code credential exchange
  api/gate/demo/setup/route.ts   temporary demo credential creation
  api/gate/demo/reset/route.ts   demo credential/session destruction
  api/gate/codes/route.ts        admin access-code issuance
  builder/page.tsx               Theme Builder
  protected/page.tsx             protected fictional archive
components/
  gate-shell.tsx                 production Vault / Cipher / Classic UI
  demo-gate-shell.tsx            interactive Vault showcase
  theme-builder.tsx              live theme editor/export
lib/
  access-codes.ts                runtime Redis/memory adapter selection
  demo.ts                        signed temporary demo credential
  gate.ts                        server auth configuration
  session.ts                     signed sessions
  theme.ts                       server theme loading
packages/gate/                   publish-ready reusable package
docs/INTERACTIVE_DEMO.md         showcase security boundary and flow
scripts/firewall-stage.sh        draft-only Vercel Firewall setup
gate.theme.json                  theme source of truth
proxy.ts                         protected-route boundary
```

## License

MIT
