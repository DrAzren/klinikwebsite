/**
 * Google Drive & Sheets via REST with least-privilege scopes.
 *
 * Auth options (server-side only):
 *  1. Service account (GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) added as a member of
 *     the clinic's Shared Drive. Recommended. Service accounts have no storage
 *     quota of their own, so target folders MUST live in a Shared Drive.
 *  2. OAuth refresh token for the clinic Google account (GOOGLE_OAUTH_*).
 *
 * When not configured, demo adapters write to .data/ so the pipeline (queue,
 * retries, dedupe, reconciliation) can be exercised end-to-end locally.
 */
import { mkdir, appendFile, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

const SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/spreadsheets"];
// drive.file limits access to files the app created or was explicitly given (folders shared with the SA).
// If folder access fails with drive.file, switch to the full "drive" scope for the service account.

let tokenCache: { token: string; exp: number } | null = null;

export function googleConfigured(): boolean {
  const e = env();
  return !!e.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || !!(e.GOOGLE_OAUTH_CLIENT_ID && e.GOOGLE_OAUTH_CLIENT_SECRET && e.GOOGLE_OAUTH_REFRESH_TOKEN);
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const e = env();
  const { GoogleAuth, OAuth2Client } = await import("google-auth-library");
  let token: string | null | undefined;
  if (e.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
    const credentials = JSON.parse(Buffer.from(e.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8"));
    const auth = new GoogleAuth({ credentials, scopes: [...SCOPES, "https://www.googleapis.com/auth/drive"] });
    token = await auth.getAccessToken();
  } else {
    const client = new OAuth2Client(e.GOOGLE_OAUTH_CLIENT_ID, e.GOOGLE_OAUTH_CLIENT_SECRET);
    client.setCredentials({ refresh_token: e.GOOGLE_OAUTH_REFRESH_TOKEN });
    token = (await client.getAccessToken()).token;
  }
  if (!token) throw new Error("Google auth returned no access token");
  tokenCache = { token, exp: Date.now() + 50 * 60_000 };
  return token;
}

async function gfetch(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

// ───────────── Drive ─────────────

export interface DriveUpload {
  folderId: string | undefined;
  name: string;
  mime: string;
  content: Buffer;
  /** Idempotency key stored in appProperties; an existing file with the same key is reused. */
  dedupeKey: string;
}

export async function driveUpload(u: DriveUpload): Promise<{ id: string; mode: "live" | "demo"; reused: boolean }> {
  if (!googleConfigured() || !u.folderId) {
    const dir = path.join(".data", "drive-demo", u.folderId ?? "unconfigured");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${u.dedupeKey}__${u.name}`.replace(/[^\w.\-]+/g, "_"));
    await writeFile(file, u.content);
    return { id: `demo:${file}`, mode: "demo", reused: false };
  }
  const q = `appProperties has { key='kn_key' and value='${u.dedupeKey.replace(/'/g, "")}' } and trashed = false`;
  const existing = await gfetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  ).then((r) => r.json() as Promise<{ files: { id: string }[] }>);
  if (existing.files?.[0]) return { id: existing.files[0].id, mode: "live", reused: true };

  const boundary = `kn${Date.now().toString(36)}`;
  const meta = { name: u.name, parents: [u.folderId], appProperties: { kn_key: u.dedupeKey } };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${u.mime}\r\n\r\n`),
    u.content,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await gfetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
  );
  const json = (await res.json()) as { id: string };
  return { id: json.id, mode: "live", reused: false };
}

// ───────────── Sheets ─────────────

export async function sheetAppendUnique(
  row: (string | number | boolean | null)[],
  keyColumnValue: string,
): Promise<{ mode: "live" | "demo"; appended: boolean }> {
  const e = env();
  if (!googleConfigured() || !e.GOOGLE_SHEETS_SCREENING_ID) {
    const file = path.join(".data", "sheets-demo", "screening.csv");
    await mkdir(path.dirname(file), { recursive: true });
    const existing = await readFile(file, "utf8").catch(() => "");
    if (existing.split("\n").some((l) => l.startsWith(`"${keyColumnValue}"`))) return { mode: "demo", appended: false };
    await appendFile(file, row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",") + "\n");
    return { mode: "demo", appended: true };
  }
  const tab = encodeURIComponent(e.GOOGLE_SHEETS_SCREENING_TAB);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${e.GOOGLE_SHEETS_SCREENING_ID}/values`;
  const col = await gfetch(`${base}/${tab}!A:A`).then((r) => r.json() as Promise<{ values?: string[][] }>);
  if (col.values?.some((v) => v[0] === keyColumnValue)) return { mode: "live", appended: false };
  await gfetch(`${base}/${tab}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
  return { mode: "live", appended: true };
}

/** Update the follow-up status cell for a reference (column J by convention). */
export async function sheetUpdateStatus(reference: string, status: string): Promise<void> {
  const e = env();
  if (!googleConfigured() || !e.GOOGLE_SHEETS_SCREENING_ID) return;
  const tab = encodeURIComponent(e.GOOGLE_SHEETS_SCREENING_TAB);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${e.GOOGLE_SHEETS_SCREENING_ID}/values`;
  const col = await gfetch(`${base}/${tab}!A:A`).then((r) => r.json() as Promise<{ values?: string[][] }>);
  const idx = col.values?.findIndex((v) => v[0] === reference) ?? -1;
  if (idx < 0) return;
  await gfetch(`${base}/${tab}!J${idx + 1}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: [[status]] }),
  });
}

export const SHEET_HEADER = [
  "Reference",
  "Submitted (MYT)",
  "Instruments",
  "PHQ-9",
  "PHQ-9 severity",
  "GAD-7",
  "GAD-7 severity",
  "Item 9 flag",
  "Priority",
  "Follow-up status",
  "Contact requested",
];
