import type { AppUser } from "@/domain/types";
import type { AnalyticsCustomerIdentity, CustomerAnalyticsClient, ProductRecommendation } from "@/lib/analytics";
import { StubCustomerAnalyticsClient } from "@/lib/analytics";
import { canViewCase } from "@/lib/access-control";
import type { AuditLogRepository } from "@/repositories/audit-logs";
import { createPrismaAuditLogRepository } from "@/repositories/audit-logs";
import type { CaseDetail, CaseRepository } from "@/repositories/cases";
import { createPrismaCaseRepository } from "@/repositories/cases";

export type CaseRecommendation = ProductRecommendation & {
  analyticsCustomer: AnalyticsCustomerIdentity;
};

type RecommendationServiceDependencies = {
  analytics: CustomerAnalyticsClient;
  auditLogs: AuditLogRepository;
  cases: CaseRepository;
};

export type RecommendationActionInput = {
  caseId: string;
  recommendationId: string;
  productName: string;
};

export const handledRecommendationActions = new Set([
  "case.recommendation_reviewed",
  "case.recommendation_dismissed",
  "case.recommendation_message_sent",
  "case.recommendation_message_review_requested"
]);

export function handledRecommendationIdsFromAuditLogs(auditLogs: Array<{ action: string; metadata: unknown }>) {
  return new Set(
    auditLogs
      .filter((auditLog) => handledRecommendationActions.has(auditLog.action))
      .map((auditLog) => {
        const metadata = auditLog.metadata as { recommendationId?: unknown } | null;
        return typeof metadata?.recommendationId === "string" ? metadata.recommendationId : null;
      })
      .filter(Boolean)
  );
}

function analyticsCustomerIdentity(caseDetail: CaseDetail): AnalyticsCustomerIdentity {
  if (caseDetail.customer.externalId) {
    return { type: "externalId", value: caseDetail.customer.externalId };
  }

  if (caseDetail.customer.email) {
    return { type: "email", value: caseDetail.customer.email };
  }

  if (caseDetail.customer.phone) {
    return { type: "phone", value: caseDetail.customer.phone };
  }

  return { type: "customerId", value: caseDetail.customer.id };
}

export function draftRecommendationMessage(recommendation: Pick<ProductRecommendation, "productName" | "reason">, caseDetail: CaseDetail) {
  return [
    `While reviewing your case "${caseDetail.title}", we noticed that ${recommendation.productName} may be relevant to your needs.`,
    recommendation.reason,
    "If you would like, our team can share more details or connect you with the right product specialist."
  ].join("\n\n");
}

export function createCustomerRecommendationService(dependencies?: Partial<RecommendationServiceDependencies>) {
  const analytics = dependencies?.analytics ?? new StubCustomerAnalyticsClient();
  const auditLogs = dependencies?.auditLogs ?? createPrismaAuditLogRepository();
  const cases = dependencies?.cases ?? createPrismaCaseRepository();

  async function assertCanUseRecommendation(input: RecommendationActionInput, user: AppUser) {
    if (!input.caseId || !input.recommendationId || !input.productName) {
      throw new Error("Invalid recommendation action");
    }

    const existing = await cases.getCaseById(input.caseId);

    if (!existing || !canViewCase(user, existing)) {
      throw new Error("Current user cannot use recommendations for this case");
    }

    return input;
  }

  return {
    async listForCase(caseDetail: CaseDetail, user: AppUser): Promise<CaseRecommendation[]> {
      if (!canViewCase(user, caseDetail)) {
        return [];
      }

      const analyticsCustomer = analyticsCustomerIdentity(caseDetail);
      const recommendations = await analytics.getRecommendations(analyticsCustomer.value);

      return recommendations.map((recommendation) => ({
        ...recommendation,
        analyticsCustomer
      }));
    },

    async trackReviewedForUser(input: RecommendationActionInput, user: AppUser) {
      const safeInput = await assertCanUseRecommendation(input, user);

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: safeInput.caseId,
        action: "case.recommendation_reviewed",
        metadata: {
          recommendationId: safeInput.recommendationId,
          productName: safeInput.productName
        }
      });
    },

    async dismissForUser(input: RecommendationActionInput, user: AppUser) {
      const safeInput = await assertCanUseRecommendation(input, user);

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: safeInput.caseId,
        action: "case.recommendation_dismissed",
        metadata: {
          recommendationId: safeInput.recommendationId,
          productName: safeInput.productName
        }
      });
    },

    async trackMessageActionForUser(
      input: RecommendationActionInput & { action: "sent" | "review_requested"; approvalId?: string },
      user: AppUser
    ) {
      const safeInput = await assertCanUseRecommendation(input, user);

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: safeInput.caseId,
        action:
          input.action === "sent"
            ? "case.recommendation_message_sent"
            : "case.recommendation_message_review_requested",
        metadata: {
          recommendationId: safeInput.recommendationId,
          productName: safeInput.productName,
          ...(input.approvalId ? { approvalId: input.approvalId } : {})
        }
      });
    }
  };
}
