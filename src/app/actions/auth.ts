"use server";

import { redirect } from "next/navigation";
import { clearEntryContext, clearSessionCookie, getSessionToken } from "@/lib/session-cookie";
import { createAuthService } from "@/services/auth";

export async function logoutAction() {
  const token = await getSessionToken();

  if (token) {
    await createAuthService().revokeSession(token);
  }

  await clearSessionCookie();
  await clearEntryContext();
  redirect("/login");
}
