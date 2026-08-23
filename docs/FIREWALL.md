# Vercel Firewall rollout

Gate treats the Vercel Firewall as a platform boundary in front of its application-layer credential checks. The repository intentionally stages rules but never publishes them automatically.

## 1. Link the project

```bash
vercel link
```

## 2. Stage observation rules

```bash
npm run firewall:stage
```

This creates two draft rate-limit rules when they do not already exist:

| Rule | Scope | Observation threshold |
| --- | --- | ---: |
| Gate unlock observe | `POST /api/gate/unlock` | 60 requests / 60s / IP |
| Gate code admin observe | `POST /api/gate/codes` | 20 requests / 60s / IP |

Both use `rate_limit` with `rate-limit-action=log`, so the threshold produces telemetry without blocking users. The script ends with `vercel firewall diff` and does **not** publish.

## 3. Publish the observation phase yourself

Inspect the diff first:

```bash
vercel firewall diff
vercel firewall rules list --expand
```

Then, when the draft looks correct:

```bash
vercel firewall publish --yes
```

Review matching traffic in the Vercel Firewall dashboard before enforcing anything. Do not infer an attacker from a user-agent or TLS fingerprint alone.

## 4. Enforce in Preview first

For unlock attempts, a reasonable first Preview policy is around 15 attempts per minute per IP with a challenge when exceeded. For the admin code endpoint, use a lower threshold such as 6 per minute and a normal rate-limit response.

When editing a rule, remember that supplying `--condition` replaces its conditions. Preserve the path and method conditions and add `environment=preview`. Example shape:

```bash
vercel firewall rules edit "Gate unlock observe" \
  --condition '{"type":"path","op":"eq","value":"/api/gate/unlock"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --condition '{"type":"environment","op":"eq","value":"preview"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 15 \
  --rate-limit-keys ip \
  --rate-limit-action challenge \
  --yes

vercel firewall diff
```

Publish that draft and verify a Preview deployment before changing production behavior.

## 5. Production enforcement

After reviewing production log data and Preview behavior, remove the Preview-only condition and enforce the tuned limit. Start conservatively; the firewall is regional, and legitimate shared networks can put many visitors behind one public IP.

Keep the emergency rollback simple:

```bash
vercel firewall rules edit "Gate unlock observe" --rate-limit-action log --yes
vercel firewall publish --yes
```

## What Gate already does behind the Firewall

Firewall throttling is not the authentication mechanism. Gate still validates credentials server-side, delays failed responses, signs sessions with HMAC-SHA-256, and atomically consumes one-time codes in Redis. The Firewall reduces brute-force volume and infrastructure exposure before those requests reach the application.
