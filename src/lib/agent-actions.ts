import { caseStatuses } from "@/domain/constants";
import type { CaseStatus } from "@/domain/types";

export type AgentProposedAction =
  | {
      id: string;
      type: "transition_case";
      caseId: string;
      toStatus: CaseStatus;
      reason: string;
      label?: string;
    }
  | {
      id: string;
      type: "assign_case";
      caseId: string;
      assigneeId: string | null;
      assigneeName?: string | null;
      reason: string;
      label?: string;
    };

export type AgentActionDecisionInput = {
  decision: "confirm" | "dismiss";
  action: AgentProposedAction;
};

export function parseProposedActionsFromChatPayload(input: {
  message?: string;
  metadata?: Record<string, unknown>;
  content?: Array<Record<string, unknown>> | null;
}): AgentProposedAction[] {
  const candidates: unknown[] = [
    input.metadata?.proposedActions,
    input.metadata?.proposed_actions,
    ...((input.content ?? []).flatMap((item) => [item.proposedActions, item.proposed_actions, item.data, item.json]) as unknown[]),
    parseJsonObject(input.message ?? "")?.proposedActions,
    parseJsonObject(input.message ?? "")?.proposed_actions
  ];

  return candidates.flatMap(normalizeActionList);
}

export function normalizeProposedAction(value: unknown): AgentProposedAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = stringValue(record.id) ?? `action-${stableActionPart(record.type)}-${stableActionPart(record.caseId)}`;
  const type = stringValue(record.type);
  const caseId = stringValue(record.caseId) ?? stringValue(record.case_id);
  const reason = stringValue(record.reason) ?? "Assistant recommended this action.";
  const label = stringValue(record.label);

  if (!type || !caseId) {
    return null;
  }

  if (type === "transition_case") {
    const toStatus = stringValue(record.toStatus) ?? stringValue(record.to_status);
    if (!caseStatuses.includes(toStatus as CaseStatus)) {
      return null;
    }

    return {
      id,
      type,
      caseId,
      toStatus: toStatus as CaseStatus,
      reason,
      label
    };
  }

  if (type === "assign_case") {
    const assigneeId = nullableStringValue(record.assigneeId) ?? nullableStringValue(record.assignee_id) ?? null;
    const assigneeName = nullableStringValue(record.assigneeName) ?? nullableStringValue(record.assignee_name);

    return {
      id,
      type,
      caseId,
      assigneeId,
      assigneeName,
      reason,
      label
    };
  }

  return null;
}

function normalizeActionList(value: unknown): AgentProposedAction[] {
  if (!Array.isArray(value)) {
    const single = normalizeProposedAction(value);
    return single ? [single] : [];
  }

  return value.flatMap((item) => {
    const action = normalizeProposedAction(item);
    return action ? [action] : [];
  });
}

function parseJsonObject(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nullableStringValue(value: unknown) {
  if (value === null) return null;
  return stringValue(value);
}

function stableActionPart(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") : "unknown";
}
