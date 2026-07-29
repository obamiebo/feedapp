import type { PrismaClient } from "@prisma/client";
import type { CaseStatus, Priority } from "@/domain/types";
import { prisma } from "@/lib/db";
import { mapCaseStatusFromPrisma, mapCaseStatusToPrisma, mapPriorityFromPrisma, mapPriorityToPrisma } from "@/lib/domain-mappers";

export type MessagingCadencePolicyRecord = {
  id: string;
  status: CaseStatus;
  priority: Priority;
  staleAfterHours: number;
  enabled: boolean;
};

export type MessagingCadenceRepository = {
  listPolicies(): Promise<MessagingCadencePolicyRecord[]>;
  findPolicy(status: CaseStatus, priority: Priority): Promise<MessagingCadencePolicyRecord | null>;
  upsertPolicy(input: {
    status: CaseStatus;
    priority: Priority;
    staleAfterHours: number;
    enabled: boolean;
  }): Promise<MessagingCadencePolicyRecord>;
};

function toPolicy(record: {
  id: string;
  status: ReturnType<typeof mapCaseStatusToPrisma>;
  priority: ReturnType<typeof mapPriorityToPrisma>;
  staleAfterHours: number;
  enabled: boolean;
}): MessagingCadencePolicyRecord {
  return {
    id: record.id,
    status: mapCaseStatusFromPrisma(record.status),
    priority: mapPriorityFromPrisma(record.priority),
    staleAfterHours: record.staleAfterHours,
    enabled: record.enabled
  };
}

export function createPrismaMessagingCadenceRepository(client: PrismaClient = prisma): MessagingCadenceRepository {
  return {
    async listPolicies() {
      const records = await client.messagingCadencePolicy.findMany({
        orderBy: [{ status: "asc" }, { priority: "asc" }]
      });
      return records.map(toPolicy);
    },

    async findPolicy(status, priority) {
      const record = await client.messagingCadencePolicy.findUnique({
        where: {
          status_priority: {
            status: mapCaseStatusToPrisma(status),
            priority: mapPriorityToPrisma(priority)
          }
        }
      });
      return record ? toPolicy(record) : null;
    },

    async upsertPolicy(input) {
      const record = await client.messagingCadencePolicy.upsert({
        where: {
          status_priority: {
            status: mapCaseStatusToPrisma(input.status),
            priority: mapPriorityToPrisma(input.priority)
          }
        },
        update: {
          staleAfterHours: input.staleAfterHours,
          enabled: input.enabled
        },
        create: {
          status: mapCaseStatusToPrisma(input.status),
          priority: mapPriorityToPrisma(input.priority),
          staleAfterHours: input.staleAfterHours,
          enabled: input.enabled
        }
      });

      return toPolicy(record);
    }
  };
}
