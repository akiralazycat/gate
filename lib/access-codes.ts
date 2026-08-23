import { Redis } from "@upstash/redis";
import {
  MemoryGateCodeStore,
  consumeGateAccessCode,
  createGateAccessCode,
  createRedisGateCodeStore,
  type GateCodeStore,
  type GateRedisLike,
} from "@akiralazycat/gate";

import { getGateMode, getGateUiConfig } from "@/lib/gate";

const memoryStore = new MemoryGateCodeStore();
let cachedStore: GateCodeStore | null | undefined;

export function accessCodesEnabled() {
  return process.env.GATE_ACCESS_CODES === "true";
}

function getCodeStore(): GateCodeStore | null {
  if (!accessCodesEnabled()) return null;
  if (cachedStore !== undefined) return cachedStore;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) {
    const redis = new Redis({ url, token });
    cachedStore = createRedisGateCodeStore(
      redis as unknown as GateRedisLike,
      process.env.GATE_CODE_PREFIX?.trim() || "gate:code:",
    );
    return cachedStore;
  }

  // Local development can demonstrate access codes without provisioning Redis.
  // Production deliberately refuses an in-memory store because serverless
  // instances cannot guarantee one-time consumption across replicas.
  if (process.env.NODE_ENV !== "production") {
    cachedStore = memoryStore;
    return cachedStore;
  }

  cachedStore = null;
  return null;
}

export async function issueRuntimeAccessCode(options: {
  ttlSeconds?: number;
  maxUses?: number;
  label?: string | null;
}) {
  const store = getCodeStore();
  if (!store) throw new Error("code_store_unavailable");

  const mode = getGateMode();
  const { pinLength } = getGateUiConfig();

  if (mode === "vault" && pinLength < 6) {
    throw new Error("vault_pin_too_short");
  }

  return createGateAccessCode(store, {
    ...options,
    length: mode === "vault" ? pinLength : 12,
    alphabet: mode === "vault" ? "0123456789" : "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
  });
}

export async function consumeRuntimeAccessCode(value: string) {
  const store = getCodeStore();
  if (!store) return { ok: false as const, reason: "unavailable" as const };
  return consumeGateAccessCode(store, value);
}
