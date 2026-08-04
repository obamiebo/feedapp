import { cookies } from "next/headers";
import { sessionCookieName } from "@/services/auth";

export const entryModeCookieName = "feedback_entry_mode";
export const entrySourceCookieName = "feedback_entry_source";

function secureSessionCookie() {
  if (process.env.SESSION_COOKIE_SECURE === "false") {
    return false;
  }

  if (process.env.SESSION_COOKIE_SECURE === "true") {
    return true;
  }

  return process.env.NODE_ENV === "production";
}

function baseCookieOptions(expires?: Date) {
  return {
    expires,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: secureSessionCookie()
  };
}

export async function getSessionToken() {
  return (await cookies()).get(sessionCookieName)?.value;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(sessionCookieName, token, baseCookieOptions(expiresAt));
}

export async function clearSessionCookie() {
  (await cookies()).delete(sessionCookieName);
}

export type EntryMode = "portal" | "embed";

export async function setEntryContext(input: { mode: EntryMode; sourceSystem?: string; expiresAt: Date }) {
  const cookieStore = await cookies();

  if (input.mode === "embed") {
    cookieStore.set(entryModeCookieName, "embed", baseCookieOptions(input.expiresAt));

    if (input.sourceSystem) {
      cookieStore.set(entrySourceCookieName, input.sourceSystem, baseCookieOptions(input.expiresAt));
    }
    return;
  }

  cookieStore.delete(entryModeCookieName);
  cookieStore.delete(entrySourceCookieName);
}

export async function getEntryContext() {
  const cookieStore = await cookies();
  const mode = cookieStore.get(entryModeCookieName)?.value === "embed" ? "embed" : "portal";
  const sourceSystem = cookieStore.get(entrySourceCookieName)?.value || undefined;

  return { mode, sourceSystem };
}

export async function clearEntryContext() {
  const cookieStore = await cookies();
  cookieStore.delete(entryModeCookieName);
  cookieStore.delete(entrySourceCookieName);
}
