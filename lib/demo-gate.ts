export const DEMO_CREDENTIAL_COOKIE = "gate_demo_credential";
export const DEMO_SESSION_COOKIE = "gate_demo_session";
export const DEMO_TTL_SECONDS = 60 * 30;
export const DEMO_PIN_LENGTH = 6;

const PBKDF2_ITERATIONS = 120_000;

type DemoCredential = {
  v: 1;
  id: string;
  salt: string;
  verifier: string;
  sessionKey: string;
  createdAt: number;
  exp: number;
  pinLength: number;
};

type DemoSessionPayload = {
  v: 1;
  demoId: string;
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveVerifier(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: PBKDF2_ITERATIONS,
        salt,
      },
      material,
      256,
    ),
  );
}

function secureEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function getHmacKey(sessionKey: string) {
  return crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(sessionKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function isDemoPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export async function createDemoCredential(pin: string) {
  if (!isDemoPin(pin)) throw new Error("Invalid demo PIN");

  const salt = randomBytes(16);
  const verifier = await deriveVerifier(pin, salt);
  const now = Math.floor(Date.now() / 1000);

  const record: DemoCredential = {
    v: 1,
    id: bytesToBase64Url(randomBytes(12)),
    salt: bytesToBase64Url(salt),
    verifier: bytesToBase64Url(verifier),
    sessionKey: bytesToBase64Url(randomBytes(32)),
    createdAt: now,
    exp: now + DEMO_TTL_SECONDS,
    pinLength: DEMO_PIN_LENGTH,
  };

  return record;
}

export function serializeDemoCredential(record: DemoCredential) {
  return bytesToBase64Url(encoder.encode(JSON.stringify(record)));
}

export function readDemoCredential(value?: string | null): DemoCredential | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(
      decoder.decode(base64UrlToBytes(value)),
    ) as Partial<DemoCredential>;

    const valid =
      parsed.v === 1 &&
      typeof parsed.id === "string" &&
      typeof parsed.salt === "string" &&
      typeof parsed.verifier === "string" &&
      typeof parsed.sessionKey === "string" &&
      typeof parsed.createdAt === "number" &&
      typeof parsed.exp === "number" &&
      parsed.pinLength === DEMO_PIN_LENGTH &&
      Number.isFinite(parsed.exp) &&
      parsed.exp > Math.floor(Date.now() / 1000);

    return valid ? (parsed as DemoCredential) : null;
  } catch {
    return null;
  }
}

export async function verifyDemoPin(record: DemoCredential, pin: string) {
  if (!isDemoPin(pin)) return false;

  try {
    const actual = await deriveVerifier(pin, base64UrlToBytes(record.salt));
    const expected = base64UrlToBytes(record.verifier);
    return secureEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function createDemoSessionToken(record: DemoCredential) {
  const now = Math.floor(Date.now() / 1000);
  const payload: DemoSessionPayload = {
    v: 1,
    demoId: record.id,
    exp: Math.min(record.exp, now + DEMO_TTL_SECONDS),
  };
  const encodedPayload = bytesToBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  const key = await getHmacKey(record.sessionKey);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload)),
  );
  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

export async function verifyDemoSessionToken(
  record: DemoCredential,
  token?: string | null,
) {
  if (!token) return false;

  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return false;

  try {
    const key = await getHmacKey(record.sessionKey);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(encodedSignature),
      encoder.encode(encodedPayload),
    );
    if (!valid) return false;

    const payload = JSON.parse(
      decoder.decode(base64UrlToBytes(encodedPayload)),
    ) as Partial<DemoSessionPayload>;

    return (
      payload.v === 1 &&
      payload.demoId === record.id &&
      typeof payload.exp === "number" &&
      Number.isFinite(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000) &&
      payload.exp <= record.exp
    );
  } catch {
    return false;
  }
}
