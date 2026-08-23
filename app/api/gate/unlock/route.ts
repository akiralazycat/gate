import { NextRequest, NextResponse } from "next/server";

import { isGateMode, validateCredential } from "@/lib/gate";
import {
  createSessionToken,
  GATE_SESSION_COOKIE,
  getSessionTtl,
} from "@/lib/session";

type UnlockBody = {
  mode?: unknown;
  username?: unknown;
  password?: unknown;
};

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "origin" }, { status: 403 });
  }

  let body: UnlockBody;

  try {
    body = (await request.json()) as UnlockBody;
  } catch {
    return NextResponse.json({ ok: false, error: "request" }, { status: 400 });
  }

  if (
    !isGateMode(body.mode) ||
    typeof body.password !== "string" ||
    body.password.length > 256 ||
    (body.username !== undefined &&
      (typeof body.username !== "string" || body.username.length > 128))
  ) {
    return NextResponse.json({ ok: false, error: "request" }, { status: 400 });
  }

  const result = await validateCredential({
    mode: body.mode,
    username: typeof body.username === "string" ? body.username : undefined,
    password: body.password,
  });

  if (!result.ok) {
    if (result.reason === "not_configured") {
      return NextResponse.json(
        { ok: false, error: "not_configured" },
        { status: 503 },
      );
    }

    // Keep failed responses from becoming a useful high-resolution timing signal.
    await new Promise((resolve) => setTimeout(resolve, 280));

    return NextResponse.json(
      { ok: false, error: "denied" },
      { status: 401 },
    );
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });

  response.cookies.set(GATE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtl(),
  });

  return response;
}
