import { describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/domain/types";
import type { CaseDetail } from "@/repositories/cases";
import { createFeedAppMcpTools } from "@/services/mcp-tools";

const now = new Date("2026-08-06T14:10:00.000Z");

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    roles: ["Product User"],
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

function parseTextResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

describe("FeedApp MCP tools", () => {
  it("lists the v1 FeedApp tools", () => {
    const tools = createFeedAppMcpTools({
      cases: {} as never,
      productKnowledge: {} as never,
      users: {} as never
    }).listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      "get_case_context",
      "search_product_knowledge",
      "create_customer_reply_draft",
      "add_internal_note"
    ]);
  });

  it("gets case context only through actor-scoped case access", async () => {
    const caseDetail = makeCaseDetail();
    const getCaseDetailAccessForUser = vi.fn().mockResolvedValue({ status: "ok", caseDetail });
    const tools = createFeedAppMcpTools({
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()) },
      cases: {
        getCaseDetailAccessForUser,
        requestCustomerReplyApprovalForUser: vi.fn(),
        addInternalNoteForUser: vi.fn()
      },
      productKnowledge: { searchForUser: vi.fn() }
    });

    const result = parseTextResult(await tools.callTool("get_case_context", { actorUserId: "user-1", caseId: "case-1" }));

    expect(getCaseDetailAccessForUser).toHaveBeenCalledWith("case-1", expect.objectContaining({ id: "user-1" }));
    expect(result.case).toMatchObject({
      id: "case-1",
      sourceSystem: "commerce-platform"
    });
  });

  it("searches product knowledge using the case product source", async () => {
    const searchForUser = vi.fn().mockResolvedValue({
      query: "checkout failure",
      results: [],
      total_results: 0
    });
    const tools = createFeedAppMcpTools({
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()) },
      cases: {
        getCaseDetailAccessForUser: vi.fn().mockResolvedValue({ status: "ok", caseDetail: makeCaseDetail() }),
        requestCustomerReplyApprovalForUser: vi.fn(),
        addInternalNoteForUser: vi.fn()
      },
      productKnowledge: { searchForUser }
    });

    await tools.callTool("search_product_knowledge", {
      actorUserId: "user-1",
      caseId: "case-1",
      query: "checkout failure",
      documentType: "troubleshooting",
      topK: 3
    });

    expect(searchForUser).toHaveBeenCalledWith(
      {
        productSourceKey: "commerce-platform",
        query: "checkout failure",
        documentType: "troubleshooting",
        topK: 3
      },
      expect.objectContaining({ id: "user-1" })
    );
  });

  it("creates approval drafts without sending customer replies", async () => {
    const requestCustomerReplyApprovalForUser = vi.fn().mockResolvedValue({ id: "approval-1" });
    const tools = createFeedAppMcpTools({
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()) },
      cases: {
        getCaseDetailAccessForUser: vi.fn().mockResolvedValue({ status: "ok", caseDetail: makeCaseDetail() }),
        requestCustomerReplyApprovalForUser,
        addInternalNoteForUser: vi.fn()
      },
      productKnowledge: { searchForUser: vi.fn() }
    });

    const result = parseTextResult(
      await tools.callTool("create_customer_reply_draft", {
        actorUserId: "user-1",
        caseId: "case-1",
        channel: "email",
        draftBody: "Hello, we are checking this."
      })
    );

    expect(requestCustomerReplyApprovalForUser).toHaveBeenCalledWith(
      {
        caseId: "case-1",
        channel: "Email",
        draftBody: "Hello, we are checking this."
      },
      expect.objectContaining({ id: "user-1" })
    );
    expect(result).toMatchObject({
      approvalId: "approval-1",
      sent: false,
      status: "draft_created"
    });
  });
});
