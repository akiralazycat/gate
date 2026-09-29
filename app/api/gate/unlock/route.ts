import { NextRequest, NextResponse } from "next/server";

import { consumeRuntimeAccessCode } from "@/lib/access-codes";
import { isGateMode, validateCredential } from "@/lib/gate";
import { createSessionToken, GATE_SESSION_COOKIE, getSessionTtl } from "@/lib/session";
import { consumeRequestBurst } from "@/lib/request-burst-limit";

type UnlockBody = { mode?: unknown; username?: unknown; password?: unknown };

const MAX_REQUEST_BYTES = 8_192;
const UNLOCK_BURST_LIMIT = 20;
const UNLOCK_BURST_WINDOW_MS = 60_000;

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === request.nextUrl.host; } catch { return false; }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "origin" }, { status: 403 });

  const burst = consumeRequestBurst(request, "gate-unlock", UNLOCK_BURST_LIMIT, UNLOCK_BURST_WINDOW_MS);
  if (!burst.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(burst.retryAfterSeconds) } },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: "request" }, { status: 413 });
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: "request" }, { status: 413 });
  }

  let body: UnlockBody;
  try { body = JSON.parse(text) as UnlockBody; }
  catch { return NextResponse.json({ ok: false, error: "request" }, { status: 400 }); }

  if (!isGateMode(body.mode) || typeof body.password !== "string" || body.password.length > 256 || (body.username !== undefined && (typeof body.username !== "string" || body.username.length > 128))) {
    return NextResponse.json({ ok: false, error: "request" }, { status: 400 });
  }

  // The requested mode is presentation metadata only. GATE_MODE remains the
  // server-side static-credential policy and cannot be downgraded by clients.
  const staticResult = await validateCredential({
    username: typeof body.username === "string" ? body.username : undefined,
    password: body.password,
  });

  if (!staticResult.ok && staticResult.reason === "not_configured") {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let sessionTtl = getSessionTtl();
  let granted = staticResult.ok;
  let via: "static" | "code" = "static";

  if (!granted) {
    const codeResult = await consumeRuntimeAccessCode(body.password);
    if (codeResult.ok) {
      granted = true;
      via = "code";
      const remaining = Math.max(1, Math.floor((codeResult.record.expiresAt - Date.now()) / 1000));
      sessionTtl = Math.min(sessionTtl, remaining);
    }
  }

  if (!granted) {
    await new Promise((resolve) => setTimeout(resolve, 280));
    return NextResponse.json({ ok: false, error: "denied" }, { status: 401 });
  }

  const token = await createSessionToken(sessionTtl);
  const response = NextResponse.json({ ok: true, via });
  response.cookies.set(GATE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionTtl,
  });
  return response;
}
