export const GATE_SESSION_COOKIE = "gate_session";

const DEFAULT_SESSION_TTL = 60 * 60 * 12;
const MIN_SESSION_TTL = 60;
const MAX_SESSION_TTL = 60 * 60 * 24 * 7;

type SessionPayload = {
  v: 2;
  iat: number;
  exp: number;
};

function getSigningSecret() {
  const secret = process.env.GATE_SECRET?.trim() ?? "";
  if (
    process.env.NODE_ENV === "production" &&
    secret &&
    (secret.length < 32 || secret.includes("replace-with"))
  ) {
    return "";
  }
  return secret;
}

function getVerificationSecrets() {
  const previous = process.env.GATE_SECRET_PREVIOUS?.trim() ?? "";
  const usablePrevious = process.env.NODE_ENV !== "production" ||
    (previous.length >= 32 && !previous.includes("replace-with"));
  return [getSigningSecret(), usablePrevious ? previous : ""].filter(Boolean);
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

  const requestedTtl = Number.isFinite(ttlSeconds) ? Math.floor(ttlSeconds) : getSessionTtl();
  const boundedTtl = Math.min(getSessionTtl(), Math.max(1, requestedTtl));
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { v: 2, iat: issuedAt, exp: issuedAt + boundedTtl };
  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getHmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload)));
  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionToken(token?: string | null) {
  const secrets = getVerificationSecrets();
  if (secrets.length === 0 || !token || token.length > 4_096) return false;

  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return false;

  try {
    const signature = base64UrlToBytes(encodedSignature);
    const message = new TextEncoder().encode(encodedPayload);
    const checks = await Promise.all(secrets.map(async (secret) => {
      const key = await getHmacKey(secret);
      return crypto.subtle.verify("HMAC", key, signature, message);
    }));
    const validSignature = checks.some(Boolean);
    if (!validSignature) return false;
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload)),
    ) as { v?: number; iat?: number; exp?: number };
    const now = Math.floor(Date.now() / 1000);
    if (payload.v === 1) {
      return typeof payload.exp === "number" &&
        Number.isFinite(payload.exp) &&
        payload.exp > now &&
        payload.exp <= now + MAX_SESSION_TTL;
    }
    return payload.v === 2 &&
      typeof payload.iat === "number" && Number.isFinite(payload.iat) &&
      typeof payload.exp === "number" && Number.isFinite(payload.exp) &&
      payload.iat <= now + 60 &&
      payload.exp > now &&
      payload.exp > payload.iat &&
      payload.exp - payload.iat <= MAX_SESSION_TTL;
  } catch {
    return false;
  }
}
