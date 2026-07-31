import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session-cookie";
import { createAuthService } from "@/services/auth";
import { createExternalEntryService } from "@/services/external-entry";

function externalEntryErrorUrl(request: Request, reason: string) {
  return new URL(`/external-entry/error?reason=${encodeURIComponent(reason)}`, request.url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const result = await createExternalEntryService().authenticate(token);

  if (!result.ok) {
    return NextResponse.redirect(externalEntryErrorUrl(request, result.reason));
  }

  const session = await createAuthService().createSession(result.user.id);
  await setSessionCookie(session.token, session.expiresAt);

  return NextResponse.redirect(new URL(`/?sourceSystem=${encodeURIComponent(result.sourceKeys[0])}`, request.url));
}
