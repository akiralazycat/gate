export type GateAccessCodeRecord = {
  id: string;
  label: string | null;
  createdAt: number;
  expiresAt: number;
  maxUses: number;
  uses: number;
};

export type GateCodeConsumeResult =
  | { ok: true; record: GateAccessCodeRecord }
  | { ok: false; reason: "missing" | "expired" | "spent" };

export interface GateCodeStore {
  create(hash: string, record: GateAccessCodeRecord): Promise<boolean>;
  consume(hash: string, now: number): Promise<GateCodeConsumeResult>;
}

export function normalizeAccessCode(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export async function hashAccessCode(value: string) {
  const data = new TextEncoder().encode(normalizeAccessCode(value));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomString(length: number, alphabet: string) {
  if (alphabet.length < 2 || alphabet.length > 128) throw new Error("invalid_alphabet");
  const output: string[] = [];
  const ceiling = 256 - (256 % alphabet.length);
  while (output.length < length) {
    const bytes = new Uint8Array(Math.max(16, length - output.length));
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= ceiling) continue;
      output.push(alphabet[byte % alphabet.length]);
      if (output.length === length) break;
    }
  }
  return output.join("");
}

export async function createGateAccessCode(store: GateCodeStore, options: {
  ttlSeconds?: number;
  maxUses?: number;
  label?: string | null;
  length?: number;
  alphabet?: string;
} = {}) {
  const ttlSeconds = Math.min(2_592_000, Math.max(60, Math.floor(options.ttlSeconds ?? 900)));
  const maxUses = Math.min(20, Math.max(1, Math.floor(options.maxUses ?? 1)));
  const length = Math.min(32, Math.max(6, Math.floor(options.length ?? 12)));
  const alphabet = options.alphabet ?? "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const now = Date.now();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomString(length, alphabet);
    const hash = await hashAccessCode(code);
    const record: GateAccessCodeRecord = {
      id: crypto.randomUUID(),
      label: options.label?.trim().slice(0, 80) || null,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
      maxUses,
      uses: 0,
    };
    if (await store.create(hash, record)) return { code, record };
  }

  throw new Error("code_collision");
}

export async function consumeGateAccessCode(store: GateCodeStore, value: string, now = Date.now()) {
  const normalized = normalizeAccessCode(value);
  if (!normalized) return { ok: false as const, reason: "missing" as const };
  return store.consume(await hashAccessCode(normalized), now);
}

export class MemoryGateCodeStore implements GateCodeStore {
  private readonly records = new Map<string, GateAccessCodeRecord>();

  async create(hash: string, record: GateAccessCodeRecord) {
    if (this.records.has(hash)) return false;
    this.records.set(hash, { ...record });
    return true;
  }

  async consume(hash: string, now: number): Promise<GateCodeConsumeResult> {
    const record = this.records.get(hash);
    if (!record) return { ok: false, reason: "missing" };
    if (record.expiresAt <= now) {
      this.records.delete(hash);
      return { ok: false, reason: "expired" };
    }
    if (record.uses >= record.maxUses) {
      this.records.delete(hash);
      return { ok: false, reason: "spent" };
    }
    const consumed = { ...record, uses: record.uses + 1 };
    if (consumed.uses >= consumed.maxUses) this.records.delete(hash);
    else this.records.set(hash, consumed);
    return { ok: true, record: consumed };
  }
}
