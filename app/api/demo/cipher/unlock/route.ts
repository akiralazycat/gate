import { NextRequest, NextResponse } from "next/server";

import {
  createDemoSessionToken,
  DEMO_CHALLENGE_COOKIE,
  DEMO_CREDENTIAL_COOKIE,
  DEMO_SESSION_COOKIE,
  isDemoPin,
  readDemoCipherChallenge,
  readDemoCredential,
  verifyDemoPin,
} from "@/lib/demo-gate";

type CipherUnlockBody = {
  challengeId?: unknown;
  response?: unknown;
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

function consumeChallenge(response: NextResponse) {
  response.cookies.set(DEMO_CHALLENGE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/demo/cipher",
    maxAge: 0,
  });
  return response;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "origin" }, { status: 403 });
  }

  let body: CipherUnlockBody;
  try {
    body = (await request.json()) as CipherUnlockBody;
  } catch {
    return NextResponse.json({ ok: false, error: "request" }, { status: 400 });
  }

  if (typeof body.challengeId !== "string" || !isDemoPin(body.response)) {
    return NextResponse.json({ ok: false, error: "request" }, { status: 400 });
  }

  const record = readDemoCredential(
    request.cookies.get(DEMO_CREDENTIAL_COOKIE)?.value,
  );
  if (!record) {
    return consumeChallenge(
      NextResponse.json({ ok: false, error: "not_initialized" }, { status: 409 }),
    );
  }

  const challenge = await readDemoCipherChallenge(
    record,
    request.cookies.get(DEMO_CHALLENGE_COOKIE)?.value,
  );
  if (!challenge || challenge.id !== body.challengeId) {
    return consumeChallenge(
      NextResponse.json({ ok: false, error: "challenge" }, { status: 409 }),
    );
  }

  const granted = await verifyDemoPin(record, body.response);
  if (!granted) {
    await new Promise((resolve) => setTimeout(resolve, 280));
    return consumeChallenge(
      NextResponse.json({ ok: false, error: "denied" }, { status: 401 }),
    );
  }

  const token = await createDemoSessionToken(record);
  const remaining = Math.max(1, record.exp - Math.floor(Date.now() / 1000));
  const response = consumeChallenge(
    NextResponse.json({
      ok: true,
      challengeId: challenge.id,
      expiresAt: record.exp,
      channel: "HMAC-SHA-256",
    }),
  );
  response.cookies.set(DEMO_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remaining,
  });
  return response;
}
