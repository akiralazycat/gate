export const DEMO_CREDENTIAL_COOKIE = "gate_demo_credential";
export const DEMO_SESSION_COOKIE = "gate_demo_session";
export const DEMO_CHALLENGE_COOKIE = "gate_demo_challenge";
export const DEMO_TTL_SECONDS = 60 * 30;
export const DEMO_CHALLENGE_TTL_SECONDS = 30;
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

type DemoChallengePayload = {
  v: 1;
  demoId: string;
  id: string;
  nonce: string;
  node: string;
  coordinates: string;
  iat: number;
  exp: number;
};

export type DemoCipherChallenge = {
  id: string;
  nonce: string;
  node: string;
  coordinates: string;
  issuedAt: number;
  expiresAt: number;
  windowSeconds: number;
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

function asArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function groupedHex(bytes: Uint8Array, groupSize = 2) {
  const value = bytesToHex(bytes);
  const groups: string[] = [];
  for (let index = 0; index < value.length; index += groupSize * 2) {
    groups.push(value.slice(index, index + groupSize * 2));
  }
  return groups.join("-");
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
        salt: asArrayBuffer(salt),
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
    asArrayBuffer(base64UrlToBytes(sessionKey)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(sessionKey: string, payload: string) {
  const key = await getHmacKey(sessionKey);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
  return `${payload}.${bytesToBase64Url(signature)}`;
}

async function verifySignedPayload(sessionKey: string, token?: string | null) {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  try {
    const key = await getHmacKey(sessionKey);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      asArrayBuffer(base64UrlToBytes(signature)),
      encoder.encode(payload),
    );
    return valid ? payload : null;
  } catch {
    return null;
  }
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
  return signPayload(record.sessionKey, encodedPayload);
}

export async function verifyDemoSessionToken(
  record: DemoCredential,
  token?: string | null,
) {
  const encodedPayload = await verifySignedPayload(record.sessionKey, token);
  if (!encodedPayload) return false;

  try {
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

export async function createDemoCipherChallenge(record: DemoCredential) {
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.min(record.exp, now + DEMO_CHALLENGE_TTL_SECONDS);
  const payload: DemoChallengePayload = {
    v: 1,
    demoId: record.id,
    id: groupedHex(randomBytes(4), 1),
    nonce: groupedHex(randomBytes(8), 2),
    node: "TYO-07",
    coordinates: "35.6762N / 139.6503E",
    iat: now,
    exp,
  };
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const token = await signPayload(record.sessionKey, encoded);
  const challenge: DemoCipherChallenge = {
    id: payload.id,
    nonce: payload.nonce,
    node: payload.node,
    coordinates: payload.coordinates,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
    windowSeconds: Math.max(1, payload.exp - payload.iat),
  };
  return { token, challenge };
}

export async function readDemoCipherChallenge(
  record: DemoCredential,
  token?: string | null,
) {
  const encoded = await verifySignedPayload(record.sessionKey, token);
  if (!encoded) return null;

  try {
    const payload = JSON.parse(
      decoder.decode(base64UrlToBytes(encoded)),
    ) as Partial<DemoChallengePayload>;
    const now = Math.floor(Date.now() / 1000);
    const valid =
      payload.v === 1 &&
      payload.demoId === record.id &&
      typeof payload.id === "string" &&
      typeof payload.nonce === "string" &&
      typeof payload.node === "string" &&
      typeof payload.coordinates === "string" &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number" &&
      Number.isFinite(payload.exp) &&
      payload.exp > now &&
      payload.exp <= record.exp &&
      payload.exp - payload.iat <= DEMO_CHALLENGE_TTL_SECONDS;

    return valid ? (payload as DemoChallengePayload) : null;
  } catch {
    return null;
  }
}
