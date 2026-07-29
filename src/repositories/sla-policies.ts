import type { PrismaClient } from "@prisma/client";
import type { Priority, SlaPolicy } from "@/domain/types";
import { mapPriorityFromPrisma, mapPriorityToPrisma } from "@/lib/domain-mappers";
import { prisma } from "@/lib/db";

export type SlaPolicyRepository = {
  findPolicy(departmentId: string, priority: Priority): Promise<SlaPolicy | null>;
  listPolicies?(): Promise<SlaPolicyRecord[]>;
  upsertPolicy?(input: SlaPolicy): Promise<SlaPolicyRecord>;
};

export type SlaPolicyRecord = SlaPolicy & {
  departmentName: string;
};

function toSlaPolicy(record: {
  departmentId: string;
  priority: ReturnType<typeof mapPriorityToPrisma>;
  responseTargetHours: number;
  resolutionTargetHours: number;
  escalationTargetHours: number;
}): SlaPolicy {
  return {
    departmentId: record.departmentId,
    priority: mapPriorityFromPrisma(record.priority),
    responseTargetHours: record.responseTargetHours,
    resolutionTargetHours: record.resolutionTargetHours,
    escalationTargetHours: record.escalationTargetHours
  };
}

export function createPrismaSlaPolicyRepository(client: PrismaClient = prisma): SlaPolicyRepository {
  return {
    async findPolicy(departmentId, priority) {
      const policy = await client.slaPolicy.findUnique({
        where: {
          departmentId_priority: {
            departmentId,
            priority: mapPriorityToPrisma(priority)
          }
        }
      });

      if (!policy) {
        return null;
      }

      return toSlaPolicy(policy);
    },

    async listPolicies() {
      const policies = await client.slaPolicy.findMany({
        orderBy: [{ department: { name: "asc" } }, { priority: "asc" }],
        include: {
          department: {
            select: {
              name: true
            }
          }
        }
      });

      return policies.map((policy) => ({
        ...toSlaPolicy(policy),
        departmentName: policy.department.name
      }));
    },

    async upsertPolicy(input) {
      const policy = await client.slaPolicy.upsert({
        where: {
          departmentId_priority: {
            departmentId: input.departmentId,
            priority: mapPriorityToPrisma(input.priority)
          }
        },
        update: {
          responseTargetHours: input.responseTargetHours,
          resolutionTargetHours: input.resolutionTargetHours,
          escalationTargetHours: input.escalationTargetHours
        },
        create: {
          departmentId: input.departmentId,
          priority: mapPriorityToPrisma(input.priority),
          responseTargetHours: input.responseTargetHours,
          resolutionTargetHours: input.resolutionTargetHours,
          escalationTargetHours: input.escalationTargetHours
        },
        include: {
          department: {
            select: {
              name: true
            }
          }
        }
      });

      return {
        ...toSlaPolicy(policy),
        departmentName: policy.department.name
      };
    }
  };
}
