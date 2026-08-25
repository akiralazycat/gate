import { NextRequest, NextResponse } from "next/server";

const JSON_CONTENT_TYPE = "application/json";
const MAX_JSON_BYTES = 4_096;

export function jsonNoStore(
  body: unknown,
  init?: { status?: number; headers?: HeadersInit },
) {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "no-store, max-age=0");
  response.headers.set("pragma", "no-cache");
  response.headers.set("x-content-type-options", "nosniff");
  return response;
}

export function isTrustedMutation(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) {
    return fetchSite === null || fetchSite === "none" || fetchSite === "same-origin";
  }

  try {
    const parsedOrigin = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.nextUrl.host;
    const expectedProtocol = forwardedProtocol ? `${forwardedProtocol}:` : request.nextUrl.protocol;
    return parsedOrigin.host === expectedHost && parsedOrigin.protocol === expectedProtocol;
  } catch {
    return false;
  }
}

export async function readJsonObject(
  request: NextRequest,
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false }> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) return { ok: false };

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    return { ok: false };
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) return { ok: false };
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false };
  }
}
