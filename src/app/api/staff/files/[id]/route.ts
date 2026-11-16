import { getDb } from "@/lib/db";
import { requireAction, UnauthenticatedError } from "@/lib/auth/dal";
import { ForbiddenError } from "@/lib/auth/rbac";
import { authoriseFileDownload } from "@/lib/staff/documents";

/** Authenticated, permission-checked and audited private file download. */
export async function GET(_req: Request, ctx: RouteContext<"/api/staff/files/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  try {
    const s = await requireAction();
    const f = await authoriseFileDownload(await getDb(), s, id);
    if (!f) return new Response("Not found", { status: 404 });
    const inline = f.mime === "application/pdf" || f.mime.startsWith("image/");
    return new Response(new Uint8Array(f.content), {
      headers: {
        "Content-Type": f.mime,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${f.original_name.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    if (e instanceof UnauthenticatedError) return new Response("Unauthorized", { status: 401 });
    if (e instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    console.error("[file download]", e);
    return new Response("Error", { status: 500 });
  }
}
