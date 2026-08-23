export const GATE_SESSION_COOKIE = "gate_session";

const DEFAULT_SESSION_TTL = 60 * 60 * 12;
const MIN_SESSION_TTL = 60;
const MAX_SESSION_TTL = 60 * 60 * 24 * 7;

type SessionPayload = {
  v: 1;
  exp: number;
};

function getSigningSecret() {
  return process.env.GATE_SECRET?.trim() ?? "";
}

export function getSessionTtl() {
  const parsed = Number(process.env.GATE_SESSION_TTL ?? DEFAULT_SESSION_TTL);
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_TTL;
  return Math.min(MAX_SESSION_TTL, Math.max(MIN_SESSION_TTL, Math.floor(parsed)));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function getHmacKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(ttlSeconds = getSessionTtl()) {
  const secret = getSigningSecret();
  if (!secret) throw new Error("GATE_SECRET is not configured");

  const boundedTtl = Math.min(getSessionTtl(), Math.max(1, Math.floor(ttlSeconds)));
  const payload: SessionPayload = { v: 1, exp: Math.floor(Date.now() / 1000) + boundedTtl };
  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getHmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload)));
  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionToken(token?: string | null) {
  const secret = getSigningSecret();
  if (!secret || !token) return false;

  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return false;

  try {
    const key = await getHmacKey(secret);
    const validSignature = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(encodedSignature), new TextEncoder().encode(encodedPayload));
    if (!validSignature) return false;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload))) as Partial<SessionPayload>;
    return payload.v === 1 && typeof payload.exp === "number" && Number.isFinite(payload.exp) && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
