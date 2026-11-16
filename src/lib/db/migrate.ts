/**
 * Minimal forward-only migration runner. Applies supabase/migrations/*.sql in
 * filename order and records them in app_migrations. The same files can be
 * applied with the Supabase CLI (`supabase db push`).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "./index";

export const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export async function runMigrations(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.query(`create table if not exists app_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  const done = new Set((await db.query<{ name: string }>("select name from app_migrations")).map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    await db.tx(async (t) => {
      await execMulti(t, sql);
      await t.query("insert into app_migrations(name) values ($1)", [file]);
    });
    applied.push(file);
  }
  return applied;
}

/**
 * Execute a multi-statement SQL script. Statements are split on semicolons
 * outside of quotes, comments and $$-quoted bodies.
 */
async function execMulti(db: Db, script: string) {
  for (const stmt of splitSql(script)) {
    await db.query(stmt);
  }
}

export function splitSql(script: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let dollarTag: string | null = null;
  while (i < script.length) {
    const ch = script[i];
    const rest = script.slice(i);
    if (!inSingle && !dollarTag && rest.startsWith("--")) {
      const nl = script.indexOf("\n", i);
      i = nl === -1 ? script.length : nl + 1;
      continue;
    }
    if (!inSingle) {
      const m = rest.match(/^\$[A-Za-z_]*\$/);
      if (m) {
        if (dollarTag === null) dollarTag = m[0];
        else if (dollarTag === m[0]) dollarTag = null;
        buf += m[0];
        i += m[0].length;
        continue;
      }
    }
    if (!dollarTag && ch === "'") inSingle = !inSingle;
    if (!inSingle && !dollarTag && ch === ";") {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
