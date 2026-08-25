import { NextRequest } from "next/server";

import { accessCodesEnabled, issueRuntimeAccessCode } from "@/lib/access-codes";
import { jsonNoStore, readJsonObject } from "@/lib/http";
import { checkRateLimit, rateLimitHeaders, resetRateLimit } from "@/lib/rate-limit";

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secureEqual(left: string, right: string) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function POST(request: NextRequest) {
  if (!accessCodesEnabled()) {
    return jsonNoStore({ ok: false, error: "disabled" }, { status: 404 });
  }

  const rateLimit = await checkRateLimit(request, "admin");
  if (!rateLimit.allowed) {
    return jsonNoStore(
      { ok: false, error: "rate_limited", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const expectedToken = process.env.GATE_ADMIN_TOKEN?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const suppliedToken = authorization.match(/^Bearer\s+([^\s]+)$/i)?.[1] ?? "";

  const tokenConfigured = Boolean(expectedToken) && !(
    process.env.NODE_ENV === "production" &&
    (expectedToken.length < 32 || expectedToken.includes("replace-with"))
  );

  if (!tokenConfigured) {
    return jsonNoStore({ ok: false, error: "admin_not_configured" }, { status: 503 });
  }

  if (!suppliedToken || !(await secureEqual(suppliedToken, expectedToken))) {
    return jsonNoStore(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "www-authenticate": "Bearer realm=\"Gate admin\"" } },
    );
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return jsonNoStore({ ok: false, error: "request" }, { status: 400 });
  const body = parsed.value;

  const ttlSeconds = body.ttlSeconds === undefined ? 900 : body.ttlSeconds;
  const maxUses = body.maxUses === undefined ? 1 : body.maxUses;
  const label = body.label === undefined || body.label === null ? null : body.label;

  if (
    typeof ttlSeconds !== "number" || !Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 2_592_000 ||
    typeof maxUses !== "number" || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > 20 ||
    (label !== null && (typeof label !== "string" || label.length > 80))
  ) {
    return jsonNoStore({ ok: false, error: "request" }, { status: 400 });
  }

  try {
    const issued = await issueRuntimeAccessCode({ ttlSeconds, maxUses, label });
    await resetRateLimit(request, "admin");
    return jsonNoStore({
      ok: true,
      code: issued.code,
      id: issued.record.id,
      label: issued.record.label,
      expiresAt: new Date(issued.record.expiresAt).toISOString(),
      maxUses: issued.record.maxUses,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    const status = reason === "vault_pin_too_short" ? 409 : 503;
    return jsonNoStore({ ok: false, error: reason }, { status });
  }
}
