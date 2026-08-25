import { NextRequest } from "next/server";

import { isTrustedMutation, jsonNoStore } from "@/lib/http";
import { GATE_SESSION_COOKIE } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request)) {
    return jsonNoStore({ ok: false, error: "origin" }, { status: 403 });
  }

  const response = jsonNoStore({ ok: true });
  response.cookies.set(GATE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high",
  });

  return response;
}
