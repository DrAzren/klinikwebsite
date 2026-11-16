/**
 * Durable integration job queue (Postgres).
 *
 *  - enqueue(): idempotent by dedupe_key — re-enqueueing is a no-op.
 *  - processDueJobs(): claims due jobs with FOR UPDATE SKIP LOCKED, runs the
 *    handler, and retries failures with exponential backoff (30 s → 6 h cap).
 *    After max_attempts a job becomes "dead" and is surfaced to the Super Admin.
 *  - Stale "running" jobs (crashed workers) are reclaimed after 10 minutes.
 *
 * Triggered right after each submission (next/server `after`) and by the
 * scheduled /api/cron/jobs endpoint, so nothing is lost if a request dies.
 */
import type { Db } from "../db";

export type JobKind =
  | "screening.drive"
  | "screening.sheet"
  | "screening.notify"
  | "document.drive"
  | "careers.forward";

export interface Job {
  id: string;
  kind: JobKind;
  dedupe_key: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export type JobHandler = (db: Db, job: Job) => Promise<Record<string, unknown> | void>;

export async function enqueue(db: Db, kind: JobKind, dedupeKey: string, payload: Record<string, unknown>, maxAttempts = 6) {
  await db.query(
    `insert into integration_jobs (kind, dedupe_key, payload, max_attempts)
     values ($1, $2, $3::jsonb, $4) on conflict (dedupe_key) do nothing`,
    [kind, dedupeKey, JSON.stringify(payload), maxAttempts],
  );
}

export function backoffMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 6 * 60 * 60 * 1000);
}

export async function processDueJobs(
  db: Db,
  handlers: Partial<Record<JobKind, JobHandler>>,
  opts: { limit?: number; kinds?: JobKind[]; onlyIds?: string[]; dedupeKeys?: string[] } = {},
) {
  const claimed = await db.query<Job>(
    `update integration_jobs set status = 'running', locked_at = now(), attempts = attempts + 1
      where id in (
        select id from integration_jobs
         where ((status in ('pending','failed') and next_run_at <= now())
                or (status = 'running' and locked_at < now() - interval '10 minutes'))
           and ($2::jsonb is null or kind in (select jsonb_array_elements_text($2::jsonb)))
           and ($3::jsonb is null or id::text in (select jsonb_array_elements_text($3::jsonb)))
           and ($4::jsonb is null or dedupe_key in (select jsonb_array_elements_text($4::jsonb)))
         order by next_run_at
         limit $1
         for update skip locked)
      returning id, kind, dedupe_key, payload, attempts, max_attempts`,
    [opts.limit ?? 20, opts.kinds ? JSON.stringify(opts.kinds) : null, opts.onlyIds ? JSON.stringify(opts.onlyIds) : null, opts.dedupeKeys ? JSON.stringify(opts.dedupeKeys) : null],
  );

  const summary = { claimed: claimed.length, succeeded: 0, failed: 0, dead: 0 };
  for (const job of claimed) {
    const handler = handlers[job.kind];
    try {
      if (!handler) throw new Error(`No handler for ${job.kind}`);
      const result = (await handler(db, job)) ?? {};
      await db.query(
        "update integration_jobs set status = 'succeeded', locked_at = null, last_error = null, result = $2::jsonb where id = $1",
        [job.id, JSON.stringify(result)],
      );
      summary.succeeded++;
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000);
      const dead = job.attempts >= job.max_attempts;
      await db.query(
        `update integration_jobs set status = $2, locked_at = null, last_error = $3, next_run_at = $4 where id = $1`,
        [job.id, dead ? "dead" : "failed", message, new Date(Date.now() + backoffMs(job.attempts)).toISOString()],
      );
      console.error(`[jobs] ${job.kind} ${job.id} attempt ${job.attempts} failed: ${message}`);
      if (dead) summary.dead++;
      else summary.failed++;
    }
  }
  return summary;
}

/** Manual retry from the admin UI: resets a failed/dead job for immediate processing. */
export async function retryJob(db: Db, id: string) {
  await db.query(
    "update integration_jobs set status = 'pending', next_run_at = now(), attempts = least(attempts, max_attempts - 1) where id = $1 and status in ('failed','dead')",
    [id],
  );
}

export async function jobStats(db: Db) {
  return db.query<{ kind: string; status: string; n: number }>(
    "select kind, status, count(*)::int as n from integration_jobs group by kind, status order by kind, status",
  );
}
