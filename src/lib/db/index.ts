/**
 * Database access.
 *
 * - Production: Supabase Postgres via DATABASE_URL (server-side only, TLS).
 * - Development / demo: embedded PGlite (Postgres compiled to WASM) persisted
 *   under .data/pglite, migrated and seeded automatically with demo data.
 * - Tests: in-memory PGlite (createMemoryDb).
 *
 * All SQL is plain Postgres so both drivers run the same migrations/queries.
 * Convention: pass JSON as text and cast with ::jsonb; cast counts with ::int.
 */
import { env } from "../env";
import { runMigrations } from "./migrate";

export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = Row>(text: string, params?: unknown[]): Promise<T | null>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  readonly kind: "postgres" | "pglite";
}

type Queryable = { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> };

function wrapPglite(q: Queryable & { transaction?: <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T> }): Db {
  const db: Db = {
    kind: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const res = await q.query(text, params.map(normalizeParam));
      return res.rows as T[];
    },
    async one<T>(text: string, params: unknown[] = []) {
      const rows = await db.query<T>(text, params);
      return rows[0] ?? null;
    },
    async tx<T>(fn: (d: Db) => Promise<T>) {
      if (!q.transaction) return fn(db); // already inside a transaction
      return q.transaction((t) => fn(wrapPglite(t)));
    },
  };
  return db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapPostgres(sql: any): Db {
  const db: Db = {
    kind: "postgres",
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params.map(normalizeParam));
      return Array.from(rows) as T[];
    },
    async one<T>(text: string, params: unknown[] = []) {
      const rows = await db.query<T>(text, params);
      return rows[0] ?? null;
    },
    async tx<T>(fn: (d: Db) => Promise<T>) {
      if (!sql.begin) return fn(db);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return sql.begin((t: any) => fn(wrapPostgres(t)));
    },
  };
  return db;
}

function normalizeParam(p: unknown): unknown {
  if (p === undefined) return null;
  if (p instanceof Date) return p.toISOString();
  return p;
}

const g = globalThis as unknown as { __knDb?: Promise<Db> };

async function createDefaultDb(): Promise<Db> {
  const e = env();
  if (e.DATABASE_URL) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(e.DATABASE_URL, {
      max: 5,
      idle_timeout: 20,
      prepare: false, // compatible with Supabase transaction pooler (pgbouncer)
      ssl: e.DATABASE_URL.includes("localhost") || e.DATABASE_URL.includes("127.0.0.1") ? false : "require",
    });
    return wrapPostgres(sql);
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(e.PGLITE_DIR, { recursive: true });
  const pg = await PGlite.create(e.PGLITE_DIR);
  const db = wrapPglite(pg as unknown as Queryable);
  await runMigrations(db);
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db);
  return db;
}

/** Shared database handle (lazy). */
export function getDb(): Promise<Db> {
  if (!g.__knDb) {
    g.__knDb = createDefaultDb().catch((err) => {
      g.__knDb = undefined;
      throw err;
    });
  }
  return g.__knDb;
}

/** Fresh in-memory database with all migrations applied — used by tests. */
export async function createMemoryDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create();
  const db = wrapPglite(pg as unknown as Queryable);
  await runMigrations(db);
  return db;
}

/** Test hook: route getDb() to a specific instance. */
export function __setDbForTests(db: Db) {
  g.__knDb = Promise.resolve(db);
}

/** True while `next build` prerenders pages without a real database configured. */
export function isBuildWithoutDatabase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build" && !process.env.DATABASE_URL;
}
