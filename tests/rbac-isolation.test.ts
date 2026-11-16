import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { can, canViewDocument, canViewIncident, canViewLink, ForbiddenError, PERMISSIONS, ROLE_PERMISSIONS, ROLES, type Role } from "@/lib/auth/rbac";
import { CONSENT_VERSION } from "@/lib/screening/instruments";
import { submitScreening } from "@/lib/screening/service";
import { exportScreeningsCsv, getScreening, listScreenings, updateFollowUp } from "@/lib/screening/admin";
import { authoriseFileDownload, listDocuments, uploadDocument } from "@/lib/staff/documents";
import { getIncident, listIncidents, reportIncident, updateIncident } from "@/lib/staff/incidents";
import { auditLog, createAccount, listLinks, listStaff, saveLink, setActive, setRole } from "@/lib/staff/admin";
import { listItems, saveItem } from "@/lib/content/admin";
import { sniffType, type ValidatedFile } from "@/lib/files";
import { sha256Hex } from "@/lib/crypto";
import { freshDb, makeUser, sessionOf } from "./helpers";

describe("permission matrix", () => {
  it("every role maps only to known permissions", () => {
    for (const r of ROLES) for (const p of ROLE_PERMISSIONS[r]) expect(PERMISSIONS).toContain(p);
  });
  it("Super Admin holds every permission", () => {
    for (const p of PERMISSIONS) expect(can("super_admin", p)).toBe(true);
  });

  const expectations: [Role, string, boolean][] = [
    // clinical vs finance separation
    ["clinic_assistant", "screening:read", false],
    ["clinic_assistant", "finance:read", false],
    ["screening_admin", "screening:read", true],
    ["screening_admin", "finance:read", false],
    ["screening_admin", "documents:upload", false],
    ["resident_doctor", "screening:read", true],
    ["resident_doctor", "finance:read", false],
    ["resident_doctor", "screening:export", false],
    // admin-only capabilities
    ["resident_doctor", "users:manage", false],
    ["screening_admin", "users:manage", false],
    ["clinic_assistant", "content:manage", false],
    ["resident_doctor", "audit:view", false],
    ["clinic_assistant", "roster:edit", false],
    ["clinic_assistant", "swap:approve", false],
    ["clinic_assistant", "leave:review", false],
    // everyone can do the basics
    ["clinic_assistant", "leave:apply", true],
    ["clinic_assistant", "incident:report", true],
    ["screening_admin", "swap:request", true],
  ];
  it.each(expectations)("%s · %s → %s", (role, perm, expected) => {
    expect(can(role, perm as never)).toBe(expected);
  });

  it("no role and unknown roles have no permissions", () => {
    expect(can(null, "links:view")).toBe(false);
    expect(can("hacker" as Role, "links:view")).toBe(false);
  });

  it("document visibility separates finance from operations", () => {
    const inv = { category: "supplier_invoice", uploaded_by: "someone" };
    const stock = { category: "stock", uploaded_by: "someone" };
    expect(canViewDocument({ id: "x", role: "clinic_assistant" }, inv)).toBe(false);
    expect(canViewDocument({ id: "someone", role: "clinic_assistant" }, inv)).toBe(true); // own upload
    expect(canViewDocument({ id: "x", role: "clinic_assistant" }, stock)).toBe(true);
    expect(canViewDocument({ id: "x", role: "screening_admin" }, stock)).toBe(false);
    expect(canViewDocument({ id: "x", role: "super_admin" }, inv)).toBe(true);
  });

  it("confidential incidents are restricted", () => {
    const conf = { confidential: true, reporter_id: "r", assigned_to: null };
    expect(canViewIncident({ id: "x", role: "resident_doctor" }, conf)).toBe(false);
    expect(canViewIncident({ id: "r", role: "clinic_assistant" }, conf)).toBe(true);
    expect(canViewIncident({ id: "x", role: "super_admin" }, conf)).toBe(true);
    expect(canViewIncident({ id: "x", role: "resident_doctor" }, { ...conf, confidential: false })).toBe(true);
    expect(canViewIncident({ id: "x", role: "clinic_assistant" }, { ...conf, confidential: false })).toBe(false);
  });

  it("restricted links honour allowed roles", () => {
    expect(canViewLink("clinic_assistant", ["resident_doctor"])).toBe(false);
    expect(canViewLink("resident_doctor", ["resident_doctor"])).toBe(true);
    expect(canViewLink("clinic_assistant", [])).toBe(true);
    expect(canViewLink("super_admin", ["resident_doctor"])).toBe(true);
  });
});

describe("data isolation against a real database", () => {
  let db: Db;
  let ceo: ReturnType<typeof sessionOf>;
  let doctor: ReturnType<typeof sessionOf>;
  let assistant: ReturnType<typeof sessionOf>;
  let assistant2: ReturnType<typeof sessionOf>;
  let screener: ReturnType<typeof sessionOf>;
  let screeningId: string;

  const pdf = (text: string): ValidatedFile => {
    const buffer = Buffer.from(`%PDF-1.4\n${text}\n%%EOF`);
    expect(sniffType(buffer)).toBe("pdf");
    return { buffer, type: "pdf", mime: "application/pdf", sha256: sha256Hex(buffer), originalName: `${text}.pdf` };
  };

  beforeAll(async () => {
    db = await freshDb();
    ceo = sessionOf(await makeUser(db, "ceo", "super_admin"));
    doctor = sessionOf(await makeUser(db, "doc", "resident_doctor"));
    assistant = sessionOf(await makeUser(db, "asst", "clinic_assistant"));
    assistant2 = sessionOf(await makeUser(db, "asst2", "clinic_assistant"));
    screener = sessionOf(await makeUser(db, "scr", "screening_admin"));
    const out = await submitScreening(db, {
      idempotencyKey: randomUUID(), lang: "ms", consent: true, adultConfirmed: true, consentVersion: CONSENT_VERSION,
      instruments: ["phq9"], answers: { phq9: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
      contact: { name: "Rahsia Pesakit", phone: "0123456789", email: "p@example.test", age: 33, preferred: "email", consentToContact: true },
    });
    screeningId = out.id;
  });

  it("clinic assistants cannot list, open or export screening records", async () => {
    await expect(listScreenings(db, assistant)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getScreening(db, assistant, screeningId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(exportScreeningsCsv(db, assistant, {}, true)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateFollowUp(db, assistant, screeningId, { status: "closed" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("authorised clinicians can view; each view is audited", async () => {
    const rec = await getScreening(db, doctor, screeningId);
    expect(rec?.payload?.contact?.name).toBe("Rahsia Pesakit");
    const log = await db.one("select 1 from audit_log where action = 'screening.viewed' and entity_id = $1 and actor_label = 'doc'", [screeningId]);
    expect(log).not.toBeNull();
  });

  it("list rows never include the encrypted payload", async () => {
    const rows = await listScreenings(db, screener);
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).not.toContain("payload_enc");
  });

  it("export of identifiers requires screening:export (doctor denied, screening admin allowed)", async () => {
    await expect(exportScreeningsCsv(db, doctor, {}, true)).rejects.toBeInstanceOf(ForbiddenError);
    const csv = await exportScreeningsCsv(db, screener, {}, true);
    expect(csv).toContain("Rahsia Pesakit");
    const minimal = await exportScreeningsCsv(db, screener, {}, false);
    expect(minimal).not.toContain("Rahsia Pesakit");
  });

  it("screenings can only be assigned to authorised clinicians", async () => {
    await expect(updateFollowUp(db, screener, screeningId, { assignedTo: assistant.user.id })).rejects.toThrow(/authorised clinician/);
    await updateFollowUp(db, screener, screeningId, { assignedTo: doctor.user.id, status: "in_review", note: "Call tomorrow" });
    const rec = await getScreening(db, doctor, screeningId);
    expect(rec?.assigned_to).toBe(doctor.user.id);
    expect(rec?.notes[0].text).toBe("Call tomorrow");
  });

  it("finance documents are invisible to non-finance staff; screening admins see no documents", async () => {
    await uploadDocument(db, assistant, { category: "supplier_invoice", title: "Invoice A" }, pdf("invoice-a"));
    await uploadDocument(db, assistant, { category: "stock", title: "Stock count" }, pdf("stock-1"));
    const asst2Docs = await listDocuments(db, assistant2);
    expect(asst2Docs.map((d) => d.title)).toEqual(["Stock count"]);
    const ownDocs = await listDocuments(db, assistant);
    expect(ownDocs.map((d) => d.title).sort()).toEqual(["Invoice A", "Stock count"]);
    const doctorDocs = await listDocuments(db, doctor);
    expect(doctorDocs.map((d) => d.title)).toEqual(["Stock count"]);
    expect(await listDocuments(db, screener)).toEqual([]);
    const ceoDocs = await listDocuments(db, ceo);
    expect(ceoDocs).toHaveLength(2);
  });

  it("file downloads are permission-checked", async () => {
    const inv = (await listDocuments(db, ceo)).find((d) => d.title === "Invoice A")!;
    await expect(authoriseFileDownload(db, assistant2, inv.file_id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(authoriseFileDownload(db, doctor, inv.file_id)).rejects.toBeInstanceOf(ForbiddenError);
    const ok = await authoriseFileDownload(db, ceo, inv.file_id);
    expect(ok?.content.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("duplicate uploads are rejected", async () => {
    await expect(uploadDocument(db, assistant2, { category: "stock", title: "Again" }, pdf("stock-1"))).rejects.toThrow(/Duplicate/);
  });

  it("screening admins cannot upload documents", async () => {
    await expect(uploadDocument(db, screener, { category: "stock", title: "X" }, pdf("x"))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("confidential incidents are hidden from managers without incident:confidential", async () => {
    const pub = await reportIncident(db, assistant, { category: "equipment", occurredAt: new Date().toISOString(), description: "Thermometer broken in room 2", severity: "low", confidential: false, fileIds: [] });
    const conf = await reportIncident(db, assistant, { category: "patient_complaint", occurredAt: new Date().toISOString(), description: "Sensitive complaint about a colleague", severity: "high", confidential: true, fileIds: [] });
    const docView = (await listIncidents(db, doctor)).map((i) => i.id);
    expect(docView).toContain(pub.id);
    expect(docView).not.toContain(conf.id);
    await expect(getIncident(db, doctor, conf.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateIncident(db, doctor, conf.id, { status: "closed" })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listIncidents(db, assistant2)).map((i) => i.id)).not.toContain(pub.id);
    expect((await listIncidents(db, ceo)).map((i) => i.id)).toEqual(expect.arrayContaining([pub.id, conf.id]));
    expect((await getIncident(db, assistant, conf.id))?.reference).toBe(conf.reference);
  });

  it("only Super Admin manages users, content and audit log", async () => {
    await expect(listStaff(db, doctor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createAccount(db, doctor, { username: "x1", email: "x1@example.test", fullName: "X", role: "super_admin" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(auditLog(db, screener)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listItems(db, assistant, "services")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveItem(db, doctor, { collection: "services", status: "published", sort: 0, data: { slug: "evil" } })).rejects.toBeInstanceOf(ForbiddenError);
    const created = await createAccount(db, ceo, { username: "newstaff", email: "new@example.test", fullName: "New Staff", role: "clinic_assistant" });
    expect(created.tempPassword.length).toBeGreaterThanOrEqual(16);
  });

  it("protects the last Super Admin and self-deactivation", async () => {
    await expect(setActive(db, ceo, ceo.user.id, false)).rejects.toThrow(/own account/);
    await expect(setRole(db, ceo, ceo.user.id, "clinic_assistant")).rejects.toThrow(/last active Super Admin/);
  });

  it("restricted SOP links are filtered by role", async () => {
    await saveLink(db, ceo, { category: "hr", title: "Payroll policy", url: "https://example.com/p", allowedRoles: ["resident_doctor"] });
    await saveLink(db, ceo, { category: "emergency", title: "999", url: "tel:999", allowedRoles: [] });
    expect((await listLinks(db, assistant)).map((l) => l.title)).toEqual(["999"]);
    expect((await listLinks(db, doctor)).map((l) => l.title).sort()).toEqual(["999", "Payroll policy"]);
    await expect(saveLink(db, ceo, { category: "hr", title: "bad", url: "javascript:alert(1)", allowedRoles: [] })).rejects.toThrow();
  });
});
