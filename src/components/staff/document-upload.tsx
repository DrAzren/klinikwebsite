"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle2, CircleAlert, UploadCloud } from "lucide-react";

/** Upload with real progress (XMLHttpRequest) to /api/staff/documents. */
export function DocumentUpload({ categories }: { categories: { value: string; label: string }[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const field = "mt-1 h-10 w-full rounded-xl border-0 bg-paper px-3 text-sm text-navy-900 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-teal-500";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/staff/documents");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let body: { error?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        setMsg({ ok: true, text: "Dimuat naik dan dihantar untuk kelulusan. Uploaded and sent for approval." });
        form.current?.reset();
        router.refresh();
      } else setMsg({ ok: false, text: body.error ?? "Upload failed." });
    };
    xhr.onerror = () => { setProgress(null); setMsg({ ok: false, text: "Network error." }); };
    setMsg(null);
    setProgress(0);
    xhr.send(fd);
  }

  return (
    <form ref={form} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-ink-soft sm:col-span-2">Kategori
        <select name="category" className={field}>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
      </label>
      <label className="text-xs font-medium text-ink-soft sm:col-span-2">Tajuk / Title<input name="title" required maxLength={200} className={field} /></label>
      <label className="text-xs font-medium text-ink-soft">Pembekal / Supplier<input name="supplier" className={field} /></label>
      <label className="text-xs font-medium text-ink-soft">No. rujukan / Invoice no.<input name="referenceNo" className={field} /></label>
      <label className="text-xs font-medium text-ink-soft">Jumlah (RM)<input name="amount" type="number" step="0.01" min="0" className={field} /></label>
      <label className="text-xs font-medium text-ink-soft">Tarikh dokumen<input name="docDate" type="date" className={field} /></label>
      <label className="text-xs font-medium text-ink-soft sm:col-span-2">Nota<input name="notes" className={field} /></label>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper p-6 text-center text-sm text-ink-muted hover:border-teal-500 sm:col-span-2">
        <UploadCloud className="h-7 w-7 text-teal-600" />
        PDF, JPG, PNG atau WebP · maks 10 MB
        <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="text-xs" />
      </label>
      {progress !== null && (
        <div className="sm:col-span-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 overflow-hidden rounded-full bg-navy-100"><div className="h-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="mt-1 text-xs text-ink-muted">{progress}%</p>
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`flex gap-2 rounded-xl px-3 py-2 text-sm sm:col-span-2 ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{msg.text}</p>}
      <div><button disabled={progress !== null} className="inline-flex h-10 items-center rounded-full bg-navy-900 px-5 text-sm font-semibold text-white disabled:opacity-50">Muat naik / Upload</button></div>
    </form>
  );
}
