import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Lock } from "lucide-react";
import { ActionForm, Submit } from "@/components/staff/form";
import { Card, Checkbox, Notice, PageHeader, Select, Status, Textarea } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { clinicians, FOLLOW_UP_LABEL, FOLLOW_UP_STATUSES, getScreening, severityLabel } from "@/lib/screening/admin";
import { DIFFICULTY_OPTIONS, FREQUENCY_OPTIONS, INSTRUMENTS } from "@/lib/screening/instruments";
import { followUpAction, patientEmailAction } from "../../../actions/admin";

export const metadata = { title: "Screening record" };

export default async function ScreeningRecord({ params }: PageProps<"/staff/screening/[id]">) {
  const s = await requireStaff("screening:read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const rec = await getScreening(db, s, id);
  if (!rec) notFound();
  const docs = await clinicians(db);
  const p = rec.payload;
  const role = s.user.role;
  const canEmail = can(role, "screening:contact_patient") && rec.contact_requested && !!p?.contact?.email;

  return (
    <>
      <Link href="/staff/screening" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" />Saringan</Link>
      <PageHeader title={rec.reference} intro={`Dihantar ${formatDateTime(rec.submitted_at)} · ${rec.lang.toUpperCase()} · persetujuan ${rec.consent_version} · simpan hingga ${rec.retention_until}`}
        actions={<><Status value={rec.priority} /><Status value={rec.follow_up_status} label={FOLLOW_UP_LABEL[rec.follow_up_status].ms} /></>} />
      {rec.item9_positive && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-danger px-5 py-4 text-white">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <div><p className="font-semibold">PHQ-9 item 9 positif (nilai {rec.item9_value}) — semakan klinikal segera diperlukan.</p><p className="text-sm text-white/85">Ikut protokol penilaian risiko bunuh diri klinik. Pesakit telah ditunjukkan maklumat 999 / HEAL 15555 / Befrienders.</p></div>
        </div>
      )}
      {!p && <Notice tone="warn">Kandungan rekod ini telah dipadam mengikut polisi penyimpanan. Payload removed under the retention policy.</Notice>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {p && (["phq9", "gad7"] as const).map((inst) => {
            const answers = p.answers[inst];
            if (!answers) return null;
            const score = inst === "phq9" ? rec.phq9_score : rec.gad7_score;
            const sev = inst === "phq9" ? rec.phq9_severity : rec.gad7_severity;
            const diff = p.answers[`${inst}Difficulty` as "phq9Difficulty" | "gad7Difficulty"];
            return (
              <Card key={inst} title={`${INSTRUMENTS[inst].name}: ${score}/${INSTRUMENTS[inst].maxScore} — ${severityLabel(sev, "ms")}`}>
                <ol className="divide-y divide-line text-sm">
                  {INSTRUMENTS[inst].items.map((item, i) => (
                    <li key={i} className={`flex items-start justify-between gap-4 py-2.5 ${inst === "phq9" && i === 8 && answers[i] > 0 ? "rounded-lg bg-danger-soft px-2" : ""}`}>
                      <span className="text-ink-soft">{i + 1}. {item.ms}</span>
                      <span className="shrink-0 font-semibold text-navy-900">{answers[i]} <span className="text-xs font-normal text-ink-muted">{FREQUENCY_OPTIONS[answers[i]].label.ms}</span></span>
                    </li>
                  ))}
                </ol>
                {diff != null && <p className="mt-3 text-sm text-ink-muted">Kesukaran fungsi: <strong className="text-navy-900">{DIFFICULTY_OPTIONS[diff].label.ms}</strong></p>}
              </Card>
            );
          })}
          <Card title="Sejarah · Event trail">
            <ol className="space-y-2 border-l-2 border-line pl-4 text-sm">
              {rec.events.map((e, i) => <li key={i}><span className="text-xs text-ink-muted">{formatDateTime(e.at)}</span> · <strong>{e.event_type.replace(/_/g, " ")}</strong>{e.actor && ` · ${e.actor}`}</li>)}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Hubungan · Contact">
            {p?.contact ? (
              <dl className="space-y-2 text-sm">
                <div><dt className="text-ink-muted">Nama</dt><dd className="font-semibold">{p.contact.name}</dd></div>
                <div><dt className="text-ink-muted">Telefon</dt><dd><a href={`tel:${p.contact.phone}`} className="font-semibold text-teal-700">{p.contact.phone}</a></dd></div>
                {p.contact.email && <div><dt className="text-ink-muted">E-mel</dt><dd className="font-semibold">{p.contact.email}</dd></div>}
                <div><dt className="text-ink-muted">Umur · Cara dihubungi</dt><dd className="font-semibold">{p.contact.age} · {p.contact.preferred}</dd></div>
                <p className="flex gap-1.5 pt-2 text-xs text-ink-muted"><Lock className="mt-0.5 h-3 w-3" />Jangan hantar skor atau jawapan melalui WhatsApp.</p>
              </dl>
            ) : <p className="text-sm text-ink-muted">Tanpa nama — pesakit tidak meminta susulan.</p>}
          </Card>
          {can(role, "screening:manage") && (
            <Card title="Susulan · Follow-up">
              <ActionForm action={followUpAction} className="space-y-3">
                <input type="hidden" name="id" value={rec.id} />
                <Select label="Status" name="status" defaultValue={rec.follow_up_status} options={FOLLOW_UP_STATUSES.map((v) => ({ value: v, label: `${FOLLOW_UP_LABEL[v].ms} · ${FOLLOW_UP_LABEL[v].en}` }))} />
                {can(role, "screening:assign") && <Select label="Klinisian" name="assignedTo" defaultValue={rec.assigned_to ?? ""} options={[{ value: "", label: "— Belum ditugaskan —" }, ...docs.map((d) => ({ value: d.id, label: d.full_name }))]} />}
                <Textarea label="Nota klinikal (disulitkan)" name="note" rows={3} />
                <Submit>Simpan</Submit>
              </ActionForm>
              {rec.notes.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                  {rec.notes.map((n, i) => <li key={i}><p className="text-xs text-ink-muted">{formatDateTime(n.at)} · {n.by}</p><p className="whitespace-pre-wrap">{n.text}</p></li>)}
                </ul>
              )}
            </Card>
          )}
          {canEmail && (
            <Card title="E-mel pesakit · Email patient">
              <p className="mb-3 text-xs text-ink-muted">E-mel tidak mengandungi skor. Pautan laporan (pilihan) tamat dalam 7 hari, maks 3 paparan, dan memerlukan kod rujukan yang hanya dilihat pesakit di skrin keputusan.</p>
              <ActionForm action={patientEmailAction} className="space-y-3">
                <input type="hidden" name="id" value={rec.id} />
                <Textarea label="Mesej tambahan (pilihan)" name="message" rows={3} />
                <Checkbox label="Sertakan pautan laporan selamat" name="report" />
                <Submit variant="teal">Hantar e-mel</Submit>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
