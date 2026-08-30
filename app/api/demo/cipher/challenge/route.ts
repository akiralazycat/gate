import { NextRequest, NextResponse } from "next/server";

import {
  createDemoCipherChallenge,
  DEMO_CHALLENGE_COOKIE,
  DEMO_CHALLENGE_TTL_SECONDS,
  DEMO_CREDENTIAL_COOKIE,
  readDemoCredential,
} from "@/lib/demo-gate";

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

  const record = readDemoCredential(
    request.cookies.get(DEMO_CREDENTIAL_COOKIE)?.value,
  );

  if (!record) {
    return NextResponse.json(
      { ok: false, error: "not_initialized" },
      { status: 409 },
    );
  }

  const { token, challenge } = await createDemoCipherChallenge(record);
  const response = NextResponse.json({ ok: true, challenge });
  response.cookies.set(DEMO_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/demo/cipher",
    maxAge: DEMO_CHALLENGE_TTL_SECONDS,
  });
  return response;
}
