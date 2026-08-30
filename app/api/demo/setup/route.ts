import { NextRequest, NextResponse } from "next/server";

import {
  createDemoCredential,
  DEMO_CREDENTIAL_COOKIE,
  DEMO_SESSION_COOKIE,
  DEMO_TTL_SECONDS,
  isDemoPin,
  serializeDemoCredential,
} from "@/lib/demo-gate";

type SetupBody = {
  pin?: unknown;
  confirm?: unknown;
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

  let body: SetupBody;
  try {
    body = (await request.json()) as SetupBody;
  } catch {
    return NextResponse.json({ ok: false, error: "request" }, { status: 400 });
  }

  if (!isDemoPin(body.pin) || body.confirm !== body.pin) {
    return NextResponse.json(
      { ok: false, error: "credential" },
      { status: 400 },
    );
  }

  const record = await createDemoCredential(body.pin);
  const response = NextResponse.json({ ok: true, expiresAt: record.exp });
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(DEMO_CREDENTIAL_COOKIE, serializeDemoCredential(record), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: DEMO_TTL_SECONDS,
  });
  response.cookies.set(DEMO_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });

  return response;
}
