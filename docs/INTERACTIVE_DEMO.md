# Interactive Demo

Gate's interactive showcase lets a visitor create a temporary PIN, arm the vault, lock it, enter the same PIN, and reach the real server-protected `/protected` route.

This mode exists for the public product demo. It is intentionally separate from the normal static credential configuration.

## Enable it

```env
GATE_INTERACTIVE_DEMO=true
GATE_SECRET=<long-random-signing-secret>
GATE_PIN_LENGTH=6
GATE_DEMO_TTL=1800
```

`GATE_DEMO_TTL` is bounded to 5 minutes through 2 hours.

## Security boundary

**Do not enable Interactive Demo on a deployment whose `/protected` tree contains real private data.**

When enabled, every visitor is allowed to create a temporary credential for that browser and exchange it for a normal Gate session. That is the point of the showcase.

Production/shared-secret deployments should leave:

```env
GATE_INTERACTIVE_DEMO=false
```

and continue to use `GATE_PASSWORD`, guest codes, or another intentionally configured credential source.

## What is stored

The PIN itself is not written into the browser cookie.

Gate generates a random salt and computes an HMAC-SHA-256 credential verifier keyed by `GATE_SECRET`. The `HttpOnly`, `SameSite=Lax` demo cookie contains only:

- format version
- expiration time
- random salt
- keyed verifier
- HMAC signature covering the payload

The verifier cannot be tested offline without the server secret. The demo cookie expires automatically and can also be destroyed with **Rekey temporary demo**.

## Flow

1. **Initialize Gate** — choose the PIN.
2. **Confirm sequence** — enter it again.
3. **Arming sequence** — the server issues the signed temporary verifier and clears any old authenticated session.
4. **Gate locked** — the visitor must actually enter the PIN again.
5. **Denied path** — a wrong PIN stays outside.
6. **Granted path** — a correct PIN receives the existing signed Gate session.
7. **Vault opening** — bolts retract, rings accelerate and the aperture opens before navigation.
8. **Classified archive** — `/protected` is rendered only after `proxy.ts` verifies the session.
9. **Lock facility** — logout deletes the session and returns to the closed Gate. The temporary demo credential remains until it expires or is re-keyed.

## Relationship to production Gate

Interactive Demo changes only the reference application's showcase path. The existing production `GateShell`, Vault/Cipher/Classic surfaces, static credential policy, guest codes, session verification, and proxy boundary remain available when Interactive Demo is disabled.
