import { NextResponse } from "next/server";
import { setEntryContext, setSessionCookie, type EntryMode } from "@/lib/session-cookie";
import { createAuthService } from "@/services/auth";
import { createExternalEntryService } from "@/services/external-entry";

function externalEntryErrorUrl(request: Request, reason: string) {
  return new URL(`/external-entry/error?reason=${encodeURIComponent(reason)}`, request.url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const requestedMode = url.searchParams.get("mode");
  const mode: EntryMode = requestedMode === "embed" ? "embed" : "portal";
  const result = await createExternalEntryService().authenticate(token, mode);

  if (!result.ok) {
    return NextResponse.redirect(externalEntryErrorUrl(request, result.reason));
  }

  const session = await createAuthService().createSession(result.user.id);
  await setSessionCookie(session.token, session.expiresAt);
  await setEntryContext({ mode, sourceSystem: result.sourceKeys[0], expiresAt: session.expiresAt });

  const destinationPath = mode === "embed" ? "/embed" : "/";
  return NextResponse.redirect(
    new URL(`${destinationPath}?sourceSystem=${encodeURIComponent(result.sourceKeys[0])}`, request.url)
  );
}
