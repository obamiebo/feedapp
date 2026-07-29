import { NextResponse } from "next/server";
import { canEnterApplication } from "@/lib/access-control";
import { StubCustomerAnalyticsClient } from "@/lib/analytics";
import { resolveCurrentUser } from "@/lib/current-user";
import { createCaseService } from "@/services/cases";

function passwordChangeRequiredResponse() {
  return NextResponse.json({ error: "Password change required" }, { status: 403 });
}

export async function GET(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const currentUser = await resolveCurrentUser();

  if (!currentUser || !canEnterApplication(currentUser)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (currentUser.passwordMustChange) {
    return passwordChangeRequiredResponse();
  }

  const { customerId } = await context.params;
  const caseId = new URL(request.url).searchParams.get("caseId");

  if (!caseId) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }

  const caseDetail = await createCaseService().getCaseDetailForUser(caseId, currentUser);

  if (!caseDetail || caseDetail.customer.id !== customerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const analytics = new StubCustomerAnalyticsClient();
  const recommendations = await analytics.getRecommendations(customerId);

  return NextResponse.json({
    customerId,
    recommendations,
    staffApprovalRequired: true
  });
}
