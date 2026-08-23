# Expiring and one-time access codes

Enable codes with:

```env
GATE_ACCESS_CODES=true
GATE_ADMIN_TOKEN=<separate-long-random-token>
UPSTASH_REDIS_REST_URL=<redis-rest-url>
UPSTASH_REDIS_REST_TOKEN=<redis-rest-token>
```

Production requires Redis. Development can use the process-local memory adapter for demonstrations, but Gate refuses that fallback in production because multiple serverless instances cannot guarantee one-time consumption from memory.

## Issue a code

`POST /api/gate/codes` is an automation/admin endpoint protected by `GATE_ADMIN_TOKEN`.

```bash
curl -X POST https://example.com/api/gate/codes \
  -H "Authorization: Bearer $GATE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ttlSeconds":900,"maxUses":1,"label":"client preview"}'
```

A successful response contains the plaintext code exactly once, plus its id and expiry. Gate stores only the SHA-256-derived lookup key and metadata; the original code is not persisted.

`maxUses=1` is a true one-time code. Higher values up to 20 create limited-use guest codes. Expiry is capped at 30 days.

## Vault mode

Vault access codes are numeric and match `GATE_PIN_LENGTH`. Gate refuses to issue Vault access codes below 6 digits. Use 6-8 digits and pair them with the Firewall rate limit.

Cipher and Classic issue 12-character codes from a reduced ambiguous-character alphabet.

## Atomic consumption

The Redis adapter consumes codes with a Lua script so read/check/increment/delete happen as one atomic operation. Two concurrent requests cannot both win the final permitted use.

When a code grants a session, the session lifetime is capped to the code's remaining lifetime. A code with 90 seconds left cannot become a 12-hour session.
