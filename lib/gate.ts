export type GateMode = "vault" | "cipher" | "classic";

const MODES = new Set<GateMode>(["vault", "cipher", "classic"]);

export function getGateMode(): GateMode {
  const mode = process.env.GATE_MODE?.toLowerCase() as GateMode | undefined;
  return mode && MODES.has(mode) ? mode : "vault";
}

export function getGateUiConfig() {
  const pinLength = Number(process.env.GATE_PIN_LENGTH ?? 4);

  return {
    name: process.env.GATE_NAME?.trim() || "Private Archive",
    message: process.env.GATE_MESSAGE?.trim() || "Authorized access only",
    mode: getGateMode(),
    allowStyleSwitch: process.env.GATE_ALLOW_STYLE_SWITCH !== "false",
    pinLength: Math.min(8, Math.max(4, Number.isFinite(pinLength) ? Math.floor(pinLength) : 4)),
    configured: Boolean(
      process.env.GATE_SECRET?.trim() && process.env.GATE_PASSWORD?.length,
    ),
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

  if (!process.env.GATE_SECRET?.trim() || !expectedPassword) {
    return { ok: false as const, reason: "not_configured" as const };
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
