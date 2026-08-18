import type { CaseDetail } from "@/repositories/cases";

export type TimelineTone = "neutral" | "info" | "warning" | "critical" | "ok";

export type CaseTimelineItem = {
  id: string;
  kind: "audit" | "message";
  title: string;
  detail: string;
  actor: string;
  createdAt: Date;
  tone: TimelineTone;
};

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) {
    return undefined;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function auditTimelineItem(auditLog: CaseDetail["auditLogs"][number]): CaseTimelineItem {
  const from = metadataValue(auditLog.metadata, "from");
  const to = metadataValue(auditLog.metadata, "to");
  const priority = metadataValue(auditLog.metadata, "priority");
  const sourceSystem = metadataValue(auditLog.metadata, "sourceSystem");
  const toAssigneeId = metadataValue(auditLog.metadata, "toAssigneeId");
  const toDepartmentId = metadataValue(auditLog.metadata, "toDepartmentId");
  const channel = metadataValue(auditLog.metadata, "channel");
  const body = metadataValue(auditLog.metadata, "body");
  const productName = metadataValue(auditLog.metadata, "productName");

  switch (auditLog.action) {
    case "case.created":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "Case created",
        detail: [priority ? `${priority} priority` : undefined, sourceSystem ? `Source: ${sourceSystem}` : undefined]
          .filter(Boolean)
          .join(" · "),
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "info"
      };
    case "case.status_changed":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "Status changed",
        detail: from && to ? `${from} -> ${to}` : "Status was updated",
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: to === "Resolved" || to === "Closed" ? "ok" : "warning"
      };
    case "case.assigned":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "Assignment updated",
        detail: [
          toAssigneeId ? `Assignee: ${toAssigneeId}` : "Unassigned",
          toDepartmentId ? `Department: ${toDepartmentId}` : undefined
        ]
          .filter(Boolean)
          .join(" · "),
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "info"
      };
    case "case.internal_note_added":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "Internal note added",
        detail: "Team note recorded",
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "neutral"
      };
    case "case.customer_reply_sent":
    case "case.reply_approved":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "Customer reply sent",
        detail: body || (channel ? `${channel} message sent to customer` : "Message sent to customer"),
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "ok"
      };
    case "case.customer_reply_declined":
    case "case.reply_rejected":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "Customer reply declined",
        detail: channel ? `${channel} suggestion declined` : "Customer reply suggestion declined",
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "critical"
      };
    case "case.customer_reply_suggestion_dismissed":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "Customer reply suggestion declined",
        detail: "Suggested customer update was dismissed",
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "neutral"
      };
    case "case.recommendation_reviewed":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "ITC Product Recommendation reviewed",
        detail: productName ? `${productName} reviewed` : "ITC product recommendation reviewed",
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "info"
      };
    case "case.recommendation_dismissed":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "ITC Product Recommendation dismissed",
        detail: productName ? `${productName} dismissed` : "ITC product recommendation dismissed",
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "neutral"
      };
    case "case.recommendation_message_sent":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "ITC Product Recommendation sent",
        detail: productName ? `${productName} recommendation sent to customer` : "ITC product recommendation sent",
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "ok"
      };
    case "case.recommendation_message_review_requested":
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: "ITC Product Recommendation submitted for approval",
        detail: productName ? `${productName} recommendation sent for review` : "ITC product recommendation sent for review",
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "warning"
      };
    default:
      return {
        id: `audit-${auditLog.id}`,
        kind: "audit",
        title: auditLog.action,
        detail: "Audit event recorded",
        actor: auditLog.actorName ?? "System",
        createdAt: auditLog.createdAt,
        tone: "neutral"
      };
  }
}

function messageTimelineItem(message: CaseDetail["messages"][number]): CaseTimelineItem {
  const isInternal = message.channel === "Internal Note";
  const isOutbound = message.direction === "outbound";

  return {
    id: `message-${message.id}`,
    kind: "message",
    title: isInternal
      ? "Internal note"
      : isOutbound
        ? `${message.channel} ${message.deliveryStatus.toLowerCase()}`
        : `${message.channel} message`,
    detail: message.deliveryError ? `${message.body}\n\nDelivery issue: ${message.deliveryError}` : message.body,
    actor: isInternal ? "Team" : isOutbound ? "System" : message.direction,
    createdAt: message.createdAt,
    tone: message.deliveryStatus === "Failed" ? "critical" : isInternal ? "neutral" : "info"
  };
}

export function buildCaseTimeline(caseDetail: Pick<CaseDetail, "auditLogs" | "messages" | "approvals">) {
  return [
    ...caseDetail.auditLogs
      .filter(
        (auditLog) =>
          auditLog.action !== "case.internal_note_added" &&
          auditLog.action !== "case.customer_reply_review_requested" &&
          auditLog.action !== "case.reply_approval_requested"
      )
      .map(auditTimelineItem),
    ...caseDetail.messages.filter((message) => message.channel === "Internal Note").map(messageTimelineItem)
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}
