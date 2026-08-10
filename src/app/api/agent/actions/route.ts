import { NextResponse } from "next/server";
import { normalizeProposedAction } from "@/lib/agent-actions";
import type { AgentActionDecisionInput } from "@/lib/agent-actions";
import { canEnterApplication } from "@/lib/access-control";
import { createPrismaAuditLogRepository } from "@/repositories/audit-logs";
import { resolveCurrentUser } from "@/lib/current-user";
import { isFeedbackAgentEnabled } from "@/services/agent-bot";
import { createCaseService } from "@/services/cases";

export async function POST(request: Request) {
  if (!isFeedbackAgentEnabled()) {
    return NextResponse.json({ error: "Feedback agent is disabled" }, { status: 403 });
  }

  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canEnterApplication(currentUser) || currentUser.passwordMustChange) {
    return NextResponse.json({ error: "Application access required" }, { status: 403 });
  }

  let body: AgentActionDecisionInput;
  try {
    body = (await request.json()) as AgentActionDecisionInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const decision = body.decision;
  const action = normalizeProposedAction(body.action);

  if ((decision !== "confirm" && decision !== "dismiss") || !action) {
    return NextResponse.json({ error: "Invalid agent action decision" }, { status: 400 });
  }

  const auditLogs = createPrismaAuditLogRepository();

  if (decision === "dismiss") {
    await auditLogs.createAuditLog({
      actorId: currentUser.id,
      caseId: action.caseId,
      action: "agent.proposed_action_dismissed",
      metadata: action
    });

    return NextResponse.json({ status: "dismissed", action });
  }

  const caseService = createCaseService();

  try {
    if (action.type === "transition_case") {
      const updated = await caseService.transitionCaseForUser(action.caseId, action.toStatus, currentUser);
      await auditLogs.createAuditLog({
        actorId: currentUser.id,
        caseId: action.caseId,
        action: "agent.proposed_action_confirmed",
        metadata: {
          ...action,
          resultStatus: updated.status
        }
      });

      return NextResponse.json({ status: "confirmed", action, result: { caseId: updated.id, status: updated.status } });
    }

    if (action.type === "assign_case") {
      const existing = await caseService.getCaseDetailForUser(action.caseId, currentUser);
      if (!existing) {
        return NextResponse.json({ error: "Case was not found or is not accessible" }, { status: 404 });
      }

      const updated = await caseService.assignCaseForUser(action.caseId, action.assigneeId, existing.departmentId, currentUser);
      await auditLogs.createAuditLog({
        actorId: currentUser.id,
        caseId: action.caseId,
        action: "agent.proposed_action_confirmed",
        metadata: {
          ...action,
          resultAssigneeId: updated.assigneeId ?? null
        }
      });

      return NextResponse.json({
        status: "confirmed",
        action,
        result: { caseId: updated.id, assigneeId: updated.assigneeId ?? null }
      });
    }

    return NextResponse.json({ error: "Unsupported agent action" }, { status: 400 });
  } catch (error) {
    await auditLogs.createAuditLog({
      actorId: currentUser.id,
      caseId: action.caseId,
      action: "agent.proposed_action_failed",
      metadata: {
        ...action,
        failureReason: error instanceof Error ? error.message : "Agent action failed"
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent action failed" },
      { status: 400 }
    );
  }
}
