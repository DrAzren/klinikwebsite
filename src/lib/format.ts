/** "+60126081411" → "+60 12-608 1411" (falls back to the input). */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  const m = d.match(/^60(1\d)(\d{3,4})(\d{4})$/);
  return m ? `+60 ${m[1]}-${m[2]} ${m[3]}` : raw;
}

export const formatMYR = (n: number | string | null | undefined) =>
  n == null || n === "" ? "—" : new Intl.NumberFormat("ms-MY", { style: "currency", currency: "MYR" }).format(Number(n));

export const formatDate = (d: Date | string, lang: "ms" | "en" = "ms", opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(d).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-GB", { timeZone: "Asia/Kuala_Lumpur", ...opts });

export const formatDateTime = (d: Date | string, lang: "ms" | "en" = "ms") =>
  new Date(d).toLocaleString(lang === "ms" ? "ms-MY" : "en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
