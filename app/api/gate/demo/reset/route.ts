import { NextRequest, NextResponse } from "next/server";

import { GATE_DEMO_COOKIE } from "@/lib/demo";
import { GATE_SESSION_COOKIE } from "@/lib/session";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "origin" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  clearCookie(response, GATE_DEMO_COOKIE);
  clearCookie(response, GATE_SESSION_COOKIE);
  return response;
}
