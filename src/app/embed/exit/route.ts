import { NextResponse } from "next/server";
import { appUrl } from "@/lib/public-url";
import { clearEntryContext } from "@/lib/session-cookie";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sourceSystem = url.searchParams.get("sourceSystem");
  await clearEntryContext();

  return NextResponse.redirect(
    appUrl(sourceSystem ? `/?sourceSystem=${encodeURIComponent(sourceSystem)}` : "/", request.url)
  );
}
