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
  const auditLogs = { createAuditLog: vi.fn().mockResolvedValue(undefined) };

  it("lists the v1 FeedApp tools", () => {
    const tools = createFeedAppMcpTools({
      cases: {} as never,
      productKnowledge: {} as never,
      users: {} as never,
      auditLogs
    }).listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      "get_feedback_counts",
      "list_cases_by_status",
      "recommend_case_next_action",
      "list_assignable_users_for_case",
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
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()), listAssignableUsersByProductSourceKey: vi.fn() },
      cases: {
        getCaseDetailAccessForUser,
        requestCustomerReplyApprovalForUser: vi.fn(),
        addInternalNoteForUser: vi.fn(),
        getCaseStatsForUser: vi.fn(),
        listCasesPageForUser: vi.fn()
      },
      productKnowledge: { searchForUser: vi.fn() },
      auditLogs
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
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    const tools = createFeedAppMcpTools({
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()), listAssignableUsersByProductSourceKey: vi.fn() },
      cases: {
        getCaseDetailAccessForUser: vi.fn().mockResolvedValue({ status: "ok", caseDetail: makeCaseDetail() }),
        requestCustomerReplyApprovalForUser: vi.fn(),
        addInternalNoteForUser: vi.fn(),
        getCaseStatsForUser: vi.fn(),
        listCasesPageForUser: vi.fn()
      },
      productKnowledge: { searchForUser },
      auditLogs: { createAuditLog }
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
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        caseId: "case-1",
        action: "agent.product_knowledge_searched"
      })
    );
  });

  it("creates approval drafts without sending customer replies", async () => {
    const requestCustomerReplyApprovalForUser = vi.fn().mockResolvedValue({ id: "approval-1" });
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    const tools = createFeedAppMcpTools({
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()), listAssignableUsersByProductSourceKey: vi.fn() },
      cases: {
        getCaseDetailAccessForUser: vi.fn().mockResolvedValue({ status: "ok", caseDetail: makeCaseDetail() }),
        requestCustomerReplyApprovalForUser,
        addInternalNoteForUser: vi.fn(),
        getCaseStatsForUser: vi.fn(),
        listCasesPageForUser: vi.fn()
      },
      productKnowledge: { searchForUser: vi.fn() },
      auditLogs: { createAuditLog }
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
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        caseId: "case-1",
        action: "agent.customer_reply_draft_created"
      })
    );
  });

  it("returns scoped feedback counts for dashboard questions", async () => {
    const getCaseStatsForUser = vi.fn().mockResolvedValue({
      byStatus: { New: 2, Assigned: 1, "In Progress": 3, Resolved: 4, Closed: 5, Reopened: 0 },
      byPriority: { Low: 1, Medium: 2, High: 3, Critical: 4 },
      atRisk: 2,
      breached: 1,
      newCaseTrend: { currentWeek: 5, previousWeek: 3, deltaPct: 67 },
      resolvedTrend: { currentWeek: 2, previousWeek: 1, deltaPct: 100 }
    });
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    const tools = createFeedAppMcpTools({
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()), listAssignableUsersByProductSourceKey: vi.fn() },
      cases: {
        getCaseDetailAccessForUser: vi.fn(),
        requestCustomerReplyApprovalForUser: vi.fn(),
        addInternalNoteForUser: vi.fn(),
        getCaseStatsForUser,
        listCasesPageForUser: vi.fn()
      },
      productKnowledge: { searchForUser: vi.fn() },
      auditLogs: { createAuditLog }
    });

    const result = parseTextResult(
      await tools.callTool("get_feedback_counts", {
        actorUserId: "user-1",
        status: "New",
        sourceSystem: "commerce-platform"
      })
    );

    expect(getCaseStatsForUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      { sourceSystem: "commerce-platform", status: "New", priority: undefined }
    );
    expect(result.stats).toMatchObject({ atRisk: 2, breached: 1 });
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "agent.feedback_counts_viewed" }));
  });

  it("lists scoped cases for status questions", async () => {
    const listCasesPageForUser = vi.fn().mockResolvedValue({
      items: [makeCaseDetail()],
      total: 1,
      page: 1,
      pageSize: 5,
      pageCount: 1
    });
    const tools = createFeedAppMcpTools({
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()), listAssignableUsersByProductSourceKey: vi.fn() },
      cases: {
        getCaseDetailAccessForUser: vi.fn(),
        requestCustomerReplyApprovalForUser: vi.fn(),
        addInternalNoteForUser: vi.fn(),
        getCaseStatsForUser: vi.fn(),
        listCasesPageForUser
      },
      productKnowledge: { searchForUser: vi.fn() },
      auditLogs: { createAuditLog: vi.fn() }
    });

    const result = parseTextResult(
      await tools.callTool("list_cases_by_status", {
        actorUserId: "user-1",
        status: "New",
        limit: 5
      })
    );

    expect(listCasesPageForUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      expect.objectContaining({ status: "New", page: 1, pageSize: 5 })
    );
    expect(result.cases).toEqual([
      expect.objectContaining({
        id: "case-1",
        status: "New",
        sourceSystem: "commerce-platform"
      })
    ]);
  });

  it("recommends next case actions without mutating the case", async () => {
    const tools = createFeedAppMcpTools({
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()), listAssignableUsersByProductSourceKey: vi.fn() },
      cases: {
        getCaseDetailAccessForUser: vi.fn().mockResolvedValue({
          status: "ok",
          caseDetail: makeCaseDetail({ assigneeId: "user-2", assigneeName: "Rep", status: "New" })
        }),
        requestCustomerReplyApprovalForUser: vi.fn(),
        addInternalNoteForUser: vi.fn(),
        getCaseStatsForUser: vi.fn(),
        listCasesPageForUser: vi.fn()
      },
      productKnowledge: { searchForUser: vi.fn() },
      auditLogs: { createAuditLog: vi.fn() }
    });

    const result = parseTextResult(
      await tools.callTool("recommend_case_next_action", {
        actorUserId: "user-1",
        caseId: "case-1"
      })
    );

    expect(result.recommendation).toMatchObject({
      action: "move_to_assigned",
      confidence: "high"
    });
  });

  it("lists assignable users for assignment proposals", async () => {
    const listAssignableUsersByProductSourceKey = vi.fn().mockResolvedValue([
      { id: "user-2", name: "Rep User", email: "rep@example.com" }
    ]);
    const tools = createFeedAppMcpTools({
      users: { getAppUser: vi.fn().mockResolvedValue(makeUser()), listAssignableUsersByProductSourceKey },
      cases: {
        getCaseDetailAccessForUser: vi.fn().mockResolvedValue({ status: "ok", caseDetail: makeCaseDetail() }),
        requestCustomerReplyApprovalForUser: vi.fn(),
        addInternalNoteForUser: vi.fn(),
        getCaseStatsForUser: vi.fn(),
        listCasesPageForUser: vi.fn()
      },
      productKnowledge: { searchForUser: vi.fn() },
      auditLogs: { createAuditLog: vi.fn() }
    });

    const result = parseTextResult(
      await tools.callTool("list_assignable_users_for_case", {
        actorUserId: "user-1",
        caseId: "case-1"
      })
    );

    expect(listAssignableUsersByProductSourceKey).toHaveBeenCalledWith("commerce-platform");
    expect(result.users).toEqual([{ id: "user-2", name: "Rep User", email: "rep@example.com" }]);
  });
});
