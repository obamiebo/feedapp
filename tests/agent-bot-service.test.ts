import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/domain/types";
import type { CaseDetail } from "@/repositories/cases";
import { createAgentBotService } from "@/services/agent-bot";

const originalEnv = process.env;
const now = new Date("2026-08-10T10:00:00.000Z");

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    roles: ["Customer Service"],
    departmentIds: ["dept-1"],
    directProductSourceKeys: ["commerce-platform"],
    productSourceKeys: ["commerce-platform"],
    productGroupIds: [],
    provisioned: true,
    ...overrides
  };
}

function makeCaseDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: "case-1",
    title: "Checkout failed",
    description: "Customer cannot complete checkout.",
    status: "New",
    priority: "High",
    departmentId: "dept-1",
    customerId: "customer-1",
    sourceSystem: "commerce-platform",
    createdAt: now,
    updatedAt: now,
    customerName: "Demo Customer",
    departmentName: "Support",
    productName: "Commerce Platform",
    assigneeName: null,
    customer: {
      id: "customer-1",
      externalId: "cust-1",
      name: "Demo Customer",
      email: "demo@example.com",
      phone: "+233000000000"
    },
    messages: [],
    approvals: [],
    auditLogs: [],
    ...overrides
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env = {
    ...originalEnv,
    FEEDBACK_AGENT_ENABLED: "true"
  };
});

describe("agent bot service", () => {
  it("rejects generation when the feature flag is disabled", async () => {
    process.env.FEEDBACK_AGENT_ENABLED = "false";
    const service = createAgentBotService({
      cases: {
        getCaseDetailAccessForUser: vi.fn(),
        requestCustomerReplyApprovalForUser: vi.fn()
      },
      chatManagement: { sendMessage: vi.fn() },
      auditLogs: { createAuditLog: vi.fn() }
    });

    await expect(
      service.generateCustomerReplyDraftForUser(
        { caseId: "case-1", channel: "Email", userSessionToken: "session-token" },
        makeUser()
      )
    ).rejects.toThrow("Feedback agent is disabled");
  });

  it("sends case context to chat-management and stores a draft-only approval from the response", async () => {
    const requestCustomerReplyApprovalForUser = vi.fn().mockResolvedValue({ id: "approval-1" });
    const sendMessage = vi.fn().mockResolvedValue({
      message: JSON.stringify({
        draftBody: "We are checking your checkout issue and will update you shortly.",
        rationale: "Initial acknowledgement.",
        runId: "run-1"
      }),
      conversation_id: "conversation-1",
      message_id: "message-1",
      metadata: { toolCalls: ["get_case_context", "search_product_knowledge"] }
    });
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    const service = createAgentBotService({
      cases: {
        getCaseDetailAccessForUser: vi.fn().mockResolvedValue({ status: "ok", caseDetail: makeCaseDetail() }),
        requestCustomerReplyApprovalForUser
      },
      chatManagement: { sendMessage },
      auditLogs: { createAuditLog }
    });

    const result = await service.generateCustomerReplyDraftForUser(
      { caseId: "case-1", channel: "Email", userSessionToken: "session-token" },
      makeUser()
    );

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("caseId: case-1"),
        context_options: expect.objectContaining({
          feedapp_case_id: "case-1",
          feedapp_product_source: "commerce-platform",
          feedapp_task: "customer_reply_draft"
        }),
        create_new: true
      }),
      "session-token"
    );
    expect(requestCustomerReplyApprovalForUser).toHaveBeenCalledWith(
      {
        caseId: "case-1",
        channel: "Email",
        draftBody: "We are checking your checkout issue and will update you shortly."
      },
      expect.objectContaining({ id: "user-1" })
    );
    expect(result).toMatchObject({
      approvalId: "approval-1",
      runId: "run-1",
      conversationId: "conversation-1",
      messageId: "message-1"
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        caseId: "case-1",
        action: "agent.customer_reply_requested"
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        caseId: "case-1",
        action: "agent.customer_reply_draft_created"
      })
    );
  });

  it("reuses a tool-created approval ID when chat-management returns one", async () => {
    const requestCustomerReplyApprovalForUser = vi.fn();
    const service = createAgentBotService({
      cases: {
        getCaseDetailAccessForUser: vi.fn().mockResolvedValue({ status: "ok", caseDetail: makeCaseDetail() }),
        requestCustomerReplyApprovalForUser
      },
      chatManagement: {
        sendMessage: vi.fn().mockResolvedValue({
          message: JSON.stringify({ draftBody: "Draft from MCP.", approvalId: "approval-from-tool" }),
          conversation_id: "conversation-1",
          message_id: "message-1",
          metadata: {}
        })
      },
      auditLogs: { createAuditLog: vi.fn() }
    });

    const result = await service.generateCustomerReplyDraftForUser(
      { caseId: "case-1", channel: "Email", userSessionToken: "session-token" },
      makeUser()
    );

    expect(requestCustomerReplyApprovalForUser).not.toHaveBeenCalled();
    expect(result.approvalId).toBe("approval-from-tool");
  });

  it("audits chat-management failures", async () => {
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    const service = createAgentBotService({
      cases: {
        getCaseDetailAccessForUser: vi.fn().mockResolvedValue({ status: "ok", caseDetail: makeCaseDetail() }),
        requestCustomerReplyApprovalForUser: vi.fn()
      },
      chatManagement: {
        sendMessage: vi.fn().mockRejectedValue(new Error("chat-management returned 500"))
      },
      auditLogs: { createAuditLog }
    });

    await expect(
      service.generateCustomerReplyDraftForUser(
        { caseId: "case-1", channel: "Email", userSessionToken: "session-token" },
        makeUser()
      )
    ).rejects.toThrow("chat-management returned 500");

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        caseId: "case-1",
        action: "agent.customer_reply_failed",
        metadata: expect.objectContaining({
          failureReason: "chat-management returned 500"
        })
      })
    );
  });
});
