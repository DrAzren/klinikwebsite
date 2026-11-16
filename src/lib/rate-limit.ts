/**
 * Fixed-window rate limiter backed by Postgres, so it works across serverless
 * instances without an extra service. Keys should be hashed identifiers
 * (e.g. sha256 of IP) — never raw personal data.
 */
import type { Db } from "./db";
import { sha256Hex } from "./crypto";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function rateLimit(
  db: Db,
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const key = `${bucket}:${sha256Hex(identifier).slice(0, 32)}`;
  const row = await db.one<{ count: number }>(
    `insert into rate_limits (key, window_start, count) values ($1, $2, 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [key, windowStart.toISOString()],
  );
  const count = Number(row?.count ?? 1);
  // Opportunistic cleanup of old windows.
  if (Math.random() < 0.02) {
    await db.query("delete from rate_limits where window_start < now() - interval '1 day'");
  }
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(windowStart.getTime() + windowSeconds * 1000),
  };
}
