import { describe, expect, it } from "vitest";
import type { AppUser, FeedbackCase } from "@/domain/types";
import type { ProductRecommendation } from "@/lib/analytics";
import type { CreateAuditLogRecord } from "@/repositories/audit-logs";
import type { CaseDetail, CaseRepository } from "@/repositories/cases";
import {
  createCustomerRecommendationService,
  draftRecommendationMessage,
  handledRecommendationIdsFromAuditLogs
} from "@/services/customer-recommendations";

const now = new Date("2026-07-28T09:00:00.000Z");

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

function makeCase(overrides: Partial<FeedbackCase> = {}): FeedbackCase {
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
    ...overrides
  };
}

function makeCaseDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  const feedbackCase = makeCase();

  return {
    ...feedbackCase,
    customerName: "Demo Customer",
    departmentName: "Support",
    productName: "Commerce Platform",
    assigneeName: null,
    customer: {
      id: "customer-1",
      externalId: "analytics-customer-1",
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

function makeCaseRepository(feedbackCase = makeCase()): CaseRepository {
  return {
    async listCases() {
      return [];
    },
    async listCasesPage() {
      return { items: [], total: 0, page: 1, pageSize: 10, pageCount: 1 };
    },
    async getCaseStats() {
      return {
        byStatus: { New: 0, Assigned: 0, "In Progress": 0, Resolved: 0, Closed: 0, Reopened: 0 },
        byPriority: { Low: 0, Medium: 0, High: 0, Critical: 0 },
        atRisk: 0,
        breached: 0,
        newCaseTrend: { currentWeek: 0, previousWeek: 0, deltaPct: null },
        resolvedTrend: { currentWeek: 0, previousWeek: 0, deltaPct: null }
      };
    },
    async createCase() {
      return feedbackCase;
    },
    async getCaseById(id) {
      return id === feedbackCase.id ? feedbackCase : null;
    },
    async getCaseBySourceExternalId() {
      return null;
    },
    async getCaseDetail() {
      return makeCaseDetail();
    },
    async updateStatus() {
      return feedbackCase;
    },
    async assignCase() {
      return feedbackCase;
    }
  };
}

describe("customer recommendation service", () => {
  it("uses the best available analytics customer identifier", async () => {
    const requestedCustomerIds: string[] = [];
    const recommendation: ProductRecommendation = {
      id: "rec-1",
      customerId: "analytics-customer-1",
      productName: "Advanced Analytics Add-on",
      reason: "Customer needs better reporting.",
      confidence: 0.78
    };
    const service = createCustomerRecommendationService({
      analytics: {
        async getRecommendations(customerId) {
          requestedCustomerIds.push(customerId);
          return [recommendation];
        }
      },
      auditLogs: { async createAuditLog() {} },
      cases: makeCaseRepository()
    });

    const recommendations = await service.listForCase(makeCaseDetail(), makeUser());

    expect(requestedCustomerIds).toEqual(["analytics-customer-1"]);
    expect(recommendations[0]).toMatchObject({
      id: "rec-1",
      analyticsCustomer: { type: "externalId", value: "analytics-customer-1" }
    });
  });

  it("does not return recommendations to users without case access", async () => {
    const service = createCustomerRecommendationService({
      analytics: {
        async getRecommendations() {
          throw new Error("Analytics should not be called");
        }
      },
      auditLogs: { async createAuditLog() {} },
      cases: makeCaseRepository()
    });

    await expect(
      service.listForCase(makeCaseDetail({ sourceSystem: "other-product" }), makeUser())
    ).resolves.toEqual([]);
  });

  it("records recommendation dismissal audit events", async () => {
    const auditEvents: CreateAuditLogRecord[] = [];
    const service = createCustomerRecommendationService({
      analytics: { async getRecommendations() { return []; } },
      auditLogs: {
        async createAuditLog(input) {
          auditEvents.push(input);
        }
      },
      cases: makeCaseRepository()
    });

    await service.dismissForUser(
      { caseId: "case-1", recommendationId: "rec-1", productName: "Advanced Analytics Add-on" },
      makeUser()
    );

    expect(auditEvents).toEqual([
      {
        actorId: "user-1",
        caseId: "case-1",
        action: "case.recommendation_dismissed",
        metadata: {
          recommendationId: "rec-1",
          productName: "Advanced Analytics Add-on"
        }
      }
    ]);
  });

  it("records recommendation message action audit events", async () => {
    const auditEvents: CreateAuditLogRecord[] = [];
    const service = createCustomerRecommendationService({
      analytics: { async getRecommendations() { return []; } },
      auditLogs: {
        async createAuditLog(input) {
          auditEvents.push(input);
        }
      },
      cases: makeCaseRepository()
    });

    await service.trackMessageActionForUser(
      {
        caseId: "case-1",
        recommendationId: "rec-1",
        productName: "Advanced Analytics Add-on",
        action: "review_requested",
        approvalId: "approval-1"
      },
      makeUser()
    );

    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: "user-1",
        caseId: "case-1",
        action: "case.recommendation_message_review_requested",
        metadata: {
          recommendationId: "rec-1",
          productName: "Advanced Analytics Add-on",
          approvalId: "approval-1"
        }
      })
    ]);
  });

  it("creates editable customer-facing drafts from recommendations", () => {
    expect(
      draftRecommendationMessage(
        {
          productName: "Advanced Analytics Add-on",
          reason: "Customer feedback indicates reporting and visibility needs."
        },
        makeCaseDetail()
      )
    ).toContain("While reviewing your case \"Checkout failed\"");
  });

  it("treats any recommendation action as handled for future display", () => {
    const handledIds = handledRecommendationIdsFromAuditLogs([
      { action: "case.recommendation_reviewed", metadata: { recommendationId: "rec-reviewed" } },
      { action: "case.recommendation_message_review_requested", metadata: { recommendationId: "rec-requested" } },
      { action: "case.recommendation_message_sent", metadata: { recommendationId: "rec-sent" } },
      { action: "case.recommendation_dismissed", metadata: { recommendationId: "rec-dismissed" } },
      { action: "case.status_changed", metadata: { recommendationId: "rec-unrelated" } }
    ]);

    expect(handledIds).toEqual(new Set(["rec-reviewed", "rec-requested", "rec-sent", "rec-dismissed"]));
  });
});
