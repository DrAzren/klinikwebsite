import { ActionForm, Submit } from "@/components/staff/form";
import { Card, Notice, PageHeader, Status, Table, Td } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { env, integrationModes } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { jobStats } from "@/lib/integrations/jobs";
import { reconcileAction, retryJobAction, runJobsAction } from "../../../actions/admin";

export const metadata = { title: "Integrations" };

const LABEL: Record<string, [string, string]> = {
  database: ["Pangkalan data", "DATABASE_URL (Supabase Postgres). Demo = embedded PGlite."],
  email: ["E-mel (SMTP)", "SMTP_HOST / SMTP_USER / SMTP_PASS. Demo = disimpan dalam outbox di bawah."],
  drive: ["Google Drive — saringan", "GOOGLE_* + GOOGLE_DRIVE_SCREENING_FOLDER_ID"],
  sheets: ["Google Sheets — pentadbiran saringan", "GOOGLE_* + GOOGLE_SHEETS_SCREENING_ID"],
  documentsDrive: ["Google Drive — dokumen", "GOOGLE_* + GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID"],
  storage: ["Storan fail peribadi", "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"],
  encryptionKey: ["Kunci penyulitan", "APP_ENCRYPTION_KEY (32 bait, base64). Wajib dalam produksi."],
};

export default async function IntegrationsPage() {
  await requireStaff("integrations:view");
  const db = await getDb();
  const modes = integrationModes();
  const e = env();
  const [stats, failed, outbox] = await Promise.all([
    jobStats(db),
    db.query<{ id: string; kind: string; status: string; attempts: number; max_attempts: number; last_error: string | null; next_run_at: Date; updated_at: Date }>(
      "select id, kind, status, attempts, max_attempts, last_error, next_run_at, updated_at from integration_jobs where status in ('failed','dead','pending') order by updated_at desc limit 50",
    ),
    db.query<{ id: string; at: Date; transport: string; to_addresses: string; subject: string; body_text: string }>("select id, at, transport, to_addresses, subject, body_text from email_outbox order by at desc limit 20"),
  ]);
  const kinds = [...new Set(stats.map((s) => s.kind))];

  return (
    <>
      <PageHeader title="Integrasi · Integrations" intro="Status sambungan, baris gilir penyegerakan (cuba semula automatik dengan backoff) dan penyelarasan." actions={
        <>
          <ActionForm action={runJobsAction}><Submit variant="ghost">Proses baris gilir sekarang</Submit></ActionForm>
          <ActionForm action={reconcileAction}><Submit>Selaraskan saringan (30 hari)</Submit></ActionForm>
        </>
      } />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(modes).map(([k, m]) => (
          <div key={k} className="rounded-3xl bg-white p-5 ring-1 ring-line">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-navy-900">{LABEL[k]?.[0] ?? k}</p><Status value={m} label={m === "live" ? "LIVE" : "DEMO"} /></div>
            <p className="mt-2 text-xs text-ink-muted">{LABEL[k]?.[1]}</p>
          </div>
        ))}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-line">
          <p className="text-sm font-semibold text-navy-900">Notifikasi saringan</p>
          <p className="mt-2 text-xs text-ink-muted">{e.SCREENING_NOTIFY_EMAILS.length ? `${e.SCREENING_NOTIFY_EMAILS.length} penerima` : "SCREENING_NOTIFY_EMAILS belum ditetapkan"} · Kerjaya: {e.CAREERS_EMAIL ? "ditetapkan" : "CAREERS_EMAIL belum ditetapkan"}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 ring-1 ring-line">
          <p className="text-sm font-semibold text-navy-900">Cron</p>
          <p className="mt-2 text-xs text-ink-muted">{e.CRON_SECRET ? "CRON_SECRET ditetapkan — jadualkan GET /api/cron/jobs" : "CRON_SECRET belum ditetapkan — percubaan semula hanya selepas penghantaran baharu atau secara manual"}</p>
        </div>
      </div>
      {Object.values(modes).includes("demo") && <div className="mt-5"><Notice tone="warn">Mod DEMO tidak menghubungi Google/SMTP. Fail ditulis ke folder <code>.data/</code> tempatan. Lihat docs/CREDENTIALS.md untuk kelayakan produksi yang diperlukan.</Notice></div>}

      <Card title="Statistik baris gilir · Queue" className="mt-6">
        <Table head={["Jenis", "pending", "running", "succeeded", "failed", "dead"]} empty="Tiada kerja.">
          {kinds.map((k) => (
            <tr key={k}><Td className="font-mono text-xs">{k}</Td>
              {["pending", "running", "succeeded", "failed", "dead"].map((st) => <Td key={st}>{stats.find((x) => x.kind === k && x.status === st)?.n ?? 0}</Td>)}
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Belum selesai / gagal · Outstanding jobs" className="mt-6">
        <Table head={["Jenis", "Status", "Cubaan", "Ralat terakhir", "Seterusnya", ""]} empty="Semua kerja berjaya.">
          {failed.map((j) => (
            <tr key={j.id}>
              <Td className="font-mono text-xs">{j.kind}</Td>
              <Td><Status value={j.status} /></Td>
              <Td>{j.attempts}/{j.max_attempts}</Td>
              <Td className="max-w-md break-words text-xs text-danger">{j.last_error}</Td>
              <Td className="text-xs text-ink-muted">{formatDateTime(j.next_run_at)}</Td>
              <Td>{j.status !== "pending" && <ActionForm action={retryJobAction}><input type="hidden" name="id" value={j.id} /><Submit variant="ghost" className="!h-8 !text-xs">Cuba semula</Submit></ActionForm>}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Outbox e-mel · Email outbox (latest 20)" className="mt-6">
        <ul className="divide-y divide-line">
          {outbox.map((m) => (
            <li key={m.id} className="py-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm"><Status value={m.transport === "smtp" ? "live" : "demo"} label={m.transport} /><strong className="text-navy-900">{m.subject}</strong><span className="text-xs text-ink-muted">→ {m.to_addresses} · {formatDateTime(m.at)}</span></summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-paper p-3 text-xs text-ink-soft">{m.body_text}</pre>
              </details>
            </li>
          ))}
          {outbox.length === 0 && <li className="py-3 text-sm text-ink-muted">Tiada e-mel.</li>}
        </ul>
      </Card>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
