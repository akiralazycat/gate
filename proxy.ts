import { NextRequest, NextResponse } from "next/server";

import { GATE_SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(GATE_SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);

  if (authenticated) {
    const response = NextResponse.next();
    response.headers.set("cache-control", "private, no-store, max-age=0");
    return response;
  }

  const unlockUrl = new URL("/", request.url);
  unlockUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  const response = NextResponse.redirect(unlockUrl);
  response.headers.set("cache-control", "no-store, max-age=0");
  if (token) {
    response.cookies.set(GATE_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
      priority: "high",
    });
  }
  return response;
}

export const config = {
  matcher: ["/protected/:path*"],
};
