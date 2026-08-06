import { NextResponse } from "next/server";
import { createAuthService } from "@/services/auth";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
}

export async function GET(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
  }

  const user = await createAuthService().getUserForSession(token);

  if (!user || !user.provisioned) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  if (user.passwordMustChange) {
    return NextResponse.json({ error: "Password change required" }, { status: 403 });
  }

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    permissions: user.roles,
    productSourceKeys: user.productSourceKeys,
    directProductSourceKeys: user.directProductSourceKeys,
    productGroupIds: user.productGroupIds
  });
}
