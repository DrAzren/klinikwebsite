import { NextResponse, type NextRequest } from "next/server";

/**
 * Locale routing: Bahasa Melayu is served at the root ("/services"),
 * English under "/en" ("/en/services"). Internally every public page lives
 * under app/[lang], so root paths are rewritten to "/ms/...".
 * "/ms/..." URLs redirect to the canonical root path.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/ms" || pathname.startsWith("/ms/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = `/ms${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Everything except Next internals, API routes, the staff portal and static files.
    "/((?!_next/|api/|staff(?:/|$)|images/|brand/|motion/|favicon\\.ico|icon\\.svg|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.[a-zA-Z0-9]{2,5}$).*)",
  ],
};
