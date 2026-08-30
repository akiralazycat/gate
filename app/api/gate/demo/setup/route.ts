import { NextRequest, NextResponse } from "next/server";

import {
  createDemoCredentialToken,
  GATE_DEMO_COOKIE,
  getDemoTtl,
  isInteractiveDemoAvailable,
  isInteractiveDemoEnabled,
} from "@/lib/demo";
import { getGateUiConfig } from "@/lib/gate";
import { GATE_SESSION_COOKIE } from "@/lib/session";

type SetupBody = {
  password?: unknown;
  confirmation?: unknown;
};

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
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

  if (!isInteractiveDemoEnabled()) {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 404 });
  }

  if (!isInteractiveDemoAvailable()) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  let body: SetupBody;
  try {
    body = (await request.json()) as SetupBody;
  } catch {
    return NextResponse.json({ ok: false, error: "request" }, { status: 400 });
  }

  const { pinLength } = getGateUiConfig();
  if (
    typeof body.password !== "string" ||
    typeof body.confirmation !== "string" ||
    body.password !== body.confirmation ||
    body.password.length !== pinLength ||
    !/^\d+$/.test(body.password)
  ) {
    return NextResponse.json({ ok: false, error: "credential" }, { status: 400 });
  }

  const ttl = getDemoTtl();
  const credential = await createDemoCredentialToken(body.password, ttl);
  const response = NextResponse.json({
    ok: true,
    expiresAt: credential.expiresAt,
  });

  response.cookies.set(GATE_DEMO_COOKIE, credential.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: credential.ttl,
  });

  // A newly armed demo must still be unlocked explicitly. Never carry an old
  // authenticated session across a re-key operation.
  response.cookies.set(GATE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
