import { NextResponse } from "next/server";
import { ingestionReportSchema } from "@/lib/validation";
import { createIngestionService } from "@/services/ingestion";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const ingestion = createIngestionService();
  const auth = await ingestion.authenticate(request.headers, rawBody);

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.reason }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
  }

  const parsed = ingestionReportSchema.safeParse(parsedJson);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ingestion payload", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await ingestion.ingestReport(auth.source, parsed.data, parsedJson);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      accepted: true,
      duplicate: result.duplicate,
      idempotencyKey: result.idempotencyKey,
      caseId: result.case.id,
      status: result.case.status,
      priority: result.case.priority,
      sourceSystem: result.case.sourceSystem,
      externalId: result.case.externalId
    },
    { status: result.duplicate ? 200 : 201 }
  );
}
