import { NextResponse, type NextRequest } from "next/server";

const entryModeCookieName = "feedback_entry_mode";
const entrySourceCookieName = "feedback_entry_source";

function secureCookie() {
  if (process.env.SESSION_COOKIE_SECURE === "false") {
    return false;
  }

  if (process.env.SESSION_COOKIE_SECURE === "true") {
    return true;
  }

  return process.env.NODE_ENV === "production";
}

export function middleware(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("entryMode");

  if (mode !== "embed") {
    return NextResponse.next();
  }

  const sourceSystem = request.nextUrl.searchParams.get("sourceSystem");
  request.cookies.set(entryModeCookieName, "embed");

  if (sourceSystem) {
    request.cookies.set(entrySourceCookieName, sourceSystem);
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });
  const cookieOptions = {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: secureCookie()
  };

  response.cookies.set(entryModeCookieName, "embed", cookieOptions);

  if (sourceSystem) {
    response.cookies.set(entrySourceCookieName, sourceSystem, cookieOptions);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)"]
};
