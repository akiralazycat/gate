# Gate

**The access screen Basic Auth should have had.**

Gate is a design-first access layer for private Next.js pages. It replaces the browser-owned Basic Authentication prompt with an application-owned entrance while keeping the protected route on the server side.

It ships with three deliberately different surfaces:

- **Vault** — a numeric keypad and animated safe-door interface for PIN-like credentials.
- **Cipher** — a compact intelligence-terminal style access-key challenge.
- **Classic** — a calm username/password card for ordinary organizations, staging sites, and client previews.

All three use the same server-side session system. The appearance can change without changing the protected application.

> Gate is not an RFC 7617 HTTP Basic Authentication skin. Browser Basic Auth dialogs cannot be styled. Gate moves the credential challenge into the application layer so the experience can be designed intentionally.

## What is implemented

- Next.js 16 App Router reference application
- `proxy.ts` protection for `/protected/*`
- HMAC-SHA-256 signed `HttpOnly` session cookie
- bounded session lifetime (12 hours by default, maximum 7 days)
- same-origin checks on unlock/logout POST requests
- fail-closed behavior when secrets are missing
- constant-length SHA-256 credential comparison
- Vault / Cipher / Classic presentation modes
- responsive mobile layouts and reduced-motion support
- explicit lock/logout flow
- CI typecheck and production build

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open `http://localhost:3000`.

The example `.env` uses `0427` as the Vault code. Replace every example secret before deploying.

## Configuration

```env
# Required credential
GATE_PASSWORD=0427

# Required signing secret; use a long random value
GATE_SECRET=replace-with-a-long-random-secret

# vault | cipher | classic
GATE_MODE=vault

# Used only by Classic mode; defaults to guest
GATE_USERNAME=guest

# Presentation
GATE_NAME=Private Archive
GATE_MESSAGE=Authorized access only
GATE_ALLOW_STYLE_SWITCH=true
GATE_PIN_LENGTH=4

# Seconds; default 43200, clamped to 60..604800
GATE_SESSION_TTL=43200
```

For a signing secret, for example:

```bash
openssl rand -base64 32
```

### Mode notes

`vault` uses a numeric keypad, so `GATE_PASSWORD` should be numeric and match `GATE_PIN_LENGTH` (4–8). `cipher` accepts an arbitrary text password. `classic` validates both `GATE_USERNAME` and `GATE_PASSWORD`.

When `GATE_ALLOW_STYLE_SWITCH=true`, visitors can switch presentation modes. The switch is a presentation control only: the server always enforces the configured `GATE_MODE`, so a client cannot downgrade Classic username/password policy by submitting a different mode. For a production gate, setting style switching to `false` usually gives the clearest experience.

## Protecting your application

The reference matcher lives in `proxy.ts`:

```ts
export const config = {
  matcher: ["/protected/:path*"],
};
```

Replace the matcher with your private route tree, for example:

```ts
export const config = {
  matcher: ["/preview/:path*", "/admin-preview/:path*"],
};
```

After successful authentication, Gate redirects to the original protected URL through the local `next` query parameter. External redirect targets are rejected by the client.

## Security model

Gate is intended for private previews, staging environments, lightweight member areas, internal tools, and similar shared-secret access control.

The credential is validated only on the server. A successful request receives an HMAC-signed session token in an `HttpOnly`, `SameSite=Lax` cookie. `proxy.ts` verifies the signature and expiration before the protected route renders.

Gate intentionally does **not** implement a database-backed rate limiter. For internet-facing deployments, add rate limiting at the platform edge (for example Vercel Firewall) and use a high-entropy credential. For per-user identity, audit trails, MFA, password reset, or authorization roles, use a full authentication system instead of a shared Gate credential.

## Project structure

```text
app/
  api/gate/unlock/route.ts   credential exchange
  api/gate/logout/route.ts   session removal
  protected/page.tsx         protected reference content
  page.tsx                   Gate entrance
components/
  gate-shell.tsx             Vault / Cipher / Classic UI
  lock-button.tsx            explicit logout action
lib/
  gate.ts                     configuration + credential validation
  session.ts                  signed session creation/verification
proxy.ts                      protected-route boundary
```

## Direction

Gate is deliberately small. Useful next layers are:

- reusable package/API for dropping Gate into another Next.js app
- visual theme builder and exported configuration
- optional one-time and expiring guest codes
- per-code labels and lightweight access events
- reverse-proxy/reference adapter for protecting legacy sites
- pluggable rate-limit adapters

The core principle stays the same: **access control can be functional without looking like a system dialog.**

## License

MIT
