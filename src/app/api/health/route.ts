import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "feedapp",
    checks: {
      api: "ok",
      database: "configured-by-DATABASE_URL",
      queue: "adapter-pending",
      messaging: "adapter-pending"
    }
  });
}
