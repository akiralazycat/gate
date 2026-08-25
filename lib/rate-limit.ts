import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

type RateLimitKind = "unlock" | "admin";

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
};

type MemoryEntry = { count: number; resetAt: number };

const memoryCounters = new Map<string, MemoryEntry>();
const MEMORY_COUNTER_LIMIT = 5_000;
let cachedRedis: Redis | null | undefined;

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function settings(kind: RateLimitKind) {
  if (kind === "admin") {
    return {
      limit: boundedInteger(process.env.GATE_ADMIN_RATE_LIMIT, 6, 1, 100),
      windowSeconds: boundedInteger(process.env.GATE_ADMIN_RATE_WINDOW, 60, 10, 3_600),
    };
  }

  return {
    limit: boundedInteger(process.env.GATE_UNLOCK_RATE_LIMIT, 10, 1, 1_000),
    windowSeconds: boundedInteger(process.env.GATE_UNLOCK_RATE_WINDOW, 60, 10, 3_600),
  };
}

function getRedis() {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  cachedRedis = url && token ? new Redis({ url, token }) : null;
  return cachedRedis;
}

function clientAddress(request: NextRequest) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

async function identifierFor(request: NextRequest) {
  const material = `${process.env.GATE_SECRET ?? "gate"}:${clientAddress(request)}`;
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material)),
  );
  return Array.from(digest.slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function counterKey(request: NextRequest, kind: RateLimitKind, windowSeconds: number) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1_000));
  return {
    bucket,
    key: `gate:rate:${kind}:${await identifierFor(request)}:${bucket}`,
  };
}

function pruneMemory(now: number) {
  if (memoryCounters.size < MEMORY_COUNTER_LIMIT) return;
  for (const [key, entry] of memoryCounters) {
    if (entry.resetAt <= now) memoryCounters.delete(key);
  }
  while (memoryCounters.size >= MEMORY_COUNTER_LIMIT) {
    const oldestKey = memoryCounters.keys().next().value as string | undefined;
    if (!oldestKey) break;
    memoryCounters.delete(oldestKey);
  }
}

function memoryAttempt(key: string, now: number, windowSeconds: number) {
  pruneMemory(now);
  const existing = memoryCounters.get(key);
  const entry = !existing || existing.resetAt <= now
    ? { count: 1, resetAt: now + windowSeconds * 1_000 }
    : { ...existing, count: existing.count + 1 };
  memoryCounters.delete(key);
  memoryCounters.set(key, entry);
  return entry.count;
}

export async function checkRateLimit(
  request: NextRequest,
  kind: RateLimitKind,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = settings(kind);
  const now = Date.now();
  const { bucket, key } = await counterKey(request, kind, windowSeconds);
  let count: number;

  const redis = getRedis();
  if (redis) {
    try {
      const created = await redis.set(key, 1, { ex: windowSeconds + 1, nx: true });
      count = created === null ? await redis.incr(key) : 1;
    } catch {
      count = memoryAttempt(key, now, windowSeconds);
    }
  } else {
    count = memoryAttempt(key, now, windowSeconds);
  }

  const retryAfter = Math.max(1, Math.ceil(((bucket + 1) * windowSeconds * 1_000 - now) / 1_000));
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfter,
  };
}

export async function resetRateLimit(request: NextRequest, kind: RateLimitKind) {
  const { windowSeconds } = settings(kind);
  const { key } = await counterKey(request, kind, windowSeconds);
  memoryCounters.delete(key);
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Authentication must remain available if the optional limiter store is down.
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "retry-after": String(result.retryAfter),
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
  };
}
