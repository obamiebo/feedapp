import { NextResponse } from "next/server";
import type { CaseStatus } from "@/domain/types";
import { ingestionReportMessageSchema } from "@/lib/validation";
import { createCaseService } from "@/services/cases";
import { createIngestionService } from "@/services/ingestion";

const publicStatuses: Record<CaseStatus, string> = {
  New: "NEW",
  Assigned: "ASSIGNED",
  "In Progress": "IN_PROGRESS",
  Resolved: "RESOLVED",
  Closed: "CLOSED",
  Reopened: "REOPENED"
};

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
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

  const parsed = ingestionReportMessageSchema.safeParse(parsedJson);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid inbound message payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { caseId } = await params;

  try {
    const result = await createCaseService().recordInboundCustomerReplyForSource({
      sourceKey: auth.source.key,
      caseId,
      channel: parsed.data.channel,
      body: parsed.data.body,
      externalMessageId: parsed.data.externalMessageId,
      customer: {
        name: parsed.data.customerName,
        email: parsed.data.customerEmail,
        phone: parsed.data.customerPhone
      }
    });

    return NextResponse.json(
      {
        accepted: true,
        caseId: result.case.id,
        externalCaseId: result.case.externalId ?? null,
        status: publicStatuses[result.case.status],
        reopened: result.reopened,
        message: {
          ...result.message,
          createdAt: result.message.createdAt.toISOString()
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Case was not found for this product source") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Inbound message failed" }, { status: 500 });
  }
}
