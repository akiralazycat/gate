export type GateMode = "vault" | "cipher" | "classic";

const MODES = new Set<GateMode>(["vault", "cipher", "classic"]);

export function getGateMode(): GateMode {
  const mode = process.env.GATE_MODE?.toLowerCase() as GateMode | undefined;
  return mode && MODES.has(mode) ? mode : "vault";
}

export function getGatePinLength() {
  const parsed = Number(process.env.GATE_PIN_LENGTH ?? 4);
  return Math.min(8, Math.max(4, Number.isFinite(parsed) ? Math.floor(parsed) : 4));
}

export function getGateUiConfig() {
  const readiness = getGateReadiness();
  const mode = getGateMode();

  return {
    name: process.env.GATE_NAME?.trim() || "Private Archive",
    message: process.env.GATE_MESSAGE?.trim() || "Authorized access only",
    mode,
    // Vault credentials can be represented by every surface. Cipher secrets
    // and Classic username/password pairs cannot be safely represented by the
    // Vault keypad, so those policies stay on their native surface.
    allowStyleSwitch: process.env.GATE_ALLOW_STYLE_SWITCH !== "false" && mode === "vault",
    pinLength: getGatePinLength(),
    configured: readiness.acceptingCredentials,
  };
}

export function getGateReadiness() {
  const mode = getGateMode();
  const pinLength = getGatePinLength();
  const signingSecret = process.env.GATE_SECRET?.trim() ?? "";
  const password = process.env.GATE_PASSWORD ?? "";
  const codesEnabled = process.env.GATE_ACCESS_CODES === "true";
  const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
  const codesOperational = codesEnabled && (process.env.NODE_ENV !== "production" || redisConfigured);
  const secretUsable = Boolean(signingSecret) && !(
    process.env.NODE_ENV === "production" &&
    (signingSecret.length < 32 || signingSecret.includes("replace-with"))
  );
  const passwordUsable = Boolean(password) &&
    !(process.env.NODE_ENV === "production" && password === "042731") &&
    (mode !== "vault" || new RegExp(`^\\d{${pinLength}}$`).test(password));
  const adminToken = process.env.GATE_ADMIN_TOKEN?.trim() ?? "";
  const adminTokenUsable = Boolean(adminToken) && !(
    process.env.NODE_ENV === "production" &&
    (adminToken.length < 32 || adminToken.includes("replace-with"))
  );
  const codeProviderUsable = codesOperational &&
    adminTokenUsable &&
    (mode !== "vault" || pinLength >= 6);
  const issues: string[] = [];

  if (!signingSecret) issues.push("signing_secret_missing");
  if (
    process.env.NODE_ENV === "production" &&
    signingSecret &&
    (signingSecret.length < 32 || signingSecret.includes("replace-with"))
  ) {
    issues.push("signing_secret_weak");
  }
  if (!password && !codesOperational) issues.push("credential_provider_missing");
  if (process.env.NODE_ENV === "production" && password === "042731") {
    issues.push("example_password_in_use");
  }
  if (codesEnabled && process.env.NODE_ENV === "production" && !redisConfigured) {
    issues.push("access_code_store_missing");
  }
  if (codesEnabled && !adminToken) {
    issues.push("admin_token_missing");
  }
  if (
    codesEnabled &&
    process.env.NODE_ENV === "production" &&
    adminToken &&
    (adminToken.length < 32 || adminToken.includes("replace-with"))
  ) {
    issues.push("admin_token_weak");
  }
  const previousSecret = process.env.GATE_SECRET_PREVIOUS?.trim() ?? "";
  if (
    process.env.NODE_ENV === "production" &&
    previousSecret &&
    (previousSecret.length < 32 || previousSecret.includes("replace-with"))
  ) {
    issues.push("previous_signing_secret_weak");
  }
  if (previousSecret && previousSecret === signingSecret) {
    issues.push("signing_secret_rotation_invalid");
  }
  if (codesEnabled && mode === "vault" && pinLength < 6) {
    issues.push("vault_code_length");
  }
  if (mode === "vault" && password && !new RegExp(`^\\d{${pinLength}}$`).test(password)) {
    issues.push("vault_password_format");
  }

  return {
    ready: issues.length === 0,
    acceptingCredentials: secretUsable && (passwordUsable || codeProviderUsable),
    issues,
  };
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function secureEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;

  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }

  return difference === 0;
}

export async function validateCredential(input: {
  username?: string;
  password?: string;
}) {
  const requiredMode = getGateMode();
  const expectedPassword = process.env.GATE_PASSWORD ?? "";
  const expectedUsername = process.env.GATE_USERNAME?.trim() || "guest";
  const pinLength = getGatePinLength();
  const staticCredentialUsable = Boolean(expectedPassword) &&
    !(process.env.NODE_ENV === "production" && expectedPassword === "042731") &&
    (requiredMode !== "vault" || new RegExp(`^\\d{${pinLength}}$`).test(expectedPassword));

  if (!process.env.GATE_SECRET?.trim() || !staticCredentialUsable) {
    return {
      ok: false as const,
      reason: !process.env.GATE_SECRET?.trim()
        ? "not_configured" as const
        : "static_unavailable" as const,
    };
  }

  const password = input.password ?? "";
  const passwordMatches = await secureEqual(password, expectedPassword);

  if (requiredMode === "classic") {
    const usernameMatches = await secureEqual(
      input.username?.trim() ?? "",
      expectedUsername,
    );

    return usernameMatches && passwordMatches
      ? { ok: true as const }
      : { ok: false as const, reason: "invalid" as const };
  }

  return passwordMatches
    ? { ok: true as const }
    : { ok: false as const, reason: "invalid" as const };
}

export function isGateMode(value: unknown): value is GateMode {
  return typeof value === "string" && MODES.has(value as GateMode);
}
