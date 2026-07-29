import type { CaseStatus as PrismaCaseStatus, PrismaClient } from "@prisma/client";
import type { CaseStatus, FeedbackCase, Priority } from "@/domain/types";
import { mapCaseStatusFromPrisma, mapCaseStatusToPrisma, mapPriorityFromPrisma, mapPriorityToPrisma } from "@/lib/domain-mappers";
import { prisma } from "@/lib/db";

export type CaseStageRecord = {
  id: string;
  caseId: string;
  status: CaseStatus;
  priority: Priority;
  startedAt: Date;
  endedAt: Date | null;
  lastCustomerUpdateAt: Date | null;
  lastPromptReviewedAt: Date | null;
  followUpCount: number;
};

export type StaleCaseStage = CaseStageRecord & {
  case: FeedbackCase & {
    customerName: string | null;
    departmentName: string;
    assigneeName: string | null;
  };
};

export type CaseStageRepository = {
  createInitialStage(input: { caseId: string; status: CaseStatus; priority: Priority; startedAt?: Date }): Promise<CaseStageRecord>;
  transitionToStage(input: { caseId: string; status: CaseStatus; priority: Priority; startedAt?: Date }): Promise<CaseStageRecord>;
  findActiveStage(caseId: string): Promise<CaseStageRecord | null>;
  markCustomerUpdate(caseId: string, input?: { at?: Date; incrementFollowUp?: boolean }): Promise<void>;
  markPromptReviewed(caseId: string, at?: Date): Promise<void>;
  listStaleStages(now?: Date): Promise<StaleCaseStage[]>;
};

function toStage(record: {
  id: string;
  caseId: string;
  status: PrismaCaseStatus;
  priority: ReturnType<typeof mapPriorityToPrisma>;
  startedAt: Date;
  endedAt: Date | null;
  lastCustomerUpdateAt: Date | null;
  lastPromptReviewedAt: Date | null;
  followUpCount: number;
}): CaseStageRecord {
  return {
    id: record.id,
    caseId: record.caseId,
    status: mapCaseStatusFromPrisma(record.status),
    priority: mapPriorityFromPrisma(record.priority),
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    lastCustomerUpdateAt: record.lastCustomerUpdateAt,
    lastPromptReviewedAt: record.lastPromptReviewedAt,
    followUpCount: record.followUpCount
  };
}

function toFeedbackCase(record: StalePrismaCase): StaleCaseStage["case"] {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: mapCaseStatusFromPrisma(record.status),
    priority: mapPriorityFromPrisma(record.priority),
    departmentId: record.departmentId,
    assigneeId: record.assigneeId ?? undefined,
    customerId: record.customerId,
    sourceSystem: record.sourceSystem,
    externalId: record.externalId ?? undefined,
    dueAt: record.dueAt ?? undefined,
    slaDeadlineAt: record.slaDeadlineAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    customerName: record.customer.name,
    departmentName: record.department.name,
    assigneeName: record.assignee?.name ?? null
  };
}

type StalePrismaCase = Awaited<ReturnType<typeof prisma.case.findFirst>> & {
  customer: { name: string | null };
  department: { name: string };
  assignee: { name: string } | null;
};

export function createPrismaCaseStageRepository(client: PrismaClient = prisma): CaseStageRepository {
  return {
    async createInitialStage(input) {
      const record = await client.caseStage.create({
        data: {
          caseId: input.caseId,
          status: mapCaseStatusToPrisma(input.status),
          priority: mapPriorityToPrisma(input.priority),
          startedAt: input.startedAt
        }
      });

      return toStage(record);
    },

    async transitionToStage(input) {
      const startedAt = input.startedAt ?? new Date();
      return client.$transaction(async (transaction) => {
        await transaction.caseStage.updateMany({
          where: {
            caseId: input.caseId,
            endedAt: null
          },
          data: {
            endedAt: startedAt
          }
        });

        const record = await transaction.caseStage.create({
          data: {
            caseId: input.caseId,
            status: mapCaseStatusToPrisma(input.status),
            priority: mapPriorityToPrisma(input.priority),
            startedAt
          }
        });

        return toStage(record);
      });
    },

    async findActiveStage(caseId) {
      const record = await client.caseStage.findFirst({
        where: {
          caseId,
          endedAt: null
        },
        orderBy: { startedAt: "desc" }
      });

      return record ? toStage(record) : null;
    },

    async markCustomerUpdate(caseId, input = {}) {
      const at = input.at ?? new Date();
      await client.caseStage.updateMany({
        where: {
          caseId,
          endedAt: null
        },
        data: {
          lastCustomerUpdateAt: at,
          followUpCount: input.incrementFollowUp ? { increment: 1 } : undefined
        }
      });
    },

    async markPromptReviewed(caseId, at = new Date()) {
      await client.caseStage.updateMany({
        where: {
          caseId,
          endedAt: null
        },
        data: {
          lastPromptReviewedAt: at
        }
      });
    },

    async listStaleStages(now = new Date()) {
      const records = await client.caseStage.findMany({
        where: {
          endedAt: null,
          status: { notIn: ["RESOLVED", "CLOSED"] }
        },
        include: {
          case: {
            include: {
              assignee: { select: { name: true } },
              customer: { select: { name: true } },
              department: { select: { name: true } }
            }
          }
        }
      });

      const policies = await client.messagingCadencePolicy.findMany({
        where: { enabled: true }
      });
      const policyMap = new Map(policies.map((policy) => [`${policy.status}:${policy.priority}`, policy]));

      return records
        .filter((record) => {
          const policy = policyMap.get(`${record.status}:${record.priority}`);
          if (!policy) return false;
          const baseline = record.lastCustomerUpdateAt ?? record.lastPromptReviewedAt ?? record.startedAt;
          const staleAt = new Date(baseline.getTime() + policy.staleAfterHours * 60 * 60 * 1000);
          return staleAt <= now;
        })
        .map((record) => ({
          ...toStage(record),
          case: toFeedbackCase(record.case as StalePrismaCase)
        }));
    }
  };
}
