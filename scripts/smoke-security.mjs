import assert from "node:assert/strict";

const originalEnvironment = { ...process.env };

try {
  const { getGateReadiness, validateCredential } = await import("../lib/gate.ts");
  const { checkRateLimit, resetRateLimit } = await import("../lib/rate-limit.ts");
  const { createSessionToken, verifySessionToken } = await import("../lib/session.ts");

  process.env.GATE_SECRET = "old-signing-secret-with-at-least-thirty-two-characters";
  process.env.GATE_SESSION_TTL = "3600";
  delete process.env.GATE_SECRET_PREVIOUS;

  const token = await createSessionToken();
  assert.equal(await verifySessionToken(token), true, "fresh session should verify");
  assert.equal(await verifySessionToken(`${token}x`), false, "tampered session should fail");
  assert.equal(await verifySessionToken("x".repeat(4_097)), false, "oversized session should fail");

  const legacyPayload = Buffer.from(JSON.stringify({
    v: 1,
    exp: Math.floor(Date.now() / 1_000) + 60,
  })).toString("base64url");
  const legacyKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.GATE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const legacySignature = Buffer.from(await crypto.subtle.sign(
    "HMAC",
    legacyKey,
    new TextEncoder().encode(legacyPayload),
  )).toString("base64url");
  assert.equal(
    await verifySessionToken(`${legacyPayload}.${legacySignature}`),
    true,
    "version 1 sessions should survive the rollout window",
  );

  process.env.GATE_SECRET = "new-signing-secret-with-at-least-thirty-two-characters";
  process.env.GATE_SECRET_PREVIOUS = "old-signing-secret-with-at-least-thirty-two-characters";
  assert.equal(await verifySessionToken(token), true, "previous key should support rotation");
  delete process.env.GATE_SECRET_PREVIOUS;
  assert.equal(await verifySessionToken(token), false, "retired key should stop verifying");

  process.env.NODE_ENV = "production";
  process.env.GATE_MODE = "classic";
  process.env.GATE_PASSWORD = "a-high-entropy-preview-credential";
  process.env.GATE_USERNAME = "operator";
  process.env.GATE_ACCESS_CODES = "false";
  assert.equal(getGateReadiness().ready, true, "valid static setup should be ready");
  assert.deepEqual(
    await validateCredential({ username: "operator", password: "a-high-entropy-preview-credential" }),
    { ok: true },
  );
  assert.equal(
    (await validateCredential({ username: "operator", password: "wrong" })).ok,
    false,
  );

  process.env.GATE_MODE = "vault";
  process.env.GATE_PIN_LENGTH = "6";
  process.env.GATE_PASSWORD = "042731";
  assert.equal(getGateReadiness().ready, false, "example production credential should fail readiness");

  process.env.GATE_UNLOCK_RATE_LIMIT = "2";
  process.env.GATE_UNLOCK_RATE_WINDOW = "60";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const rateRequest = { headers: new Headers({ "x-forwarded-for": "192.0.2.20" }) };
  assert.equal((await checkRateLimit(rateRequest, "unlock")).allowed, true);
  assert.equal((await checkRateLimit(rateRequest, "unlock")).allowed, true);
  assert.equal((await checkRateLimit(rateRequest, "unlock")).allowed, false);
  await resetRateLimit(rateRequest, "unlock");
  assert.equal((await checkRateLimit(rateRequest, "unlock")).allowed, true);

  console.log("Gate security smoke test passed");
} finally {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
}
