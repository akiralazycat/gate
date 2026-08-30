export const GATE_DEMO_COOKIE = "gate_demo_credential";

const DEFAULT_DEMO_TTL = 60 * 30;
const MIN_DEMO_TTL = 60 * 5;
const MAX_DEMO_TTL = 60 * 60 * 2;

type DemoCredentialPayload = {
  v: 1;
  exp: number;
  salt: string;
  verifier: string;
};

function getSigningSecret() {
  return process.env.GATE_SECRET?.trim() ?? "";
}

export function isInteractiveDemoEnabled() {
  return process.env.GATE_INTERACTIVE_DEMO === "true";
}

export function isInteractiveDemoAvailable() {
  return isInteractiveDemoEnabled() && Boolean(getSigningSecret());
}

export function getDemoTtl() {
  const parsed = Number(process.env.GATE_DEMO_TTL ?? DEFAULT_DEMO_TTL);
  if (!Number.isFinite(parsed)) return DEFAULT_DEMO_TTL;
  return Math.min(MAX_DEMO_TTL, Math.max(MIN_DEMO_TTL, Math.floor(parsed)));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getHmacKey() {
  const secret = getSigningSecret();
  if (!secret) throw new Error("GATE_SECRET is not configured");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(message: string) {
  const key = await getHmacKey();
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );
}

async function parseDemoToken(token?: string | null) {
  if (!isInteractiveDemoAvailable() || !token) return null;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;

  try {
    const key = await getHmacKey();
    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(encodedSignature),
      new TextEncoder().encode(`gate-demo-token:${encodedPayload}`),
    );
    if (!signatureValid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload)),
    ) as Partial<DemoCredentialPayload>;

    if (
      payload.v !== 1 ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp) ||
      typeof payload.salt !== "string" ||
      !payload.salt ||
      typeof payload.verifier !== "string" ||
      !payload.verifier
    ) {
      return null;
    }

    return payload as DemoCredentialPayload;
  } catch {
    return null;
  }
}

export async function createDemoCredentialToken(
  password: string,
  ttlSeconds = getDemoTtl(),
) {
  if (!isInteractiveDemoAvailable()) {
    throw new Error("interactive_demo_unavailable");
  }

  const ttl = Math.min(getDemoTtl(), Math.max(1, Math.floor(ttlSeconds)));
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToBase64Url(saltBytes);
  const verifier = bytesToBase64Url(
    await sign(`gate-demo-credential:${salt}:${password}`),
  );
  const payload: DemoCredentialPayload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + ttl,
    salt,
    verifier,
  };
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = bytesToBase64Url(
    await sign(`gate-demo-token:${encodedPayload}`),
  );

  return {
    token: `${encodedPayload}.${signature}`,
    ttl,
    expiresAt: payload.exp * 1000,
  };
}

export async function inspectDemoCredentialToken(token?: string | null) {
  const payload = await parseDemoToken(token);
  if (!payload) return { valid: false as const };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return { valid: false as const };

  return {
    valid: true as const,
    expiresAt: payload.exp * 1000,
    remainingSeconds: Math.max(1, payload.exp - now),
  };
}

export async function validateDemoCredential(
  token: string | null | undefined,
  password: string,
) {
  if (!isInteractiveDemoAvailable()) {
    return { ok: false as const, reason: "unavailable" as const };
  }

  const payload = await parseDemoToken(token);
  if (!payload) return { ok: false as const, reason: "unavailable" as const };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return { ok: false as const, reason: "expired" as const };
  }

  try {
    const key = await getHmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(payload.verifier),
      new TextEncoder().encode(
        `gate-demo-credential:${payload.salt}:${password}`,
      ),
    );

    return valid
      ? {
          ok: true as const,
          remainingSeconds: Math.max(1, payload.exp - now),
        }
      : { ok: false as const, reason: "invalid" as const };
  } catch {
    return { ok: false as const, reason: "invalid" as const };
  }
}
