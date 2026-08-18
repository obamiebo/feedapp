import { describe, expect, it } from "vitest";
import type { CaseDetail } from "@/repositories/cases";
import { buildCaseTimeline } from "@/services/case-timeline";

function makeTimelineInput(
  overrides: {
    auditLogs?: CaseDetail["auditLogs"];
    messages?: Array<Partial<CaseDetail["messages"][number]> & Pick<CaseDetail["messages"][number], "id" | "channel" | "direction" | "body" | "approvalStatus" | "createdAt">>;
    approvals?: CaseDetail["approvals"];
  } = {}
) {
  return {
    auditLogs: overrides.auditLogs ?? [],
    messages: (overrides.messages ?? []).map((message): CaseDetail["messages"][number] => ({
      id: message.id,
      channel: message.channel,
      direction: message.direction,
      body: message.body,
      approvalStatus: message.approvalStatus,
      createdAt: message.createdAt,
      deliveryStatus: "Not Required",
      deliveryAttempts: 0,
      deliveryError: null,
      providerMessageId: null,
    })),
    approvals: overrides.approvals ?? []
  };
}

describe("case timeline", () => {
  it("orders completed audit and message events newest first", () => {
    const timeline = buildCaseTimeline(
      makeTimelineInput({
        auditLogs: [
          {
            id: "audit-1",
            action: "case.created",
            actorName: "Admin",
            metadata: { priority: "High", sourceSystem: "manual" },
            createdAt: new Date("2026-07-07T10:00:00.000Z")
          }
        ],
        messages: [
          {
            id: "message-1",
            channel: "Internal Note",
            direction: "internal",
            body: "Called customer for more context.",
            approvalStatus: "Approved",
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          }
        ],
        approvals: [
          {
            id: "approval-1",
            channel: "Email",
            status: "Pending",
            draftBody: "We are reviewing your case.",
            requestedReviewerId: null,
            requestedReviewerName: null,
            approverName: null,
            decidedAt: null,
            createdAt: new Date("2026-07-07T11:00:00.000Z")
          }
        ]
      })
    );

    expect(timeline.map((item) => item.id)).toEqual(["message-message-1", "audit-audit-1"]);
    expect(timeline.some((item) => item.title.includes("needs review"))).toBe(false);
  });

  it("formats status and assignment audit events as readable timeline items", () => {
    const timeline = buildCaseTimeline(
      makeTimelineInput({
        auditLogs: [
          {
            id: "audit-status",
            action: "case.status_changed",
            actorName: "Platform Admin",
            metadata: { from: "New", to: "Assigned" },
            createdAt: new Date("2026-07-07T10:00:00.000Z")
          },
          {
            id: "audit-assignment",
            action: "case.assigned",
            actorName: "Platform Admin",
            metadata: { toAssigneeId: "user-cs-1", toDepartmentId: "dept-finance" },
            createdAt: new Date("2026-07-07T09:00:00.000Z")
          }
        ]
      })
    );

    expect(timeline).toEqual([
      expect.objectContaining({
        title: "Status changed",
        detail: "New -> Assigned",
        actor: "Platform Admin"
      }),
      expect.objectContaining({
        title: "Assignment updated",
        detail: "Assignee: user-cs-1 · Department: dept-finance"
      })
    ]);
  });

  it("shows internal notes once by suppressing the matching audit event", () => {
    const timeline = buildCaseTimeline(
      makeTimelineInput({
        auditLogs: [
          {
            id: "audit-note",
            action: "case.internal_note_added",
            actorName: "Customer Service",
            metadata: { bodyLength: 22 },
            createdAt: new Date("2026-07-07T12:00:01.000Z")
          }
        ],
        messages: [
          {
            id: "message-note",
            channel: "Internal Note",
            direction: "internal",
            body: "Called customer.",
            approvalStatus: "Approved",
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          }
        ]
      })
    );

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toEqual(
      expect.objectContaining({
        id: "message-message-note",
        title: "Internal note",
        detail: "Called customer."
      })
    );
  });

  it("shows sent customer replies once with the sender and message body", () => {
    const timeline = buildCaseTimeline(
      makeTimelineInput({
        auditLogs: [
          {
            id: "audit-review",
            action: "case.customer_reply_review_requested",
            actorName: "Customer Service",
            metadata: { channel: "Email" },
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          },
          {
            id: "audit-sent",
            action: "case.customer_reply_sent",
            actorName: "Department User",
            metadata: { channel: "Email", body: "We are working on your case." },
            createdAt: new Date("2026-07-07T12:05:00.000Z")
          }
        ],
        messages: [
          {
            id: "message-sent",
            channel: "Email",
            direction: "outbound",
            body: "We are working on your case.",
            approvalStatus: "Approved",
            createdAt: new Date("2026-07-07T12:05:00.000Z")
          }
        ],
        approvals: [
          {
            id: "approval-sent",
            channel: "Email",
            status: "Approved",
            draftBody: "We are working on your case.",
            requestedReviewerId: null,
            requestedReviewerName: null,
            approverName: "Department User",
            decidedAt: new Date("2026-07-07T12:04:00.000Z"),
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          }
        ]
      })
    );

    expect(timeline).toEqual([
      expect.objectContaining({
        id: "audit-audit-sent",
        title: "Customer reply sent",
        detail: "We are working on your case.",
        actor: "Department User"
      })
    ]);
  });

  it("formats suggestion and recommendation workflow audit events", () => {
    const timeline = buildCaseTimeline(
      makeTimelineInput({
        auditLogs: [
          {
            id: "audit-suggestion-dismissed",
            action: "case.customer_reply_suggestion_dismissed",
            actorName: "Customer Service",
            metadata: { status: "Assigned", priority: "High" },
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          },
          {
            id: "audit-rec-dismissed",
            action: "case.recommendation_dismissed",
            actorName: "Product Manager",
            metadata: { productName: "Advanced Analytics Add-on" },
            createdAt: new Date("2026-07-07T12:05:00.000Z")
          },
          {
            id: "audit-rec-review",
            action: "case.recommendation_message_review_requested",
            actorName: "Customer Service",
            metadata: { productName: "Advanced Analytics Add-on" },
            createdAt: new Date("2026-07-07T12:10:00.000Z")
          }
        ]
      })
    );

    expect(timeline).toEqual([
      expect.objectContaining({
        title: "ITC Product Recommendation submitted for approval",
        detail: "Advanced Analytics Add-on recommendation sent for review"
      }),
      expect.objectContaining({
        title: "ITC Product Recommendation dismissed",
        detail: "Advanced Analytics Add-on dismissed"
      }),
      expect.objectContaining({
        title: "Customer reply suggestion declined",
        detail: "Suggested customer update was dismissed"
      })
    ]);
  });
});
