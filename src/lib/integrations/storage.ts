/**
 * Private object storage. Supabase Storage (private bucket, service-role key,
 * server-side only) when configured; local filesystem under .data/uploads
 * otherwise. Files are never public: downloads go through an authenticated,
 * permission-checked route (/api/staff/files/[id]).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

function supabase() {
  const e = env();
  if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) return null;
  return { url: e.SUPABASE_URL.replace(/\/$/, ""), key: e.SUPABASE_SERVICE_ROLE_KEY, bucket: e.SUPABASE_STORAGE_BUCKET };
}

function safeKey(key: string) {
  if (!/^[a-z0-9/_\-.]+$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

export async function putObject(key: string, content: Buffer, mime: string): Promise<"live" | "demo"> {
  safeKey(key);
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${sb.bucket}/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sb.key}`, apikey: sb.key, "Content-Type": mime, "x-upsert": "false" },
      body: new Uint8Array(content),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return "live";
  }
  const file = path.join(env().LOCAL_STORAGE_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  return "demo";
}

export async function getObject(key: string): Promise<Buffer> {
  safeKey(key);
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/authenticated/${sb.bucket}/${key}`, {
      headers: { Authorization: `Bearer ${sb.key}`, apikey: sb.key },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Storage download failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(path.join(env().LOCAL_STORAGE_DIR, key));
}
