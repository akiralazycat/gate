import { NextRequest, NextResponse } from "next/server";

import { consumeRuntimeAccessCode } from "@/lib/access-codes";
import { isGateMode, validateCredential } from "@/lib/gate";
import { createSessionToken, GATE_SESSION_COOKIE, getSessionTtl } from "@/lib/session";

type UnlockBody = { mode?: unknown; username?: unknown; password?: unknown };

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === request.nextUrl.host; } catch { return false; }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "origin" }, { status: 403 });

  let body: UnlockBody;
  try { body = (await request.json()) as UnlockBody; }
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
