import { cookies } from "next/headers";
import { sessionCookieName } from "@/services/auth";

export async function getSessionToken() {
  return (await cookies()).get(sessionCookieName)?.value;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(sessionCookieName, token, {
    expires: expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(sessionCookieName);
}
