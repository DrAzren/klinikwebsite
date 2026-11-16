import "server-only";
import { cookies, headers } from "next/headers";
import { isProduction } from "../env";
import { SESSION_ABSOLUTE_MS, type RequestMeta } from "./service";

export const sessionCookieName = () => (isProduction() ? "__Host-kn_staff" : "kn_staff");

export async function setSessionCookie(token: string) {
  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(sessionCookieName());
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}
