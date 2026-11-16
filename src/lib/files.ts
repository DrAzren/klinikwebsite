/**
 * Upload validation and storage. File types are verified by magic bytes (the
 * browser-supplied MIME type and extension are not trusted), size-limited,
 * hashed for duplicate detection, and stored privately.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import { sha256Hex } from "./crypto";
import { putObject } from "./integrations/storage";

export type FilePurpose = "document" | "leave" | "incident" | "cv";

export const LIMITS: Record<FilePurpose, { maxBytes: number; types: SniffedType[] }> = {
  document: { maxBytes: 10 * 1024 * 1024, types: ["pdf", "jpeg", "png", "webp"] },
  leave: { maxBytes: 8 * 1024 * 1024, types: ["pdf", "jpeg", "png", "webp"] },
  incident: { maxBytes: 8 * 1024 * 1024, types: ["pdf", "jpeg", "png", "webp"] },
  cv: { maxBytes: 5 * 1024 * 1024, types: ["pdf"] },
};

export type SniffedType = "pdf" | "jpeg" | "png" | "webp";
const MIME: Record<SniffedType, string> = { pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const EXT: Record<SniffedType, string> = { pdf: "pdf", jpeg: "jpg", png: "png", webp: "webp" };

export function sniffType(buf: Buffer): SniffedType | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

export class UploadError extends Error {}

export interface ValidatedFile {
  buffer: Buffer;
  type: SniffedType;
  mime: string;
  sha256: string;
  originalName: string;
}

export async function validateUpload(file: File | null | undefined, purpose: FilePurpose): Promise<ValidatedFile> {
  if (!file || typeof file === "string" || file.size === 0) throw new UploadError("No file provided");
  const limit = LIMITS[purpose];
  if (file.size > limit.maxBytes) throw new UploadError(`File too large (max ${Math.round(limit.maxBytes / 1024 / 1024)} MB)`);
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = sniffType(buffer);
  if (!type || !limit.types.includes(type)) throw new UploadError(`File type not allowed. Allowed: ${limit.types.join(", ").toUpperCase()}`);
  const originalName = (file.name || "upload").replace(/[^\w.\- ()]+/g, "_").slice(0, 120);
  return { buffer, type, mime: MIME[type], sha256: sha256Hex(buffer), originalName };
}

export async function storeFile(db: Db, f: ValidatedFile, purpose: FilePurpose, uploadedBy: string | null): Promise<string> {
  const now = new Date();
  const key = `${purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXT[f.type]}`;
  await putObject(key, f.buffer, f.mime);
  const row = await db.one<{ id: string }>(
    `insert into files (storage_key, original_name, mime, size_bytes, sha256, purpose, uploaded_by)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [key, f.originalName, f.mime, f.buffer.length, f.sha256, purpose, uploadedBy],
  );
  return row!.id;
}
