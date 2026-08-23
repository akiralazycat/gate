import { NextRequest, NextResponse } from "next/server";

import { GATE_SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(GATE_SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);

  if (authenticated) {
    return NextResponse.next();
  }

  const unlockUrl = new URL("/", request.url);
  unlockUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: ["/protected/:path*"],
};
