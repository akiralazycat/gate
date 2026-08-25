import { NextRequest } from "next/server";

import { consumeRuntimeAccessCode } from "@/lib/access-codes";
import { getGateReadiness, isGateMode, validateCredential } from "@/lib/gate";
import { isTrustedMutation, jsonNoStore, readJsonObject } from "@/lib/http";
import { checkRateLimit, rateLimitHeaders, resetRateLimit } from "@/lib/rate-limit";
import { createSessionToken, GATE_SESSION_COOKIE, getSessionTtl } from "@/lib/session";

type UnlockBody = { mode?: unknown; username?: unknown; password?: unknown };

async function minimumFailureDelay(startedAt: number) {
  const target = 320 + Math.floor(Math.random() * 100);
  const remaining = target - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  if (!isTrustedMutation(request)) {
    return jsonNoStore({ ok: false, error: "origin" }, { status: 403 });
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return jsonNoStore({ ok: false, error: "request" }, { status: 400 });
  const body: UnlockBody = parsed.value;

  if (
    !isGateMode(body.mode) ||
    typeof body.password !== "string" ||
    body.password.length === 0 ||
    body.password.length > 256 ||
    (body.username !== undefined &&
      (typeof body.username !== "string" || body.username.length > 128))
  ) {
    return jsonNoStore({ ok: false, error: "request" }, { status: 400 });
  }

  const rateLimit = await checkRateLimit(request, "unlock");
  if (!rateLimit.allowed) {
    await minimumFailureDelay(startedAt);
    return jsonNoStore(
      { ok: false, error: "rate_limited", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  if (!getGateReadiness().acceptingCredentials) {
    return jsonNoStore({ ok: false, error: "not_configured" }, { status: 503 });
  }

  // The requested mode is presentation metadata only. GATE_MODE remains the
  // server-side static-credential policy and cannot be downgraded by clients.
  const staticResult = await validateCredential({
    username: typeof body.username === "string" ? body.username : undefined,
    password: body.password,
  });

  if (!staticResult.ok && staticResult.reason === "not_configured") {
    return jsonNoStore({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let sessionTtl = getSessionTtl();
  let granted = staticResult.ok;
  let via: "static" | "code" = "static";

  if (!granted) {
    try {
      const codeResult = await consumeRuntimeAccessCode(body.password);
      if (codeResult.ok) {
        granted = true;
        via = "code";
        const remaining = Math.max(1, Math.floor((codeResult.record.expiresAt - Date.now()) / 1000));
        sessionTtl = Math.min(sessionTtl, remaining);
      } else if (staticResult.reason === "static_unavailable" && codeResult.reason === "unavailable") {
        return jsonNoStore({ ok: false, error: "not_configured" }, { status: 503 });
      }
    } catch {
      return jsonNoStore({ ok: false, error: "temporarily_unavailable" }, { status: 503 });
    }
  }

  if (!granted) {
    await minimumFailureDelay(startedAt);
    return jsonNoStore({ ok: false, error: "denied" }, { status: 401 });
  }

  const token = await createSessionToken(sessionTtl);
  await resetRateLimit(request, "unlock");
  const response = jsonNoStore({ ok: true, via });
  response.cookies.set(GATE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionTtl,
    priority: "high",
  });
  return response;
}
