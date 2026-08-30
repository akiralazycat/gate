import { NextRequest, NextResponse } from "next/server";

import {
  createDemoSessionToken,
  DEMO_CREDENTIAL_COOKIE,
  DEMO_SESSION_COOKIE,
  isDemoPin,
  readDemoCredential,
  verifyDemoPin,
} from "@/lib/demo-gate";

type UnlockBody = {
  pin?: unknown;
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

  let body: UnlockBody;
  try {
    body = (await request.json()) as UnlockBody;
  } catch {
    return NextResponse.json({ ok: false, error: "request" }, { status: 400 });
  }

  if (!isDemoPin(body.pin)) {
    return NextResponse.json({ ok: false, error: "request" }, { status: 400 });
  }

  const record = readDemoCredential(
    request.cookies.get(DEMO_CREDENTIAL_COOKIE)?.value,
  );

  if (!record) {
    return NextResponse.json(
      { ok: false, error: "not_initialized" },
      { status: 409 },
    );
  }

  const granted = await verifyDemoPin(record, body.pin);
  if (!granted) {
    await new Promise((resolve) => setTimeout(resolve, 280));
    return NextResponse.json({ ok: false, error: "denied" }, { status: 401 });
  }

  const token = await createDemoSessionToken(record);
  const remaining = Math.max(1, record.exp - Math.floor(Date.now() / 1000));
  const response = NextResponse.json({ ok: true, expiresAt: record.exp });
  response.cookies.set(DEMO_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remaining,
  });
  return response;
}
