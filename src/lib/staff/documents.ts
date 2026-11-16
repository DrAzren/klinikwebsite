/**
 * Document & invoice management with duplicate prevention (SHA-256),
 * approval workflow, Drive sync and finance/operations separation.
 */
import type { Db } from "../db";
import { audit } from "../audit";
import { assertCan, can, canViewDocument, canViewIncident, FINANCE_CATEGORIES, ForbiddenError, OPS_CATEGORIES, type DocumentCategory } from "../auth/rbac";
import type { SessionInfo } from "../auth/service";
import { env } from "../env";
import { storeFile, type ValidatedFile } from "../files";
import { driveUpload } from "../integrations/google";
import { enqueue, type JobHandler } from "../integrations/jobs";
import { getObject } from "../integrations/storage";

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [...FINANCE_CATEGORIES, ...OPS_CATEGORIES];
export const CATEGORY_LABEL: Record<DocumentCategory, { ms: string; en: string }> = {
  supplier_invoice: { ms: "Invois pembekal", en: "Supplier invoice" },
  payment_receipt: { ms: "Resit bayaran", en: "Payment receipt" },
  lab_invoice: { ms: "Invois makmal", en: "Laboratory invoice" },
  stock: { ms: "Dokumen stok", en: "Stock documentation" },
  maintenance: { ms: "Penyelenggaraan peralatan", en: "Equipment maintenance" },
  admin: { ms: "Dokumen pentadbiran", en: "Administrative document" },
};

export class DocumentError extends Error {}

export interface DocumentMeta {
  category: DocumentCategory;
  title: string;
  supplier?: string;
  referenceNo?: string;
  amount?: number | null;
  docDate?: string | null;
  notes?: string;
}

export async function uploadDocument(db: Db, s: SessionInfo, meta: DocumentMeta, file: ValidatedFile) {
  assertCan(s.user.role, "documents:upload");
  if (!DOCUMENT_CATEGORIES.includes(meta.category)) throw new DocumentError("Invalid category");
  if (!meta.title.trim()) throw new DocumentError("Title is required");
  const dup = await db.one<{ title: string; created_at: Date }>("select title, created_at from documents where sha256 = $1", [file.sha256]);
  if (dup) throw new DocumentError(`Duplicate: this exact file was already uploaded as “${dup.title}”`);

  const fileId = await storeFile(db, file, "document", s.user.id);
  const row = await db.one<{ id: string }>(
    `insert into documents (category, title, supplier, reference_no, amount_myr, doc_date, notes, file_id, sha256, uploaded_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [meta.category, meta.title.slice(0, 200), meta.supplier?.slice(0, 200) || null, meta.referenceNo?.slice(0, 100) || null,
     meta.amount ?? null, meta.docDate || null, meta.notes?.slice(0, 2000) || null, fileId, file.sha256, s.user.id],
  );
  await enqueue(db, "document.drive", `document.drive:${row!.id}`, { documentId: row!.id });
  await audit(db, { id: s.user.id, label: s.user.username }, "document.uploaded", { type: "document", id: row!.id }, { category: meta.category });
  return row!.id;
}

export async function listDocuments(db: Db, s: SessionInfo, f: { q?: string; category?: string; status?: string } = {}) {
  const finance = can(s.user.role, "finance:read");
  const ops = can(s.user.role, "documents:read_ops") || finance;
  return db.query<{
    id: string; category: DocumentCategory; title: string; supplier: string | null; reference_no: string | null; amount_myr: string | null;
    doc_date: string | null; status: string; drive_status: string; uploaded_by: string; uploader: string; created_at: Date; file_id: string; original_name: string;
  }>(
    `select d.id, d.category, d.title, d.supplier, d.reference_no, d.amount_myr, to_char(d.doc_date,'YYYY-MM-DD') as doc_date, d.status, d.drive_status,
            d.uploaded_by, u.full_name as uploader, d.created_at, d.file_id, f.original_name
       from documents d join staff_users u on u.id = d.uploaded_by join files f on f.id = d.file_id
      where (d.uploaded_by = $1
             or ($2::boolean and d.category in (select jsonb_array_elements_text($4::jsonb)))
             or ($3::boolean and d.category in (select jsonb_array_elements_text($5::jsonb))))
        and ($6::text is null or d.category = $6::text)
        and ($7::text is null or d.status = $7::text)
        and ($8::text is null or (d.title ilike '%' || $8 || '%' or d.supplier ilike '%' || $8 || '%' or d.reference_no ilike '%' || $8 || '%'))
      order by d.created_at desc limit 300`,
    [s.user.id, finance, ops, JSON.stringify(FINANCE_CATEGORIES), JSON.stringify(OPS_CATEGORIES), f.category || null, f.status || null, f.q?.trim() || null],
  );
}

export async function reviewDocument(db: Db, s: SessionInfo, id: string, decision: "approved" | "rejected", comment: string) {
  assertCan(s.user.role, "documents:approve");
  const doc = await db.one<{ category: string; uploaded_by: string }>("select category, uploaded_by from documents where id = $1", [id]);
  if (!doc) throw new DocumentError("Not found");
  if (!canViewDocument({ id: s.user.id, role: s.user.role }, doc)) throw new ForbiddenError("finance:read");
  await db.query("update documents set status = $2, approver_id = $3, approved_at = now(), review_comment = $4 where id = $1", [id, decision, s.user.id, comment || null]);
  await audit(db, { id: s.user.id, label: s.user.username }, `document.${decision}`, { type: "document", id });
}

/** Central permission check for every private file download. */
export async function authoriseFileDownload(db: Db, s: SessionInfo, fileId: string) {
  const f = await db.one<{ id: string; storage_key: string; original_name: string; mime: string; purpose: string; uploaded_by: string | null }>(
    "select id, storage_key, original_name, mime, purpose, uploaded_by from files where id = $1",
    [fileId],
  );
  if (!f) return null;
  const viewer = { id: s.user.id, role: s.user.role };
  let ok = false;
  if (f.purpose === "document") {
    const d = await db.one<{ category: string; uploaded_by: string }>("select category, uploaded_by from documents where file_id = $1", [fileId]);
    ok = !!d && canViewDocument(viewer, d);
  } else if (f.purpose === "leave") {
    const l = await db.one<{ user_id: string }>("select user_id from leave_requests where attachment_file_id = $1", [fileId]);
    ok = !!l && (l.user_id === s.user.id || can(s.user.role, "leave:review"));
    if (!l && f.uploaded_by === s.user.id) ok = true;
  } else if (f.purpose === "incident") {
    const i = await db.one<{ confidential: boolean; reporter_id: string; assigned_to: string | null }>(
      "select i.confidential, i.reporter_id, i.assigned_to from incident_files x join incidents i on i.id = x.incident_id where x.file_id = $1",
      [fileId],
    );
    ok = !!i && canViewIncident(viewer, i);
    if (!i && f.uploaded_by === s.user.id) ok = true;
  } else if (f.purpose === "cv") {
    ok = can(s.user.role, "users:manage");
  }
  if (!ok) throw new ForbiddenError("file:download");
  await audit(db, { id: s.user.id, label: s.user.username }, "file.downloaded", { type: "file", id: fileId }, { purpose: f.purpose });
  return { ...f, content: await getObject(f.storage_key) };
}

function folderFor(category: string): string | undefined {
  const e = env();
  if (e.GOOGLE_DRIVE_DOCUMENT_FOLDERS_JSON) {
    try {
      const map = JSON.parse(e.GOOGLE_DRIVE_DOCUMENT_FOLDERS_JSON) as Record<string, string>;
      if (map[category]) return map[category];
    } catch {
      /* fall through to the default folder */
    }
  }
  return e.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID;
}

export const documentDriveHandler: JobHandler = async (db, job) => {
  const d = await db.one<{ id: string; category: string; title: string; doc_date: string | null; storage_key: string; mime: string; original_name: string }>(
    `select d.id, d.category, d.title, to_char(d.doc_date,'YYYY-MM-DD') as doc_date, f.storage_key, f.mime, f.original_name
       from documents d join files f on f.id = d.file_id where d.id = $1`,
    [String(job.payload.documentId)],
  );
  if (!d) throw new Error("Document not found");
  const ext = d.original_name.includes(".") ? d.original_name.split(".").pop() : "bin";
  const res = await driveUpload({
    folderId: folderFor(d.category),
    name: `${d.doc_date ?? new Date().toISOString().slice(0, 10)}_${d.category}_${d.title}`.replace(/[^\w\- ]+/g, "_").slice(0, 120) + `.${ext}`,
    mime: d.mime,
    content: await getObject(d.storage_key),
    dedupeKey: `document-${d.id}`,
  });
  await db.query("update documents set drive_file_id = $2, drive_status = $3 where id = $1", [d.id, res.id, res.mode === "live" ? "synced" : "demo"]);
  return { driveFileId: res.id, mode: res.mode };
};
