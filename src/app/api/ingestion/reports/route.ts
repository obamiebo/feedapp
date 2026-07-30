import { NextResponse } from "next/server";
import type { CaseStatus } from "@/domain/types";
import { ingestionReportQuerySchema, ingestionReportSchema } from "@/lib/validation";
import { createPrismaCaseRepository } from "@/repositories/cases";
import { createIngestionService } from "@/services/ingestion";

const publicStatuses: Record<CaseStatus, string> = {
  New: "NEW",
  Assigned: "ASSIGNED",
  "In Progress": "IN_PROGRESS",
  Resolved: "RESOLVED",
  Closed: "CLOSED",
  Reopened: "REOPENED"
};

function serializeDate(value: Date) {
  return value.toISOString();
}

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
      caseID: parsed.data.caseID,
      customerID: parsed.data.customerID,
      status: publicStatuses[result.case.status],
      priority: result.case.priority
    },
    { status: result.duplicate ? 200 : 201 }
  );
}

export async function GET(request: Request) {
  const ingestion = createIngestionService();
  const auth = await ingestion.authenticate(request.headers, "");

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.reason }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = ingestionReportQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report query", issues: parsed.error.issues }, { status: 400 });
  }

  const page = await createPrismaCaseRepository().listProductReports({
    sourceSystem: auth.source.key,
    caseID: parsed.data.caseID,
    customerID: parsed.data.customerID,
    status: parsed.data.status,
    from: parsed.data.from ? new Date(parsed.data.from) : undefined,
    to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor
  });

  return NextResponse.json({
    reports: page.reports.map((report) => ({
      ...report,
      createdAt: serializeDate(report.createdAt),
      updatedAt: serializeDate(report.updatedAt)
    })),
    nextCursor: page.nextCursor
  });
}
