/**
 * Minimal key-value persistence with three interchangeable drivers:
 *  - memory:   per-process (tests, ephemeral demos)
 *  - file:     JSON files on local disk (local development, single server)
 *  - postgres: a single `kv_store` table (production / serverless; works with Supabase)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "../config";

export type Namespace = "analyses" | "entitlements" | "ai_cache" | "ai_budget" | "discovery" | "checkout";

export interface KVStore {
  get<T>(ns: Namespace, key: string): Promise<T | null>;
  set<T>(ns: Namespace, key: string, value: T, ttlSeconds?: number): Promise<void>;
}

interface Envelope<T> {
  value: T;
  expiresAt: number | null;
}

export class MemoryStore implements KVStore {
  private data = new Map<string, Envelope<unknown>>();
  private maxEntries = 2000;

  async get<T>(ns: Namespace, key: string): Promise<T | null> {
    const k = `${ns}:${key}`;
    const e = this.data.get(k);
    if (!e) return null;
    if (e.expiresAt && e.expiresAt < Date.now()) {
      this.data.delete(k);
      return null;
    }
    return e.value as T;
  }

  async set<T>(ns: Namespace, key: string, value: T, ttlSeconds?: number) {
    if (this.data.size >= this.maxEntries) {
      const oldest = this.data.keys().next().value;
      if (oldest) this.data.delete(oldest);
    }
    this.data.set(`${ns}:${key}`, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }
}

const safeKey = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 40);

export class FileStore implements KVStore {
  constructor(private dir: string) {}

  private file(ns: Namespace, key: string) {
    return path.join(this.dir, ns, `${safeKey(key)}.json`);
  }

  async get<T>(ns: Namespace, key: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.file(ns, key), "utf8");
      const e = JSON.parse(raw) as Envelope<T>;
      if (e.expiresAt && e.expiresAt < Date.now()) return null;
      return e.value;
    } catch {
      return null;
    }
  }

  async set<T>(ns: Namespace, key: string, value: T, ttlSeconds?: number) {
    const f = this.file(ns, key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    const e: Envelope<T> = { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null };
    await fs.writeFile(f, JSON.stringify(e));
  }
}

/** Minimal subset of `pg.Pool` used by the store (lets tests inject pg-mem). */
export interface SqlPool {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export const KV_TABLE_SQL = `CREATE TABLE IF NOT EXISTS kv_store (
  ns TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  PRIMARY KEY (ns, key)
)`;

export class PostgresStore implements KVStore {
  private ready: Promise<void> | null = null;
  constructor(private pool: SqlPool) {}

  private init() {
    this.ready ??= this.pool.query(KV_TABLE_SQL).then(() => undefined);
    return this.ready;
  }

  async get<T>(ns: Namespace, key: string): Promise<T | null> {
    await this.init();
    const { rows } = await this.pool.query(
      "SELECT value, expires_at FROM kv_store WHERE ns = $1 AND key = $2",
      [ns, key],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at as string).getTime() < Date.now()) return null;
    const v = row.value;
    return (typeof v === "string" ? JSON.parse(v) : v) as T;
  }

  async set<T>(ns: Namespace, key: string, value: T, ttlSeconds?: number) {
    await this.init();
    const expires = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
    await this.pool.query(
      `INSERT INTO kv_store (ns, key, value, expires_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (ns, key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
      [ns, key, JSON.stringify(value), expires],
    );
  }
}

let instance: KVStore | null = null;
let pool: SqlPool | null | undefined;

/** Strip sslmode from the URL so our explicit TLS settings apply (pg lets URL params override config). */
export function poolOptions(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.searchParams.delete("sslmode");
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const ssl =
    process.env.DATABASE_SSL === "disable"
      ? false
      : ca
        ? { ca, rejectUnauthorized: true }
        : // Supabase's pooler presents its own CA; supply DATABASE_CA_CERT to enable full verification.
          { rejectUnauthorized: false };
  return { connectionString: url.toString(), ssl, max: 3, idleTimeoutMillis: 10_000 };
}

/** Shared Postgres pool when the postgres driver is configured (used by analytics too). */
export async function getSqlPool(): Promise<SqlPool | null> {
  if (pool !== undefined) return pool;
  const { store } = config();
  if (store.driver === "postgres" && store.databaseUrl) {
    const { Pool } = await import("pg");
    pool = new Pool(poolOptions(store.databaseUrl));
  } else {
    pool = null;
  }
  return pool;
}

export async function getStore(): Promise<KVStore> {
  if (instance) return instance;
  const { store } = config();
  const sql = await getSqlPool();
  if (sql) {
    instance = new PostgresStore(sql);
  } else if (store.driver === "file") {
    instance = new FileStore(path.resolve(store.dataDir));
  } else {
    instance = new MemoryStore();
  }
  return instance;
}

export function setStoreForTesting(store: KVStore | null, sqlPool?: SqlPool | null) {
  instance = store;
  pool = sqlPool === undefined ? null : sqlPool;
}
