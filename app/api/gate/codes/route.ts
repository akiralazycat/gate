import { NextRequest, NextResponse } from "next/server";

import { accessCodesEnabled, issueRuntimeAccessCode } from "@/lib/access-codes";

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secureEqual(left: string, right: string) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function noStore(response: NextResponse) {
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function POST(request: NextRequest) {
  if (!accessCodesEnabled()) {
    return noStore(NextResponse.json({ ok: false, error: "disabled" }, { status: 404 }));
  }

  const expectedToken = process.env.GATE_ADMIN_TOKEN?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!expectedToken) {
    return noStore(NextResponse.json({ ok: false, error: "admin_not_configured" }, { status: 503 }));
  }

  if (!suppliedToken || !(await secureEqual(suppliedToken, expectedToken))) {
    return noStore(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }

  let body: { ttlSeconds?: unknown; maxUses?: unknown; label?: unknown } = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      return noStore(NextResponse.json({ ok: false, error: "request" }, { status: 400 }));
    }
  }

  const ttlSeconds = body.ttlSeconds === undefined ? 900 : Number(body.ttlSeconds);
  const maxUses = body.maxUses === undefined ? 1 : Number(body.maxUses);
  const label = body.label === undefined || body.label === null ? null : String(body.label);

  if (
    !Number.isFinite(ttlSeconds) ||
    !Number.isFinite(maxUses) ||
    (label !== null && label.length > 80)
  ) {
    return noStore(NextResponse.json({ ok: false, error: "request" }, { status: 400 }));
  }

  try {
    const issued = await issueRuntimeAccessCode({ ttlSeconds, maxUses, label });
    return noStore(NextResponse.json({
      ok: true,
      code: issued.code,
      id: issued.record.id,
      label: issued.record.label,
      expiresAt: new Date(issued.record.expiresAt).toISOString(),
      maxUses: issued.record.maxUses,
    }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    const status = reason === "vault_pin_too_short" ? 409 : 503;
    return noStore(NextResponse.json({ ok: false, error: reason }, { status }));
  }
}
