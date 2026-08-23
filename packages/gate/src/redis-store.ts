import type { GateAccessCodeRecord, GateCodeConsumeResult, GateCodeStore } from "./codes.js";

export interface GateRedisLike {
  set(key: string, value: unknown, options?: { ex?: number; nx?: boolean }): Promise<unknown>;
  eval(script: string, keys: string[], args: unknown[]): Promise<unknown>;
}

const CONSUME_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({status='missing'}) end
local record = cjson.decode(raw)
local now = tonumber(ARGV[1])
if tonumber(record.expiresAt) <= now then
  redis.call('DEL', KEYS[1])
  return cjson.encode({status='expired'})
end
local uses = tonumber(record.uses) or 0
local maxUses = tonumber(record.maxUses) or 1
if uses >= maxUses then
  redis.call('DEL', KEYS[1])
  return cjson.encode({status='spent'})
end
record.uses = uses + 1
local encoded = cjson.encode(record)
if record.uses >= maxUses then
  redis.call('DEL', KEYS[1])
else
  redis.call('SET', KEYS[1], encoded)
  redis.call('PEXPIREAT', KEYS[1], tonumber(record.expiresAt))
end
return cjson.encode({status='ok', record=record})
`;

export class RedisGateCodeStore implements GateCodeStore {
  constructor(private readonly redis: GateRedisLike, private readonly prefix = "gate:code:") {}

  async create(hash: string, record: GateAccessCodeRecord) {
    const ttl = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
    const result = await this.redis.set(`${this.prefix}${hash}`, JSON.stringify(record), { ex: ttl, nx: true });
    return result !== null;
  }

  async consume(hash: string, now: number): Promise<GateCodeConsumeResult> {
    const result = await this.redis.eval(CONSUME_SCRIPT, [`${this.prefix}${hash}`], [now]);
    const parsed = typeof result === "string" ? JSON.parse(result) as { status?: string; record?: GateAccessCodeRecord } : result as { status?: string; record?: GateAccessCodeRecord };
    if (parsed?.status === "ok" && parsed.record) return { ok: true, record: parsed.record };
    if (parsed?.status === "expired") return { ok: false, reason: "expired" };
    if (parsed?.status === "spent") return { ok: false, reason: "spent" };
    return { ok: false, reason: "missing" };
  }
}

export function createRedisGateCodeStore(redis: GateRedisLike, prefix?: string) {
  return new RedisGateCodeStore(redis, prefix);
}
