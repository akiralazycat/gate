import { NextRequest, NextResponse } from "next/server";

import {
  DEMO_CREDENTIAL_COOKIE,
  DEMO_SESSION_COOKIE,
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
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  for (const name of [DEMO_CREDENTIAL_COOKIE, DEMO_SESSION_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
